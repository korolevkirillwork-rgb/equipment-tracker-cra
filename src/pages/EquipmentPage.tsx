import * as React from 'react'
import EquipmentTable from '../components/EquipmentTable'
import { EquipmentTableName } from '../types'
import { Typography, Box } from '@mui/material'
import { EQUIPMENT_TYPES } from '../constants'

export default function EquipmentPage({ table }: { table: EquipmentTableName }) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>{EQUIPMENT_TYPES[table].title}</Typography>
      <EquipmentTable table={table} />
    </Box>
  )
}
