import * as React from 'react'
import { Box, Paper, Stack, TextField, IconButton, Tooltip } from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import {
  DataGrid,
  GridColDef,
  GridRowId,
  GridColumnVisibilityModel,
  GridPaginationModel,
  GridFilterModel,
  GridSortModel,
  GridToolbarProps,
  GridRowParams,
} from '@mui/x-data-grid'
import { ruRU } from '@mui/x-data-grid/locales'
import SmartGridToolbar from '../components/SmartGridToolbar'
import { EquipmentItem, EquipmentTableName } from '../types'
import { EQUIPMENT_TYPES } from '../constants'
import { generateShipmentPDF } from '../utils/pdf'
import ShipmentDetailsDrawer from '../components/ShipmentDetailsDrawer'
import { listShipments, getShipmentDetails } from '../offline/adapter'

type Density = 'compact' | 'standard' | 'comfortable'

export type ShipmentRow = {
  id: number
  shipment_number: string
  shipment_date: string
  items_count: number
}

type PersistedState = {
  paginationModel: GridPaginationModel
  filterModel: GridFilterModel
  sortModel: GridSortModel
  columnVisibilityModel: GridColumnVisibilityModel
  density: Density
  fromDate?: string
  toDate?: string
}

function loadState(key: string): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw)
    return {
      paginationModel: p.paginationModel ?? { page: 0, pageSize: 25 },
      filterModel: p.filterModel ?? { items: [], quickFilterValues: [] },
      sortModel: p.sortModel ?? [{ field: 'id', sort: 'desc' }],
      columnVisibilityModel: p.columnVisibilityModel ?? {},
      density: (p.density as Density) ?? 'comfortable',
      fromDate: p.fromDate, toDate: p.toDate,
    }
  } catch { return null }
}
function saveState(key: string, state: PersistedState) { try { localStorage.setItem(key, JSON.stringify(state)) } catch {} }

export default function Shipments() {
  const storageKey = 'grid:shipments'
  const persisted = loadState(storageKey)

  const [rows, setRows] = React.useState<ShipmentRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selection, setSelection] = React.useState<GridRowId[]>([])

  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>(persisted?.paginationModel ?? { page: 0, pageSize: 25 })
  const [filterModel, setFilterModel] = React.useState<GridFilterModel>(persisted?.filterModel ?? { items: [], quickFilterValues: [] })
  const [sortModel, setSortModel] = React.useState<GridSortModel>(persisted?.sortModel ?? [{ field: 'id', sort: 'desc' }])
  const [columnVisibilityModel, setColumnVisibilityModel] = React.useState<GridColumnVisibilityModel>(persisted?.columnVisibilityModel ?? {})
  const [density, setDensity] = React.useState<Density>(persisted?.density ?? 'comfortable')

  const [fromDate, setFromDate] = React.useState<string>(persisted?.fromDate || '')
  const [toDate, setToDate] = React.useState<string>(persisted?.toDate || '')

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [drawerShipment, setDrawerShipment] = React.useState<{ id: number; shipment_number: string; shipment_date: string } | null>(null)

  const fetchShipments = React.useCallback(async () => {
    setLoading(true)
    const list = await listShipments()
    const countsMap = new Map<number, number>()
    const { db } = await import('../offline/db')
    const allItems = await db.shipment_items.toArray()
    allItems.forEach(si => countsMap.set(si.shipment_id, (countsMap.get(si.shipment_id) || 0) + 1))
    const withCounts: ShipmentRow[] = list.map(s => ({ ...s, items_count: countsMap.get(s.id) || 0 }))
    setRows(withCounts)
    setLoading(false)
    setSelection([])
  }, [])

  React.useEffect(() => { fetchShipments() }, [fetchShipments])

  React.useEffect(() => {
    saveState(storageKey, { paginationModel, filterModel, sortModel, columnVisibilityModel, density, fromDate, toDate })
  }, [storageKey, paginationModel, filterModel, sortModel, columnVisibilityModel, density, fromDate, toDate])

  const filteredRows = React.useMemo(() => {
    const from = fromDate ? new Date(fromDate) : null
    const to = toDate ? new Date(toDate) : null
    return rows.filter(r => {
      const d = new Date(r.shipment_date)
      if (from && d < from) return false
      if (to) { const end = new Date(to); end.setHours(23,59,59,999); if (d > end) return false }
      return true
    })
  }, [rows, fromDate, toDate])

  const regeneratePDF = React.useCallback(async (shipment: ShipmentRow) => {
    const details = await getShipmentDetails(shipment.id)
    const items = details.items
    const firstTable = items[0]?.table_name as EquipmentTableName | undefined
    const sameType = firstTable && items.every(i => i.table_name === firstTable)
    const title = sameType ? EQUIPMENT_TYPES[firstTable!].title : 'Смешанные типы'
    await generateShipmentPDF({
      shipmentNumber: shipment.shipment_number,
      shipmentDate: shipment.shipment_date,
      items: items as unknown as EquipmentItem[],
      equipmentTitle: title
    })
  }, [])

  const columns = React.useMemo<GridColDef<ShipmentRow>[]>(() => [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'shipment_number', headerName: 'Номер', minWidth: 140, flex: 1 },
    { field: 'shipment_date', headerName: 'Дата', minWidth: 140, flex: 1 },
    { field: 'items_count', headerName: 'Позиций', width: 120, type: 'number' },
    {
      field: 'actions', headerName: 'Действия', width: 120, sortable: false, filterable: false,
      renderCell: (params) => (
        <Tooltip title="Сформировать PDF">
          <IconButton size="small" onClick={() => regeneratePDF(params.row)}>
            <PictureAsPdfIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ], [regeneratePDF])

  const ToolbarWrapper = React.useCallback(
    (_props: GridToolbarProps) => (<SmartGridToolbar selectionCount={selection.length} fileName="shipments" />),
    [selection.length]
  )

  const onRowClick = React.useCallback((p: GridRowParams<ShipmentRow>) => {
    setDrawerShipment({ id: p.row.id, shipment_number: p.row.shipment_number, shipment_date: p.row.shipment_date })
    setDrawerOpen(true)
  }, [])

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={1}>
        <TextField label="С даты" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
        <TextField label="По дату" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
      </Stack>

      <Paper variant="outlined">
        <div style={{ width: '100%' }}>
          <DataGrid
            autoHeight
            rows={filteredRows}
            columns={columns}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
            density={density}
            onDensityChange={(d) => setDensity(d as Density)}
            pageSizeOptions={[10, 25, 50, 100]}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            rowSelectionModel={selection}
            onRowSelectionModelChange={(m) => setSelection(m as GridRowId[])}
            onRowClick={onRowClick}
            slots={{ toolbar: ToolbarWrapper }}
            localeText={ruRU.components.MuiDataGrid.defaultProps.localeText}
          />
        </div>
      </Paper>

      <ShipmentDetailsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} shipment={drawerShipment} />
    </Box>
  )
}
