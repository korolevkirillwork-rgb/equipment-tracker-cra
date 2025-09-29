import * as React from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Paper, Stack, MenuItem, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, LinearProgress, Alert
} from '@mui/material'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { EquipmentTableName } from '../types'
import { EQUIPMENT_TYPES } from '../constants'

type Props = {
  open: boolean
  onClose: () => void
  onImported?: () => void
  /** Необязательный предустановленный тип (для вызовов вроде <ImportCsvDialog table={table} />) */
  table?: EquipmentTableName
}

type CsvRow = {
  internal_id?: string
  model?: string
  serial_number?: string
  status?: 'on_stock' | 'in_repair' | string
}

type RowWithMeta = CsvRow & {
  __row: number
  __errors: string[]
}

const TABLE_OPTIONS: { value: EquipmentTableName; label: string }[] = [
  { value: 'tsd', label: EQUIPMENT_TYPES.tsd.title },
  { value: 'finger_scanners', label: EQUIPMENT_TYPES.finger_scanners.title },
  { value: 'desktop_scanners', label: EQUIPMENT_TYPES.desktop_scanners.title },
  { value: 'tablets', label: EQUIPMENT_TYPES.tablets.title },
]

const REQUIRED_COLS = ['model', 'serial_number'] as const
const ACCEPT_STATUSES = new Set(['on_stock', 'in_repair'])

type LastBatch = { table: EquipmentTableName; ids: number[]; ts: number }
const LAST_BATCH_KEY = 'lastImportBatch/v1'

