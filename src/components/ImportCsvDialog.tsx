import * as React from 'react'
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, Typography, Alert, Paper, LinearProgress
} from '@mui/material'
import { EquipmentItem, EquipmentTableName } from '../types'
import { STATUS_LABELS } from '../constants'
import { insertItems, findExistingSerials } from '../offline/adapter'

type ParsedRow = {
  internal_id: string
  model: string
  serial_number: string
  status?: 'on_stock' | 'in_repair'
  __line: number
}

type Props = {
  open: boolean
  onClose: () => void
  table: EquipmentTableName
  onImported: () => void
}

function detectDelimiter(headerLine: string) {
  const comma = (headerLine.match(/,/g) || []).length
  const semicolon = (headerLine.match(/;/g) || []).length
  return semicolon > comma ? ';' : ','
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === delimiter && !inQuotes) { out.push(cur); cur = '' }
    else { cur += ch }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function parseCsv(text: string): { headers: string[], rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter).map(h => h.trim())
  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const arr = splitCsvLine(lines[i], delimiter)
    if (arr.every(c => c === '')) continue
    rows.push(arr)
  }
  return { headers, rows }
}

async function readFileAsTextSmart(file: File): Promise<string> {
  const utf8 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
  if (utf8.includes('\uFFFD')) {
    try {
      const win1251 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.readAsText(file, 'windows-1251')
        r.onload = () => resolve(String(r.result || ''))
        r.onerror = () => reject(r.error)
      })
      return win1251
    } catch {}
  }
  return utf8
}

function toTemplateCsv(): string {
  return [
    'internal_id,model,serial_number,status',
    'TSD-001,Newland MT90,ABC123456,on_stock',
    'TSD-002,Newland MT90,ABC123457,on_stock'
  ].join('\r\n')
}

