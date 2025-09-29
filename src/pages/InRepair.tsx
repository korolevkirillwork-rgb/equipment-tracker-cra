import * as React from 'react'
import { Box, Paper, Table, TableHead, TableRow, TableCell, TableBody, Typography } from '@mui/material'
import PageHeader from '../components/PageHeader'
import Section from '../components/Section'
import { fetchInRepair, InRepairRow } from '../lib/repairsApi'

export default function InRepair() {
  const [rows, setRows] = React.useState<InRepairRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const data = await fetchInRepair()
        if (alive) setRows(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <Box>
      <PageHeader title="В ремонте" crumbs={[{ label: 'Главная', to: '/' }, { label: 'В ремонте' }]} />
      <Section title={`Оборудование в ремонте`} action={<Typography variant="caption" color="text.secondary">{rows.length} поз.</Typography>}>
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Тип</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>Внутр. ID</TableCell>
                <TableCell>Модель</TableCell>
                <TableCell>Серийник</TableCell>
                <TableCell>Отгрузка №</TableCell>
                <TableCell>Дата отгрузки</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7}><Typography color="text.secondary">{loading ? 'Загрузка…' : 'Нет данных'}</Typography></TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={`${r.table_name}-${r.id}-${i}`}>
                  <TableCell>{r.table_name}</TableCell>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.internal_id || '—'}</TableCell>
                  <TableCell>{r.model || '—'}</TableCell>
                  <TableCell>{r.serial_number || '—'}</TableCell>
                  <TableCell>{r.shipment_number || '—'}</TableCell>
                  <TableCell>{r.shipment_date ? new Date(r.shipment_date).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Section>
    </Box>
  )
}
