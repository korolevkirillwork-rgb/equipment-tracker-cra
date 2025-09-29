import { supabase } from './supabase'
import { EquipmentItem, EquipmentTableName } from '../types'

export type ActiveLoanRow = {
  id: number
  loan_id: number
  operator_id: string
  item_id: number
  item_table: Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
  issued_at: string
  due_at: string | null
  serial_number: string | null
  internal_id: string | null
}

/** Доступные к выдаче */
export async function fetchAvailable(
  table: Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
): Promise<EquipmentItem[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, internal_id, model, serial_number, status')
    .eq('status', 'on_stock')
    .order('internal_id', { ascending: true, nullsFirst: false }) // сортируем по внтр. ID
  if (error) throw error
  return (data || []) as EquipmentItem[]
}

/** Активные выдачи (“на руках”) */
export async function fetchActiveByType(
  t: Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
): Promise<ActiveLoanRow[]> {
  const { data, error } = await supabase
    .from('v_active_loans')
    .select(
      'id, loan_id, operator_id, item_id, item_table, table_name, issued_at, due_at, serial_number'
    )
    .order('id', { ascending: false })
  if (error) throw error

  const rows = (data || []) as any[]
  const filtered = rows.filter((r) => (r.item_table ?? r.table_name) === t)

  // дотягиваем serial_number и internal_id, если нужно
  const needMeta = filtered.filter((r) => !r.serial_number || !r.internal_id)
  if (needMeta.length) {
    const idsByTable: Record<string, number[]> = {}
    for (const r of needMeta) {
      const tbl = r.item_table ?? r.table_name
      if (!idsByTable[tbl]) idsByTable[tbl] = []
      idsByTable[tbl].push(r.item_id)
    }
    for (const [tbl, ids] of Object.entries(idsByTable)) {
      const { data: eqRows, error: e2 } = await supabase
        .from(tbl)
        .select('id, serial_number, internal_id')
        .in('id', ids)
      if (!e2 && eqRows) {
        const map = new Map((eqRows as any[]).map((x) => [x.id, { sn: x.serial_number, inid: x.internal_id }]))
        for (const r of filtered) {
          const tblr = r.item_table ?? r.table_name
          if (tblr === tbl) {
            const meta = map.get(r.item_id)
            if (meta) {
              if (!r.serial_number) r.serial_number = meta.sn ?? null
              if (!r.internal_id)  r.internal_id  = meta.inid ?? null
            }
          }
        }
      }
    }
  }

  // сортировка по internal_id по возрастанию
  const cmp = (a: any, b: any) => {
    const A = (a.internal_id ?? '').toString()
    const B = (b.internal_id ?? '').toString()
    const ai = /^\d+$/.test(A) ? parseInt(A, 10) : NaN
    const bi = /^\d+$/.test(B) ? parseInt(B, 10) : NaN
    if (!isNaN(ai) && !isNaN(bi)) return ai - bi
    if (A && !B) return -1
    if (!A && B) return 1
    return A.localeCompare(B, 'ru', { numeric: true })
  }
  filtered.sort(cmp)

  return filtered.map((r) => ({
    id: r.id,
    loan_id: r.loan_id,
    operator_id: r.operator_id,
    item_id: r.item_id,
    item_table: (r.item_table ?? r.table_name) as ActiveLoanRow['item_table'],
    issued_at: r.issued_at,
    due_at: r.due_at ?? null,
    serial_number: r.serial_number ?? null,
    internal_id: r.internal_id ?? null,
  }))
}

/** История комментариев по предмету (с operator_id) */
export type EquipmentComment = {
  id: number
  item_table: EquipmentTableName
  item_id: number
  loan_id: number | null
  action: 'issue' | 'return' | string
  comment: string | null
  operator_id: string | null
  created_at: string
}

export async function fetchComments(
  table: EquipmentTableName,
  itemId: number
): Promise<EquipmentComment[]> {
  const { data, error } = await supabase
    .from('equipment_comments')
    .select('id, item_table, item_id, loan_id, action, comment, operator_id, created_at')
    .eq('item_table', table)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as EquipmentComment[]
}

/** Выдача */
export async function issueItems({
  operatorId,
  table,
  itemIds,
  note,
}: {
  operatorId: string
  table: Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
  itemIds: number[]
  note?: string
}) {
  const { data, error } = await supabase.rpc('loan_issue_v1', {
    p_table_name: table,
    p_item_ids: itemIds,
    p_operator_id: operatorId,
    p_note: note ?? null,
  })
  if (error) throw error
  return data
}

/** Сдача одного предмета */
export async function returnOne({
  table,
  itemId,
  note,
}: {
  table: Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
  itemId: number
  note?: string
}) {
  const { data, error } = await supabase.rpc('loan_return_one_v1', {
    p_table_name: table,
    p_item_id: itemId,
    p_note: note ?? null,
  })
  if (error) throw error
  return data
}

export async function findAvailableBySerial(
  serial: string
): Promise<{ table: 'tsd'|'finger_scanners'; id: number } | null> {
  const s = serial.trim()
  if (!s) return null

  const tryTable = async (tbl: 'tsd'|'finger_scanners') => {
    const { data, error } = await supabase
      .from(tbl)
      .select('id')
      .eq('serial_number', s)
      .eq('status', 'on_stock')
      .limit(1)
    if (!error && data && data.length) return { table: tbl, id: data[0].id as number }
    return null
  }

  return (await tryTable('tsd')) ?? (await tryTable('finger_scanners'))
}
