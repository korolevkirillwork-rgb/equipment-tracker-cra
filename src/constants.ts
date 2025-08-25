import { EquipmentTableName } from './types'

export const EQUIPMENT_TYPES: Record<
  EquipmentTableName,
  { title: string; table: EquipmentTableName; route: string }
> = {
  tsd: { title: 'ТСД', table: 'tsd', route: '/tsd' },
  finger_scanners: { title: 'Напалечные сканеры', table: 'finger_scanners', route: '/finger-scanners' },
  desktop_scanners: { title: 'Настольные сканеры', table: 'desktop_scanners', route: '/desktop-scanners' },
  tablets: { title: 'Планшеты', table: 'tablets', route: '/tablets' }
}

export const STATUS_LABELS = {
  on_stock: 'На складе',
  in_repair: 'В ремонте'
} as const
