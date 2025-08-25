import { supabase } from '../lib/supabase'
import { db, tableToDexie, QueueItem, Shipment, ShipmentItem } from './db'
import { EquipmentItem, EquipmentTableName } from '../types'

const isOnline = () => navigator.onLine

// ====== READ ======
export async function listOnStock(table: EquipmentTableName): Promise<EquipmentItem[]> {
  // 1) сначала из кеша
  const cached = await tableToDexie(table).where('status').equals('on_stock').reverse().sortBy('id')
  // 2) если онлайн — обновим кеш
  if (isOnline()) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('status', 'on_stock').order('id', { ascending: false })
      if (!error && data) {
        await tableToDexie(table).bulkPut(data as EquipmentItem[])
        return data as EquipmentItem[]
      }
    } catch {}
  }
  return cached
}

export async function listShipments(): Promise<Shipment[]> {
  const cached = await db.shipments.orderBy('id').reverse().toArray()
  if (isOnline()) {
    try {
      const { data, error } = await supabase.from('shipments').select('*').order('id', { ascending: false })
      if (!error && data) {
        await db.transaction('rw', db.shipments, async () => {
          await db.shipments.clear()
          await db.shipments.bulkPut(data as Shipment[])
        })
        return data as Shipment[]
      }
    } catch {}
  }
  return cached
}

export async function getShipmentDetails(shipmentId: number): Promise<{
  items: (EquipmentItem & { table_name: EquipmentTableName })[]
}> {
  // читаем shipment_items из кеша (он обновляется при ship/refresh)
  const links = await db.shipment_items.where('shipment_id').equals(shipmentId).toArray()
  const byTable: Record<EquipmentTableName, number[]> = { tsd: [], finger_scanners: [], desktop_scanners: [], tablets: [] }
  links.forEach(l => byTable[l.table_name].push(l.item_id))

  const acc: (EquipmentItem & { table_name: EquipmentTableName })[] = []
  for (const t of Object.keys(byTable) as EquipmentTableName[]) {
    const ids = byTable[t]
    if (!ids.length) continue
    const items = await tableToDexie(t).where('id').anyOf(ids).toArray()
    items.forEach(i => acc.push({ ...i, table_name: t }))
  }
  return { items: acc.sort((a, b) => b.id - a.id) }
}

// ====== WRITE (offline-first) ======
export async function insertItems(table: EquipmentTableName, items: Omit<EquipmentItem,'id'>[]): Promise<void> {
  if (items.length === 0) return
  if (isOnline()) {
    const { data, error } = await supabase.from(table).insert(items).select('*')
    if (error) throw new Error(error.message)
    await tableToDexie(table).bulkPut((data || []) as EquipmentItem[])
  } else {
    // офлайн: ставим временные id (<0) и кладем в очередь
    const batch: EquipmentItem[] = items.map((it, idx) => ({ ...(it as any), id: -Date.now() - idx }))
    await tableToDexie(table).bulkPut(batch)
    await db.queue.bulkAdd(batch.map(b => ({
      type: 'insert',
      table,
      payload: { tempId: b.id, item: { internal_id: b.internal_id, model: b.model, serial_number: b.serial_number, status: b.status } }
    } as QueueItem)))
  }
}

export async function deleteItems(table: EquipmentTableName, ids: number[]): Promise<void> {
  if (ids.length === 0) return
  if (isOnline()) {
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) throw new Error(error.message)
    await tableToDexie(table).bulkDelete(ids)
  } else {
    await tableToDexie(table).bulkDelete(ids)
    await db.queue.add({ type: 'delete', table, payload: { ids } })
  }
}

