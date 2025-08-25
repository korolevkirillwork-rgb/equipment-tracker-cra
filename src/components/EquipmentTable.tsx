import * as React from 'react'
import { Box, Button, Chip, Stack, Paper } from '@mui/material'
import {
  DataGrid,
  GridColDef,
  GridRowId,
  GridColumnVisibilityModel,
  GridPaginationModel,
  GridFilterModel,
  GridSortModel,
  GridToolbarProps,
} from '@mui/x-data-grid'
import { ruRU } from '@mui/x-data-grid/locales'
import { STATUS_LABELS, EQUIPMENT_TYPES } from '../constants'
import { EquipmentItem, EquipmentTableName } from '../types'
import AddEquipmentForm from './AddEquipmentForm'
import ShipmentModal from './ShipmentModal'
import useShipEquipment from '../utils/useShipEquipment'
import Notification from './Notification'
import SmartGridToolbar from './SmartGridToolbar'
import ImportCsvDialog from './ImportCsvDialog'
import { generateLabelsPDF, generateThermalLabelsPDF50 } from '../utils/pdf'
import { listOnStock, deleteItems } from '../offline/adapter'

type Density = 'compact' | 'standard' | 'comfortable'

type PersistedState = {
  paginationModel: GridPaginationModel
  filterModel: GridFilterModel
  sortModel: GridSortModel
  columnVisibilityModel: GridColumnVisibilityModel
  density: Density
}

function loadState(key: string): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      paginationModel: parsed.paginationModel ?? { page: 0, pageSize: 25 },
      filterModel: parsed.filterModel ?? { items: [], quickFilterValues: [] },
      sortModel: parsed.sortModel ?? [],
      columnVisibilityModel: parsed.columnVisibilityModel ?? { id: false },
      density: (parsed.density as Density) ?? 'comfortable',
    }
  } catch { return null }
}
function saveState(key: string, state: PersistedState) { try { localStorage.setItem(key, JSON.stringify(state)) } catch {} }

