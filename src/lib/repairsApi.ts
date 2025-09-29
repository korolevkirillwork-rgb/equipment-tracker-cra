import { supabase } from './supabase'

export type InRepairRow = {
  table_name: 'tsd' | 'finger_scanners' | 'desktop_scanners' | 'tablets'
  id: number
  internal_id: string | null
  model: string | null
  serial_number: string | null
  status: 'in_repair' | 'on_stock'
  shipment_number: string | null
  shipment_date: string | null
}

export async function fetchInRepair(): Promise<InRepairRow[]> {
  // Берём все поля, чтобы не обращаться к несуществующим явно
  const { data, error } = await supabase
    .from('v_in_repair')
    .select('*')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as any[]

  // Нормализация имён столбцов под ожидаемый тип
  const normalized: InRepairRow[] = rows.map((r) => ({
    // во вьюхе может быть table_name или item_table
    table_name: (r.table_name ?? r.item_table) as InRepairRow['table_name'],
    // во вьюхе может быть id или item_id
    id: (r.id ?? r.item_id) as number,
    internal_id: r.internal_id ?? r.item_internal_id ?? null,
    model: r.model ?? r.item_model ?? null,
    serial_number: r.serial_number ?? r.item_serial_number ?? null,
    status: (r.status ?? 'in_repair') as InRepairRow['status'],
    // может быть shipment_number или number
    shipment_number: r.shipment_number ?? r.number ?? null,
    // может быть shipment_date или shipped_at (timestamp)
    shipment_date: r.shipment_date ?? r.shipped_at ?? r.created_at ?? null,
  }))

  // Сортируем по дате отгрузки по убыванию (на клиенте, чтобы не падать из-за отсутствующих столбцов)
  normalized.sort((a, b) => {
    const at = a.shipment_date ? new Date(a.shipment_date).getTime() : 0
    const bt = b.shipment_date ? new Date(b.shipment_date).getTime() : 0
    return bt - at
  })

  return normalized
}