export default function ImportCsvDialog({ open, onClose, table, onImported }: Props) {
  const [fileName, setFileName] = React.useState<string>('')
  const [parsed, setParsed] = React.useState<ParsedRow[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const [skipDuplicates, setSkipDuplicates] = React.useState(true)
  const [dupSerials, setDupSerials] = React.useState<string[]>([])
  const [summary, setSummary] = React.useState<string>('')

  const resetState = React.useCallback(() => {
    setFileName('')
    setParsed([])
    setErrors([])
    setLoading(false)
    setSkipDuplicates(true)
    setDupSerials([])
    setSummary('')
  }, [])

  React.useEffect(() => { if (!open) resetState() }, [open, resetState])

  const onDrop = React.useCallback(async (f: File) => {
    resetState(); setFileName(f.name); setLoading(true)
    try {
      const text = await readFileAsTextSmart(f)
      const { headers, rows } = parseCsv(text)
      const headersLC = headers.map(h => h.trim().toLowerCase())
      const required = ['internal_id', 'model', 'serial_number']
      const missing = required.filter(r => !headersLC.includes(r))
      if (missing.length) {
        setErrors([`Не найдены колонки: ${missing.join(', ')}`, 'Ожидаемые: internal_id, model, serial_number[, status]'])
        setLoading(false)
        return
      }

      const idx = {
        internal_id: headersLC.indexOf('internal_id'),
        model: headersLC.indexOf('model'),
        serial_number: headersLC.indexOf('serial_number'),
        status: headersLC.indexOf('status'),
      }

      const list: ParsedRow[] = []
      const errs: string[] = []
      rows.forEach((r, i) => {
        const line = i + 2
        const rec: ParsedRow = {
          internal_id: r[idx.internal_id]?.trim() || '',
          model: r[idx.model]?.trim() || '',
          serial_number: r[idx.serial_number]?.trim() || '',
          status: idx.status >= 0 ? (r[idx.status]?.trim() as any) : 'on_stock',
          __line: line,
        }
        if (!rec.internal_id || !rec.model || !rec.serial_number) {
          errs.push(`Строка ${line}: пустые значения`)
        } else if (rec.status && rec.status !== 'on_stock' && rec.status !== 'in_repair') {
          errs.push(`Строка ${line}: недопустимый статус "${rec.status}"`)
        } else {
          list.push(rec)
        }
      })

      if (list.length === 0) {
        setErrors(errs.length ? errs : ['Нет валидных строк'])
        setLoading(false)
        return
      }

      const sers = Array.from(new Set(list.map(x => x.serial_number)))
      const existing = await findExistingSerials(table, sers)
      setDupSerials(existing)

      setParsed(list)
      setErrors(errs)
    } catch (e: any) {
      setErrors(['Ошибка чтения/разбора CSV: ' + (e?.message || String(e))])
    } finally {
      setLoading(false)
    }
  }, [resetState, table])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) onDrop(f)
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setLoading(true); setSummary('')
    try {
      const toInsert = parsed
        .filter(r => (skipDuplicates ? !dupSerials.includes(r.serial_number) : true))
        .map(r => ({
          internal_id: r.internal_id,
          model: r.model,
          serial_number: r.serial_number,
          status: r.status || 'on_stock'
        } as Omit<EquipmentItem, 'id'>))

      if (toInsert.length === 0) {
        setSummary('Все строки — дубликаты. Нечего импортировать.')
        setLoading(false)
        return
      }

      await insertItems(table, toInsert)
      const skipped = parsed.length - toInsert.length
      setSummary(`Импорт завершён. Добавлено: ${toInsert.length}. Пропущено: ${skipped}.`)
      onImported()
    } catch (e: any) {
      setErrors(['Сбой импорта: ' + (e?.message || String(e))])
    } finally {
      setLoading(false)
    }
  }

  const dropRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = dropRef.current; if (!el) return
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    const onDropEvt = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation()
      const f = e.dataTransfer?.files?.[0]; if (f) onDrop(f)
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDropEvt)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDropEvt)
    }
  }, [onDrop])

  const previewCount = Math.min(5, parsed.length)
  const preview = parsed.slice(0, previewCount)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Импорт CSV — {table.toUpperCase()}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" component="label">
              Выбрать CSV
              <input type="file" hidden accept=".csv,text/csv" onChange={handleFileInput} />
            </Button>
            <Button variant="text" onClick={() => {
              const blob = new Blob([toTemplateCsv()], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `template_${table}.csv`
              document.body.appendChild(a); a.click(); a.remove()
              URL.revokeObjectURL(url)
            }}>Скачать шаблон</Button>
          </Stack>

          <Box
            ref={dropRef}
            sx={{ p: 2, border: '2px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center', bgcolor: 'background.paper' }}
          >
            <Typography variant="body2" color="text.secondary">
              Перетащите CSV или выберите файл. Заголовки: <b>internal_id, model, serial_number[, status]</b>.
            </Typography>
            {fileName && <Typography mt={1}>Файл: <b>{fileName}</b></Typography>}
          </Box>

          {loading && <LinearProgress />}

          {errors.length > 0 && (
            <Alert severity="error">
              <Stack>{errors.map((e, i) => <span key={i}>{e}</span>)}</Stack>
            </Alert>
          )}

          {parsed.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Предпросмотр ({preview.length} из {parsed.length}):
              </Typography>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 6 }}>#</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Внутр. ID</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Модель</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Серийный номер</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 6 }}>{r.__line}</td>
                      <td style={{ padding: 6 }}>{r.internal_id}</td>
                      <td style={{ padding: 6 }}>{r.model}</td>
                      <td style={{ padding: 6 }}>{r.serial_number}</td>
                      <td style={{ padding: 6 }}>{STATUS_LABELS[r.status || 'on_stock']}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
              {dupSerials.length > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Найдено дубликатов SN в БД/кеше: <b>{dupSerials.length}</b>. Они будут {skipDuplicates ? 'пропущены' : 'импортированы'}.
                  <Box mt={1}>
                    <Button size="small" variant="outlined" onClick={() => setSkipDuplicates(s => !s)}>
                      {skipDuplicates ? 'Не пропускать' : 'Пропускать'} дубликаты
                    </Button>
                  </Box>
                </Alert>
              )}
            </Paper>
          )}

          {summary && <Alert severity="success">{summary}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
        <Button onClick={handleImport} variant="contained" disabled={parsed.length === 0 || loading}>
          Импортировать {parsed.length > 0 ? `(${parsed.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
