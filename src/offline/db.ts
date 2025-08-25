import Dexie, { Table } from 'dexie'
import { EquipmentItem, EquipmentTableName } from '../types'

export type Shipment = {
  id: number         // может быть отрицательным (локально созданный)
  shipment_number: string
  shipment_date: string
}

export type ShipmentItem = {
  id?: number
  shipment_id: number
  item_id: number
  table_name: EquipmentTableName
}

// очередь на синхронизацию
export type QueueItem =
  | { id?: number; type: 'insert'; table: EquipmentTableName; payload: { tempId: number; item: Omit<EquipmentItem,'id'> } }
  | { id?: number; type: 'delete'; table: EquipmentTableName; payload: { ids: number[] } }
  | { id?: number; type: 'ship';   table: null;               payload: { shipment_number: string; shipment_date: string; items: { table_name: EquipmentTableName; id: number }[] } }

class AppDB extends Dexie {
  tsd!: Table<EquipmentItem, number>
  finger_scanners!: Table<EquipmentItem, number>
  desktop_scanners!: Table<EquipmentItem, number>
  tablets!: Table<EquipmentItem, number>

  shipments!: Table<Shipment, number>
  shipment_items!: Table<ShipmentItem, number>

  queue!: Table<QueueItem, number>

  constructor() {
    super('equipment_tracker_db')
    this.version(1).stores({
      tsd: 'id, internal_id, serial_number, status',
      finger_scanners: 'id, internal_id, serial_number, status',
      desktop_scanners: 'id, internal_id, serial_number, status',
      tablets: 'id, internal_id, serial_number, status',
      shipments: 'id, shipment_number, shipment_date',
      shipment_items: '++id, shipment_id, item_id, table_name',
      queue: '++id,type'
    })
  }
}

export const db = new AppDB()

export function tableToDexie(table: EquipmentTableName): Table<EquipmentItem, number> {
  return (db as any)[table] as Table<EquipmentItem, number>
}
