import * as React from 'react'
import {
  Box, Drawer, Stack, Typography, IconButton, Chip, Divider, Alert, Button, LinearProgress, Tooltip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { supabase } from '../lib/supabase'
import { EquipmentItem, EquipmentTableName } from '../types'
import { EQUIPMENT_TYPES } from '../constants'
import { generateShipmentPDF } from '../utils/pdf'

type DrawerShipment = {
  id: number
  shipment_number: string
  shipment_date: string
}

type Row = EquipmentItem & {
  table: EquipmentTableName
  tableTitle: string
}

type Props = {
  open: boolean
  onClose: () => void
  shipment: DrawerShipment | null
}

export default function ShipmentDetailsDrawer({ open, onClose, shipment }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<Row[]>([])

  const loadDetails = React.useCallback(async () => {
    if (!shipment) return
    setLoading(true)
    setError(null)
    setRows([])

    try {
      // 1) Получаем строки из shipment_items
      const { data: items, error: e1 } = await supabase
        .from('shipment_items')
        .select('*')
        .eq('shipment_id', shipment.id)

      if (e1) throw new Error(e1.message)

      const si = (items || []) as { id: number; shipment_id: number; item_id: number; table_name: EquipmentTableName }[]

      // 2) Собираем по таблицам id'шники и вытягиваем оборудование
      const byTable: Record<EquipmentTableName, number[]> = {
        tsd: [], finger_scanners: [], desktop_scanners: [], tablets: []
      }
      si.forEach(x => byTable[x.table_name].push(x.item_id))

      const acc: Row[] = []
      for (const t of Object.keys(byTable) as EquipmentTableName[]) {
        const ids = byTable[t]
        if (!ids.length) continue
        const { data, error: e2 } = await supabase.from(t).select('*').in('id', ids)
        if (e2) throw new Error(e2.message)

        // ✅ защита от null и строгая типизация
        if (data && Array.isArray(data)) {
          (data as EquipmentItem[]).forEach((d) => {
            acc.push({ ...d, table: t, tableTitle: EQUIPMENT_TYPES[t].title })
          })
        }
      }

      // показываем по id убыв.
      acc.sort((a, b) => b.id - a.id)
      setRows(acc)
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить детали отгрузки')
    } finally {
      setLoading(false)
    }
  }, [shipment])

  React.useEffect(() => {
    if (open && shipment) loadDetails()
  }, [open, shipment, loadDetails])

  const counts = React.useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach(r => m.set(r.tableTitle, (m.get(r.tableTitle) || 0) + 1))
    return Array.from(m.entries()) // [title, count][]
  }, [rows])

  const handlePDF = async () => {
    if (!shipment) return
    const sameTable = rows.every(r => r.table === rows[0]?.table)
    const title = sameTable ? (rows[0] ? rows[0].tableTitle : 'Оборудование') : 'Смешанные типы'
    await generateShipmentPDF({
      shipmentNumber: shipment.shipment_number,
      shipmentDate: shipment.shipment_date,
      items: rows,
      equipmentTitle: title
    })
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: 480, p: 2 } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="h6">Отгрузка № {shipment?.shipment_number}</Typography>
          <Typography variant="body2" color="text.secondary">Дата: {shipment?.shipment_date}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Сформировать PDF">
            <span>
              <IconButton onClick={handlePDF} disabled={!rows.length}>
                <PictureAsPdfIcon />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {loading && <LinearProgress />}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {!loading && !error && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>Состав отгрузки</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {counts.map(([title, cnt]) => (
                <Chip key={title} label={`${title}: ${cnt}`} color="primary" variant="outlined" />
              ))}
              {rows.length === 0 && <Typography color="text.secondary">Нет позиций</Typography>}
            </Stack>
          </Box>

          {rows.length > 0 && (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>Тип</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>Внутр. ID</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>Модель</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>Серийный номер</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.table}:${r.id}`}>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>{r.tableTitle}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>{r.internal_id}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>{r.model}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--mui-palette-divider)' }}>{r.serial_number}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          )}

          <Box>
            <Button
              variant="outlined"
              onClick={handlePDF}
              startIcon={<PictureAsPdfIcon />}
              disabled={!rows.length}
            >
              Сформировать PDF
            </Button>
          </Box>
        </Stack>
      )}
    </Drawer>
  )
}