export default function EquipmentTable({ table }: { table: EquipmentTableName }) {
  const storageKey = `grid:${table}`
  const persisted = loadState(storageKey)

  const [rows, setRows] = React.useState<EquipmentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selection, setSelection] = React.useState<GridRowId[]>([])
  const [addOpen, setAddOpen] = React.useState(false)
  const [shipOpen, setShipOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [notif, setNotif] = React.useState<{open: boolean, msg: string, sev: 'success'|'error'|'info'|'warning'}>({
    open: false, msg: '', sev: 'success'
  })

  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>(persisted?.paginationModel ?? { page: 0, pageSize: 25 })
  const [filterModel, setFilterModel] = React.useState<GridFilterModel>(persisted?.filterModel ?? { items: [], quickFilterValues: [] })
  const [sortModel, setSortModel] = React.useState<GridSortModel>(persisted?.sortModel ?? [])
  const [columnVisibilityModel, setColumnVisibilityModel] = React.useState<GridColumnVisibilityModel>(persisted?.columnVisibilityModel ?? { id: false })
  const [density, setDensity] = React.useState<Density>(persisted?.density ?? 'comfortable')

  const { ship } = useShipEquipment()
  const title = EQUIPMENT_TYPES[table].title

  const fetchRows = React.useCallback(async () => {
    setLoading(true)
    const data = await listOnStock(table)
    setRows(data)
    setSelection([])
    setLoading(false)
  }, [table])

  React.useEffect(() => { fetchRows() }, [fetchRows])
  React.useEffect(() => {
    saveState(storageKey, { paginationModel, filterModel, sortModel, columnVisibilityModel, density })
  }, [storageKey, paginationModel, filterModel, sortModel, columnVisibilityModel, density])

  const handleDelete = async () => {
    if (selection.length === 0) return
    if (!window.confirm(`Удалить ${selection.length} элемент(а)?`)) return
    try {
      const ids = selection.map(Number)
      await deleteItems(table, ids)
      setNotif({ open: true, msg: 'Удалено (синхронизация при онлайн)', sev: 'success' })
      fetchRows()
    } catch (e: any) {
      setNotif({ open: true, msg: e?.message || 'Ошибка удаления', sev: 'error' })
    }
  }

  const handleShip = async (shipmentNumber: string, shipmentDate: string) => {
    try {
      const ids = new Set(selection.map(Number))
      const items = rows.filter(r => ids.has(r.id))
      await ship({ table, selectedItems: items, shipmentNumber, shipmentDate, equipmentTitle: title })
      setShipOpen(false)
      setNotif({ open: true, msg: 'Отгрузка оформлена (PDF сохранён, синхр. при онлайн)', sev: 'success' })
      await fetchRows()
    } catch (e: any) {
      setNotif({ open: true, msg: e?.message || 'Ошибка отгрузки', sev: 'error' })
    }
  }

  const handlePrintLabelsA4 = async () => {
    if (selection.length === 0) return
    const ids = new Set(selection.map(Number))
    const items = rows.filter(r => ids.has(r.id))
    try {
      await generateLabelsPDF({ items, title, cols: 3, rows: 8, qrField: 'composed', tableName: table })
      setNotif({ open: true, msg: 'PDF с этикетками (A4) сохранён', sev: 'success' })
    } catch (e: any) {
      setNotif({ open: true, msg: e?.message || 'Не удалось сформировать PDF', sev: 'error' })
    }
  }

  const handlePrintLabels50 = async () => {
    if (selection.length === 0) return
    const ids = new Set(selection.map(Number))
    const items = rows.filter(r => ids.has(r.id))
    try {
      await generateThermalLabelsPDF50({ items, title, qrField: 'serial_number', tableName: table })
      setNotif({ open: true, msg: 'PDF 50×50 сохранён', sev: 'success' })
    } catch (e: any) {
      setNotif({ open: true, msg: e?.message || 'Не удалось сформировать PDF 50×50', sev: 'error' })
    }
  }

  const columns = React.useMemo<GridColDef<EquipmentItem>[]>(() => [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'internal_id', headerName: 'Внутр. ID', flex: 1, minWidth: 140 },
    { field: 'model', headerName: 'Модель', flex: 1, minWidth: 180 },
    { field: 'serial_number', headerName: 'Серийный номер', flex: 1, minWidth: 180 },
    { field: 'status', headerName: 'Статус', width: 140, sortable: false,
      renderCell: (p) => (<Chip size="small" color="success" label={STATUS_LABELS[p.value as 'on_stock' | 'in_repair']} />)
    }
  ], [])

  const ToolbarWrapper = React.useCallback(
    (_props: GridToolbarProps) => (<SmartGridToolbar selectionCount={selection.length} fileName={`equipment_${table}`} />),
    [selection.length, table]
  )

  return (
    <Box>
      <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
        <Button variant="contained" onClick={() => setAddOpen(true)}>Добавить</Button>
        <Button variant="outlined" onClick={() => setImportOpen(true)}>Импорт CSV</Button>
        <Button variant="outlined" onClick={handlePrintLabelsA4} disabled={selection.length === 0}>Печать A4</Button>
        <Button variant="outlined" onClick={handlePrintLabels50} disabled={selection.length === 0}>Печать 50×50</Button>
        <Button variant="outlined" color="error" onClick={handleDelete} disabled={selection.length === 0}>Удалить</Button>
        <Button variant="outlined" onClick={() => setShipOpen(true)} disabled={selection.length === 0}>Отгрузить</Button>
      </Stack>

      <Paper variant="outlined">
        <div style={{ width: '100%' }}>
          <DataGrid
            autoHeight
            rows={rows}
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
            slots={{ toolbar: ToolbarWrapper }}
            localeText={ruRU.components.MuiDataGrid.defaultProps.localeText}
          />
        </div>
      </Paper>

      <AddEquipmentForm open={addOpen} onClose={() => setAddOpen(false)} table={table} onAdded={fetchRows} />
      <ShipmentModal open={shipOpen} onClose={() => setShipOpen(false)} onConfirm={handleShip} />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} table={table} onImported={fetchRows} />
      <Notification open={notif.open} message={notif.msg} severity={notif.sev} onClose={() => setNotif(s => ({...s, open:false}))} />
    </Box>
  )
}