export async function shipItems(params: {
  shipment_number: string
  shipment_date: string
  items: { table: EquipmentTableName, id: number }[]
}): Promise<{ shipmentId: number }> {
  const { shipment_number, shipment_date, items } = params
  // локально поменяем статус на in_repair
  for (const g of groupBy(items, 'table')) {
    await tableToDexie(g.key).where('id').anyOf(g.ids).modify({ status: 'in_repair' })
  }

  if (isOnline()) {
    // онлайн транзакция: create shipment -> items -> update statuses (уже обновили локально)
    const { data: shipData, error: e1 } = await supabase.from('shipments').insert({
      shipment_number, shipment_date
    }).select('id').single()
    if (e1) throw new Error(e1.message)
    const shipmentId = shipData!.id as number

    const payloadLinks = items.map(it => ({ shipment_id: shipmentId, item_id: it.id, table_name: it.table }))
    const { error: e2 } = await supabase.from('shipment_items').insert(payloadLinks)
    if (e2) throw new Error(e2.message)

    // обновим кеш: shipments + shipment_items
    await db.transaction('rw', db.shipments, db.shipment_items, async () => {
      await db.shipments.put({ id: shipmentId, shipment_number, shipment_date })
      await db.shipment_items.bulkAdd(payloadLinks as unknown as ShipmentItem[])
    })

    return { shipmentId }
  } else {
    // офлайн: создаем локальную отгрузку с временным id
    const tempId = -Date.now()
    const links: ShipmentItem[] = items.map(it => ({ shipment_id: tempId, item_id: it.id, table_name: it.table }))

    await db.transaction('rw', db.shipments, db.shipment_items, async () => {
      await db.shipments.put({ id: tempId, shipment_number, shipment_date })
      await db.shipment_items.bulkAdd(links)
    })

    await db.queue.add({
      type: 'ship',
      table: null,
      payload: { shipment_number, shipment_date, items: items.map(i => ({ table_name: i.table, id: i.id })) }
    })

    return { shipmentId: tempId }
  }
}

// ====== DUPLICATES CHECK ======
export async function findExistingSerials(table: EquipmentTableName, serials: string[]): Promise<string[]> {
  const set = new Set<string>()
  // локальный кеш
  const local = await tableToDexie(table).where('serial_number').anyOf(serials).toArray()
  local.forEach(x => set.add(String(x.serial_number)))
  if (isOnline()) {
    const { data, error } = await supabase.from(table).select('serial_number').in('serial_number', serials)
    if (!error && data) data.forEach((x: any) => set.add(String(x.serial_number)))
  }
  return Array.from(set)
}

// ====== SYNC QUEUE ======
export async function runSyncQueue(): Promise<void> {
  if (!isOnline()) return
  const all = await db.queue.toArray()
  for (const q of all) {
    try {
      if (q.type === 'insert' && q.table) {
        const { data, error } = await supabase.from(q.table).insert([q.payload.item]).select('id, internal_id, model, serial_number, status').single()
        if (error) throw new Error(error.message)
        const real = data as EquipmentItem
        // заменить временный id на реальный
        await tableToDexie(q.table).delete(q.payload.tempId)
        await tableToDexie(q.table).put(real)
      } else if (q.type === 'delete' && q.table) {
        await supabase.from(q.table).delete().in('id', q.payload.ids)
        await tableToDexie(q.table).bulkDelete(q.payload.ids)
      } else if (q.type === 'ship') {
        const { shipment_number, shipment_date, items } = q.payload
        const { data: ship, error: e1 } = await supabase.from('shipments').insert({ shipment_number, shipment_date }).select('id').single()
        if (e1) throw new Error(e1.message)
        const shipmentId = ship!.id as number
        const links = items.map(i => ({ shipment_id: shipmentId, item_id: i.id, table_name: i.table_name }))
        const { error: e2 } = await supabase.from('shipment_items').insert(links)
        if (e2) throw new Error(e2.message)
        // обновим кеш: заменить локальную (отрицательную) отгрузку, если была
        await db.shipments.put({ id: shipmentId, shipment_number, shipment_date })
        await db.shipment_items.bulkAdd(links as unknown as ShipmentItem[])
      }
      if (q.id) await db.queue.delete(q.id)
    } catch {
      // если что-то сломалось — оставим в очереди, продолжим позже
      break
    }
  }
}

// utils
function groupBy(arr: { table: EquipmentTableName, id: number }[], key: 'table') {
  const map = new Map<EquipmentTableName, number[]>()
  arr.forEach(a => map.set(a.table, [...(map.get(a.table) || []), a.id]))
  return Array.from(map.entries()).map(([k, ids]) => ({ key: k, ids }))
}
