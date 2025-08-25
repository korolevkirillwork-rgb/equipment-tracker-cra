export type Status = 'on_stock' | 'in_repair'

export interface EquipmentItem {
  id: number
  internal_id: string
  model: string
  serial_number: string
  status: Status
}

export type EquipmentTableName = 'tsd' | 'finger_scanners' | 'desktop_scanners' | 'tablets'

export interface Shipment {
  id: number
  shipment_number: string
  shipment_date: string // YYYY-MM-DD
}
