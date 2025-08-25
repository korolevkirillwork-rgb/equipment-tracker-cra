import * as React from 'react'
import { Box, Paper } from '@mui/material'
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
import { supabase } from '../lib/supabase'
import { EquipmentItem, EquipmentTableName } from '../types'
import { EQUIPMENT_TYPES } from '../constants'
import SmartGridToolbar from '../components/SmartGridToolbar'

type Density = 'compact' | 'standard' | 'comfortable'

type Row = EquipmentItem & {
  table: EquipmentTableName
  tableTitle: string
}

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
    const p = JSON.parse(raw)
    return {
      paginationModel: p.paginationModel ?? { page: 0, pageSize: 25 },
      filterModel: p.filterModel ?? { items: [], quickFilterValues: [] },
      sortModel: p.sortModel ?? [],
      columnVisibilityModel: p.columnVisibilityModel ?? {},
      density: (p.density as Density) ?? 'comfortable',
    }
  } catch {
    return null
  }
}
function saveState(key: string, state: PersistedState) {
  try { window.localStorage.setItem(key, JSON.stringify(state)) } catch {}
}

export default function Shipped() {
  const storageKey = 'grid:shipped'
  const persisted = loadState(storageKey)

  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selection, setSelection] = React.useState<GridRowId[]>([])

  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>(
    persisted?.paginationModel ?? { page: 0, pageSize: 25 }
  )
  const [filterModel, setFilterModel] = React.useState<GridFilterModel>(
    persisted?.filterModel ?? { items: [], quickFilterValues: [] }
  )
  const [sortModel, setSortModel] = React.useState<GridSortModel>(persisted?.sortModel ?? [])
  const [columnVisibilityModel, setColumnVisibilityModel] = React.useState<GridColumnVisibilityModel>(
    persisted?.columnVisibilityModel ?? {}
  )
  const [density, setDensity] = React.useState<Density>(persisted?.density ?? 'comfortable')

  const fetchAll = React.useCallback(async () => {
    setLoading(true)
    const acc: Row[] = []
    for (const t of Object.values(EQUIPMENT_TYPES)) {
      const { data, error } = await supabase
        .from(t.table)
        .select('*')
        .eq('status', 'in_repair')
        .order('id', { ascending: false })
      if (!error && data) {
        (data as EquipmentItem[]).forEach((d) =>
          acc.push({ ...d, table: t.table, tableTitle: t.title })
        )
      }
    }
    setRows(acc)
    setLoading(false)
    setSelection([])
  }, [])

  React.useEffect(() => { fetchAll() }, [fetchAll])

  React.useEffect(() => {
    saveState(storageKey, {
      paginationModel, filterModel, sortModel, columnVisibilityModel, density
    })
  }, [storageKey, paginationModel, filterModel, sortModel, columnVisibilityModel, density])

  const columns = React.useMemo<GridColDef<Row>[]>(() => [
    { field: 'tableTitle', headerName: 'Тип', minWidth: 160, flex: 1 },
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'internal_id', headerName: 'Внутр. ID', minWidth: 140, flex: 1 },
    { field: 'model', headerName: 'Модель', minWidth: 180, flex: 1 },
    { field: 'serial_number', headerName: 'Серийный номер', minWidth: 180, flex: 1 },
  ], [])

  // совместим сигнатуру тулбара с DataGrid
  const ToolbarWrapper = React.useCallback(
    (_props: GridToolbarProps) => (
      <SmartGridToolbar selectionCount={selection.length} fileName="shipped_equipment" />
    ),
    [selection.length]
  )

  return (
    <Box>
      <Paper variant="outlined">
        <div style={{ width: '100%' }}>
          <DataGrid
            autoHeight
            rows={rows}
            getRowId={(r) => `${r.table}:${r.id}`}
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
    </Box>
  )
}