export default function ImportCsvDialog({ open, onClose, onImported, table: tableProp }: Props) {
  // локальный стейт типа таблицы; если проп передан — предустанавливаем
  const [table, setTable] = React.useState<EquipmentTableName>(tableProp ?? 'tsd')

  // при каждом открытии диалога синхронизируемся с пропом, если он задан
  React.useEffect(() => {
    if (open && tableProp) setTable(tableProp)
  }, [open, tableProp])

  const [fileName, setFileName] = React.useState<string>('')
  const [rows, setRows] = React.useState<RowWithMeta[]>([])
  const [parsing, setParsing] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const lastBatch = React.useMemo<LastBatch | null>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_BATCH_KEY) || 'null') } catch { return null }
  }, [open])

  const hasErrors = rows.some(r => r.__errors.length > 0)
  const validRows = rows.filter(r => r.__errors.length === 0)

  const resetState = () => {
    setFileName('')
    setRows([])
    setParsing(false)
    setChecking(false)
    setImporting(false)
    setMessage(null)
  }

  const close = () => {
    resetState()
    onClose()
  }

  function normalizeHeader(h: string) {
    return h.trim().toLowerCase().replace(/\s+/g, '_')
  }

  function pick<T extends object>(obj: T, keys: string[]) {
    const out: any = {}
    for (const k of keys) out[k] = (obj as any)[k]
    return out
  }

  const handleFile = (file: File) => {
    setParsing(true)
    setMessage(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: async (res) => {
        setParsing(false)
        if (res.errors?.length) {
          setMessage({ type: 'error', text: 'Ошибка разбора CSV: проверьте формат и разделители' })
          return
        }
        const raw: CsvRow[] = (res.data as any[]).map(d => pick(d, ['internal_id', 'model', 'serial_number', 'status']))

        // базовая валидация + нормализация
        const withMeta: RowWithMeta[] = raw.map((r, idx) => {
          const errs: string[] = []
          for (const col of REQUIRED_COLS) {
            if (!String((r as any)[col] ?? '').trim()) errs.push(`Пустое поле ${col}`)
          }
          const status = String(r.status ?? 'on_stock').trim().toLowerCase()
          if (status && !ACCEPT_STATUSES.has(status)) errs.push(`Некорректный status: ${r.status}`)
          return {
            __row: idx + 2,
            __errors: errs,
            internal_id: String(r.internal_id ?? '').trim() || undefined,
            model: String(r.model ?? '').trim() || undefined,
            serial_number: String(r.serial_number ?? '').trim() || undefined,
            status: (status as any) || 'on_stock'
          }
        })

        // дубликаты внутри файла по serial_number
        const seen = new Map<string, number>()
        for (const r of withMeta) {
          const sn = (r.serial_number || '').toUpperCase()
          if (!sn) continue
          if (seen.has(sn)) {
            r.__errors.push(`Дубликат серийника в файле (строка ${seen.get(sn)})`)
          } else {
            seen.set(sn, r.__row)
          }
        }

        setRows(withMeta)
        await checkDbDuplicates(withMeta)
      }
    })
  }

  async function checkDbDuplicates(list: RowWithMeta[]) {
    const serials = Array.from(new Set(list.map(r => (r.serial_number || '').trim()).filter(Boolean)))
    if (serials.length === 0) return
    setChecking(true)
    try {
      const batchSize = 500
      const existing = new Set<string>()
      for (let i = 0; i < serials.length; i += batchSize) {
        const chunk = serials.slice(i, i + batchSize)
        const { data, error } = await supabase
          .from(table)
          .select('serial_number')
          .in('serial_number', chunk)
        if (error) throw new Error(error.message)
        for (const d of (data || [])) existing.add(String(d.serial_number).trim().toUpperCase())
      }
      setRows(prev => prev.map(r => {
        const sn = (r.serial_number || '').trim().toUpperCase()
        if (sn && existing.has(sn)) {
          return { ...r, __errors: [...r.__errors, 'Серийник уже существует в базе'] }
        }
        return r
      }))
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Ошибка проверки в БД: ' + (e.message || e) })
    } finally {
      setChecking(false)
    }
  }

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFileName(f.name)
      handleFile(f)
    }
  }

  const importValid = async () => {
    if (validRows.length === 0) {
      setMessage({ type: 'error', text: 'Нет валидных строк для импорта' })
      return
    }
    setImporting(true)
    setMessage(null)
    try {
      const batchSize = 500
      const insertedIds: number[] = []
      for (let i = 0; i < validRows.length; i += batchSize) {
        const chunk = validRows.slice(i, i + batchSize)
        const payload = chunk.map(r => ({
          internal_id: r.internal_id || null,
          model: r.model!,
          serial_number: r.serial_number!,
          status: (r.status === 'in_repair' ? 'in_repair' : 'on_stock') as 'on_stock'|'in_repair'
        }))
        const { data, error } = await supabase
          .from(table)
          .insert(payload)
          .select('id')
        if (error) throw new Error(error.message)
        for (const d of (data || [])) insertedIds.push(Number(d.id))
      }

      const batch: LastBatch = { table, ids: insertedIds, ts: Date.now() }
      localStorage.setItem(LAST_BATCH_KEY, JSON.stringify(batch))

      setMessage({ type: 'success', text: `Импортировано: ${insertedIds.length} из ${validRows.length}` })
      if (onImported) onImported()
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Ошибка импорта: ' + (e.message || e) })
    } finally {
      setImporting(false)
    }
  }

  const rollbackLast = async () => {
    const lb = lastBatch
    if (!lb) {
      setMessage({ type: 'info', text: 'Нет данных для отката' })
      return
    }
    if (!window.confirm(`Удалить ${lb.ids.length} записей (${EQUIPMENT_TYPES[lb.table].title}) из последнего импорта?`)) return
    setImporting(true)
    setMessage(null)
    try {
      if (lb.ids.length > 0) {
        const batchSize = 500
        for (let i = 0; i < lb.ids.length; i += batchSize) {
          const chunk = lb.ids.slice(i, i + batchSize)
          const { error } = await supabase.from(lb.table).delete().in('id', chunk)
          if (error) throw new Error(error.message)
        }
      }
      localStorage.removeItem(LAST_BATCH_KEY)
      setMessage({ type: 'success', text: 'Откат выполнен' })
      if (onImported) onImported()
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Ошибка отката: ' + (e.message || e) })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
      <DialogTitle>Импорт CSV</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
          <TextField
            select
            size="small"
            label="Тип оборудования"
            value={table}
            onChange={(e) => setTable(e.target.value as EquipmentTableName)}
            sx={{ minWidth: 260 }}
          >
            {TABLE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={onSelectFile}
          />
          <Button variant="outlined" onClick={() => inputRef.current?.click()}>
            Выбрать CSV
          </Button>
          <Typography variant="body2" color="text.secondary">{fileName || 'Файл не выбран'}</Typography>

          <Box flexGrow={1} />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="error" onClick={rollbackLast} disabled={importing}>
              Откатить последний импорт
            </Button>
            <Button variant="contained" onClick={importValid} disabled={importing || parsing || checking || validRows.length === 0}>
              Импортировать валидные ({validRows.length})
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Требуемые колонки: model, serial_number. Допустимые: internal_id, status (on_stock | in_repair)</Typography>
          {(parsing || checking || importing) && <LinearProgress sx={{ mb: 2 }} />}

          {message && (
            <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>
          )}

          <Box sx={{ maxHeight: 380, overflow: 'auto', borderRadius: 1, border: '1px solid #eee' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>internal_id</TableCell>
                  <TableCell>model</TableCell>
                  <TableCell>serial_number</TableCell>
                  <TableCell>status</TableCell>
                  <TableCell>Ошибки</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary">Загрузите CSV для предпросмотра</Typography>
                    </TableCell>
                  </TableRow>
                ) : rows.map((r, idx) => (
                  <TableRow key={idx} selected={r.__errors.length > 0}>
                    <TableCell>{r.__row}</TableCell>
                    <TableCell>{r.internal_id || <span style={{ color:'#999' }}>—</span>}</TableCell>
                    <TableCell>{r.model || <span style={{ color:'#999' }}>—</span>}</TableCell>
                    <TableCell>{r.serial_number || <span style={{ color:'#999' }}>—</span>}</TableCell>
                    <TableCell>{r.status || 'on_stock'}</TableCell>
                    <TableCell>
                      {r.__errors.length === 0 ? (
                        <Chip size="small" color="success" label="OK" />
                      ) : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {r.__errors.map((e, i) => <Chip key={i} size="small" color="error" variant="outlined" label={e} />)}
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  )
}
