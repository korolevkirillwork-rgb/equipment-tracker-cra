import * as React from 'react'
import {
  Box, Stack, TextField, Button, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Tooltip, Menu, MenuItem, Paper
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import TabletMacIcon from '@mui/icons-material/TabletMac'
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import BuildIcon from '@mui/icons-material/Build'
import { motion } from 'framer-motion'
import Section from '../components/Section'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { STATUS_LABELS, EQUIPMENT_TYPES } from '../constants'
import { EquipmentItem, EquipmentTableName } from '../types'
import { generateShipmentPDF } from '../utils/pdf'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type ShipmentRow = { id: number; shipment_number: string; shipment_date: string; items_count: number }

const eqTypes: { key: EquipmentTableName; icon: React.ReactNode; to: string; label: string }[] = [
  { key: 'tsd', icon: <WarehouseIcon />, to: '/tsd', label: EQUIPMENT_TYPES.tsd.title },
  { key: 'finger_scanners', icon: <QrCodeScannerIcon />, to: '/finger_scanners', label: EQUIPMENT_TYPES.finger_scanners.title },
  { key: 'desktop_scanners', icon: <DocumentScannerIcon />, to: '/desktop_scanners', label: EQUIPMENT_TYPES.desktop_scanners.title },
  { key: 'tablets', icon: <TabletMacIcon />, to: '/tablets', label: EQUIPMENT_TYPES.tablets.title }
]

// CSS grid утилита
const grid = (cols: string, gap = 16) => ({ display: 'grid', gridTemplateColumns: cols, gap: `${gap}px` })

export default function Dashboard() {
  const nav = useNavigate()
  const [search, setSearch] = React.useState('')

  // данные
  const [latestByType, setLatestByType] = React.useState<Record<EquipmentTableName, EquipmentItem[]>>({
    tsd: [], finger_scanners: [], desktop_scanners: [], tablets: []
  })
  const [recentShipments, setRecentShipments] = React.useState<ShipmentRow[]>([])
  const [onStockCounts, setOnStockCounts] = React.useState<Record<EquipmentTableName, number>>({
    tsd: 0, finger_scanners: 0, desktop_scanners: 0, tablets: 0
  })

  const refresh = React.useCallback(async () => {
    try {
      // последние 5 по каждому типу
      const fetchLatest = async (table: EquipmentTableName) => {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('id', { ascending: false })
          .limit(5)
        if (error) throw error
        return (data || []) as EquipmentItem[]
      }
      const latest = {
        tsd: await fetchLatest('tsd'),
        finger_scanners: await fetchLatest('finger_scanners'),
        desktop_scanners: await fetchLatest('desktop_scanners'),
        tablets: await fetchLatest('tablets')
      }
      setLatestByType(latest)

      // количества "на складе" по каждому типу
      const countOnStock = async (table: EquipmentTableName) => {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'on_stock')
        if (error) throw error
        return count || 0
      }
      const counts: Record<EquipmentTableName, number> = {
        tsd: await countOnStock('tsd'),
        finger_scanners: await countOnStock('finger_scanners'),
        desktop_scanners: await countOnStock('desktop_scanners'),
        tablets: await countOnStock('tablets'),
      }
      setOnStockCounts(counts)

      // последние отгрузки + количество позиций
      const { data: ships, error: e1 } = await supabase
        .from('shipments')
        .select('id,shipment_number,shipment_date')
        .order('id', { ascending: false })
        .limit(5)
      if (e1) throw e1

      const shipIds = (ships || []).map(s => s.id)
      const countsMap = new Map<number, number>()
      if (shipIds.length) {
        const { data: items, error: e2 } = await supabase
          .from('shipment_items')
          .select('shipment_id')
          .in('shipment_id', shipIds)
        if (e2) throw e2
        ;(items || []).forEach(it =>
          countsMap.set(it.shipment_id, (countsMap.get(it.shipment_id) || 0) + 1)
        )
      }
      setRecentShipments(
        (ships || []).map(s => ({
          id: s.id,
          shipment_number: s.shipment_number,
          shipment_date: s.shipment_date,
          items_count: countsMap.get(s.id) || 0
        }))
      )
    } catch {
      // без падения UI
    }
  }, [])

  React.useEffect(() => { refresh() }, [refresh])

  // Глобальный поиск (по умолчанию — среди всего оборудования). Для простоты фильтруем последний срез.
  const norm = (s: string) => s.toLowerCase().trim()
  const q = norm(search)
  const matches = (r: EquipmentItem) =>
    !q ||
    norm(String(r.internal_id)).includes(q) ||
    norm(String(r.model)).includes(q) ||
    norm(String(r.serial_number)).includes(q)

  const filteredLatestByType = {
    tsd: latestByType.tsd.filter(matches),
    finger_scanners: latestByType.finger_scanners.filter(matches),
    desktop_scanners: latestByType.desktop_scanners.filter(matches),
    tablets: latestByType.tablets.filter(matches),
  }

  // Меню выбора типа для действий в шапке
  const [anchorAdd, setAnchorAdd] = React.useState<null | HTMLElement>(null)
  const [anchorImport, setAnchorImport] = React.useState<null | HTMLElement>(null)

  return (
    <Stack spacing={2}
      component={motion.div}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      {/* Липкая шапка БЕЗ фильтров. В действиях — выбор типа. */}
      <PageHeader
        title="Главная"
        crumbs={[{ label: 'Главная' }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              aria-haspopup="menu"
              onClick={(e) => setAnchorImport(e.currentTarget)}
            >
              Импорт CSV
            </Button>
            <Menu
              anchorEl={anchorImport}
              open={Boolean(anchorImport)}
              onClose={() => setAnchorImport(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {eqTypes.map(t => (
                <MenuItem key={`imp-${t.key}`} onClick={() => { setAnchorImport(null); nav(t.to + '?import=1') }}>
                  {t.icon}&nbsp;&nbsp;{t.label}
                </MenuItem>
              ))}
            </Menu>

            <Button
              variant="contained"
              aria-haspopup="menu"
              onClick={(e) => setAnchorAdd(e.currentTarget)}
            >
              Добавить
            </Button>
            <Menu
              anchorEl={anchorAdd}
              open={Boolean(anchorAdd)}
              onClose={() => setAnchorAdd(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {eqTypes.map(t => (
                <MenuItem key={`add-${t.key}`} onClick={() => { setAnchorAdd(null); nav(t.to + '?add=1') }}>
                  {t.icon}&nbsp;&nbsp;{t.label}
                </MenuItem>
              ))}
            </Menu>
          </Stack>
        }
      />

      {/* Глобальный поиск */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          size="small"
          placeholder="Поиск по серийнику/модели (всё оборудование)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> as any }}
          fullWidth
        />
      </Paper>

      {/* === Новая полоса KPI: количество на складе по типам === */}
      <Box sx={grid('repeat(4, minmax(0, 1fr))', 12)}>
        <StatCard title="ТСД — на складе" value={onStockCounts.tsd} icon={<WarehouseIcon />} onClick={() => nav('/tsd')} />
        <StatCard title="Напалечные — на складе" value={onStockCounts.finger_scanners} icon={<QrCodeScannerIcon />} onClick={() => nav('/finger_scanners')} />
        <StatCard title="Настольные — на складе" value={onStockCounts.desktop_scanners} icon={<DocumentScannerIcon />} onClick={() => nav('/desktop_scanners')} />
        <StatCard title="Планшеты — на складе" value={onStockCounts.tablets} icon={<TabletMacIcon />} onClick={() => nav('/tablets')} />
      </Box>

      {/* Обзор по типам (последние записи) */}
      <Box sx={grid('repeat(2, minmax(0, 1fr))', 16)}>
        {eqTypes.map(({ key, icon, to, label }) => {
          const list = filteredLatestByType[key] || []
          return (
            <Section
              key={key}
              title={`${label} — последние`}
              action={<Button size="small" variant="text" onClick={() => nav(to)}>Все</Button>}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ color: 'text.secondary' }}>{icon}</Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Показаны последние записи. Поиск применяется ко всем типам.
                </Typography>
              </Box>
              <Table size="small" aria-label={`latest-${key}`} sx={{
                '& thead th': { textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 12, color: 'text.secondary' },
                '& tbody tr:nth-of-type(odd)': { backgroundColor: '#fafafa' }
              }}>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Внутр. ID</TableCell>
                    <TableCell>Модель</TableCell>
                    <TableCell>Серийник</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Нет данных</Typography></TableCell></TableRow>
                  ) : list.map((r) => (
                    <TableRow key={`${key}-${r.id}`} hover>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>{r.internal_id}</TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell>{r.serial_number}</TableCell>
                      <TableCell>{STATUS_LABELS[r.status]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )
        })}
      </Box>

      {/* Недавние отгрузки */}
      <Section title="Недавние отгрузки" action={<Button size="small" variant="text" onClick={() => nav('/shipments')}>Все</Button>}>
        <Table size="small" aria-label="recent-shipments" sx={{
          '& thead th': { textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 12, color: 'text.secondary' },
          '& tbody tr:nth-of-type(odd)': { backgroundColor: '#fafafa' }
        }}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Номер</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell>Позиций</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentShipments.length === 0 ? (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Пока нет отгрузок</Typography></TableCell></TableRow>
            ) : recentShipments.map(s => (
              <TableRow key={s.id} hover>
                <TableCell>{s.id}</TableCell>
                <TableCell>{s.shipment_number}</TableCell>
                <TableCell>{s.shipment_date}</TableCell>
                <TableCell>{s.items_count}</TableCell>
                <TableCell align="right">
                  <Tooltip title="PDF">
                    <IconButton size="small" onClick={async () => {
                      try {
                        // восстанавливаем состав отгрузки и генерим PDF (как раньше)
                        const { data: rel } = await supabase
                          .from('shipment_items')
                          .select('table_name,item_id')
                          .eq('shipment_id', s.id)

                        const grouped = (rel || []).reduce<Record<EquipmentTableName, number[]>>((acc, r: any) => {
                          (acc[r.table_name as EquipmentTableName] ||= []).push(r.item_id)
                          return acc
                        }, {} as any)

                        let items: EquipmentItem[] = []
                        for (const t of Object.keys(grouped) as EquipmentTableName[]) {
                          const ids = grouped[t]
                          if (!ids.length) continue
                          const { data } = await supabase.from(t).select('*').in('id', ids)
                          items = items.concat((data || []) as EquipmentItem[])
                        }

                        const first = (rel && rel[0]?.table_name) as EquipmentTableName | undefined
                        const title = first && (rel || []).every(r => r.table_name === first)
                          ? EQUIPMENT_TYPES[first].title
                          : 'Смешанные типы'

                        await generateShipmentPDF({
                          shipmentNumber: s.shipment_number,
                          shipmentDate: s.shipment_date,
                          items,
                          equipmentTitle: title
                        })
                      } catch { /* ignore */ }
                    }}>
                      <PictureAsPdfIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </Stack>
  )
}
