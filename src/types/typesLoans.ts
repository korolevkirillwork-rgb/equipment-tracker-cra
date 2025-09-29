import { EquipmentTableName } from '../types'

export type Loan = {
  id: number
  operator_id: string
  created_at: string
  created_by: string | null
}

export type LoanItem = {
  id: number
  loan_id: number
  table_name: Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
  item_id: number
  issued_at: string
  issued_by: string | null
  issued_note: string | null
  returned_at: string | null
  returned_by: string | null
  return_note: string | null
}

export type EquipmentComment = {
  id: number
  table_name: EquipmentTableName
  item_id: number
  action: 'issue' | 'return' | 'note'
  comment: string
  operator_id: string | null
  created_at: string
  created_by: string | null
}
