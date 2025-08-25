import * as React from 'react'
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Typography, Paper } from '@mui/material'
import PageHeader from '../components/PageHeader'
import { EQUIPMENT_TYPES } from '../constants'
import { EquipmentItem, EquipmentTableName } from '../types'

type Row = EquipmentItem & { table: EquipmentTableName, tableTitle: string }

export default function InRepair() {
  const [rows, setRows] = React.useState<Row[]>([])

  React.useEffect(() => {
    (async () => {
      try {
        const { db } = await import('../offline/db')
        const collect = async (t: EquipmentTableName): Promise<Row[]> => {
          const list = await db[t].where('status').equals('in_repair').toArray()
          return (list as EquipmentItem[]).map(r => ({ ...r, table: t, tableTitle: EQUIPMENT_TYPES[t].title }))
        }
        const all = [
          ...(await collect('tsd')),
          ...(await collect('finger_scanners')),
          ...(await collect('desktop_scanners')),
          ...(await collect('tablets')),
        ]
        // сортируем по id убыв.
        all.sort((a, b) => b.id - a.id)
        setRows(all)
      } catch {
        setRows([])
      }
    })()
  }, [])

  return (
    <Box>
      <PageHeader title="В ремонте" crumbs={[{ label: 'Главная', to: '/' }, { label: 'В ремонте' }]} actions={<></>} />
      <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
        <Table size="small" aria-label="in-repair" sx={{
          '& thead th': { textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 12, color: 'text.secondary' },
          '& tbody tr:nth-of-type(odd)': { backgroundColor: '#fafafa' }
        }}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell>Внутр. ID</TableCell>
              <TableCell>Модель</TableCell>
              <TableCell>Серийник</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Нет оборудования в ремонте</Typography></TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={`${r.table}-${r.id}`} hover>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.tableTitle}</TableCell>
                <TableCell>{r.internal_id}</TableCell>
                <TableCell>{r.model}</TableCell>
                <TableCell>{r.serial_number}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
