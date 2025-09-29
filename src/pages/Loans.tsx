import * as React from 'react'
import {
  Box, Stack, TextField, Button, Tabs, Tab, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Checkbox, Typography, IconButton, Tooltip, Snackbar, Alert, Switch, ToggleButton, ToggleButtonGroup, Chip
} from '@mui/material'
import PageHeader from '../components/PageHeader'
import Section from '../components/Section'
import { EquipmentItem, EquipmentTableName } from '../types'
import { fetchAvailable, fetchActiveByType, fetchComments, issueItems, returnOne, ActiveLoanRow } from '../lib/loansApi'
import NoteDialog from '../components/NoteDialog'
import CommentHistoryDrawer from '../components/CommentHistoryDrawer'
import HistoryIcon from '@mui/icons-material/History'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import { STATUS_LABELS, EQUIPMENT_TYPES } from '../constants'
import { useHidScanner } from '../hooks/useHidScanner'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

type TType = Extract<EquipmentTableName, 'tsd' | 'finger_scanners'>
type Mode = 'issue' | 'return'

// UI-тип: «на руках», но с optional internal_id (если витрина его не вернула)
type ActiveLoanRowUI = ActiveLoanRow & { internal_id?: string | null }

// ===== утилиты =====
const ru2enMap: Record<string, string> = {
  'ё':'`','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','0':'0','-':'-','=':'=',
  'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p','х':'[','ъ':']',
  'ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l','ж':';','э':'\'',
  'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m','б':',','ю':'.','/':'/',
}
function normalizeSerialInput(s: string) {
  const low = s.toLowerCase()
  let out = ''
  for (const ch of low) out += ru2enMap[ch] ?? ch
  return out.toUpperCase().trim()
}

// === валидация ID исполнителя ===
const MAX_OPERATOR_ID = 9000000
function isValidOperatorId(s: string) {
  const t = (s ?? '').trim()
  if (!/^\d+$/.test(t)) return false
  if (t.length > 7) return false
  const n = Number(t)
  return n > 0 && n <= MAX_OPERATOR_ID
}

function useBeep() {
  const ctxRef = React.useRef<AudioContext | null>(null)
  const ensureCtx = () => (ctxRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)())
  const play = (freq: number, durMs = 100) => {
    try {
      const ctx = ensureCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.value = 0.08
      osc.start()
      setTimeout(() => { osc.stop() }, durMs)
    } catch {}
  }
  return {
    ok: () => play(880, 90),
    err: () => { play(200, 120); setTimeout(() => play(160, 160), 120) }
  }
}

function useLoansData(t: TType) {
  const q = useQuery({ queryKey: ['available', t], queryFn: () => fetchAvailable(t) })
  const q2 = useQuery({ queryKey: ['active', t],    queryFn: () => fetchActiveByType(t) })
  return {
    available: (q.data ?? []) as EquipmentItem[],
    active:    (q2.data ?? []) as ActiveLoanRowUI[],
    loading: q.isLoading || q2.isLoading,
    refetch: async () => { await Promise.all([q.refetch(), q2.refetch()]) }
  }
}

export default function Loans() {
  const queryClient = useQueryClient()
  const beeps = useBeep()

  const [tab, setTab] = React.useState<TType>('tsd')
  const { available, active, loading, refetch } = useLoansData(tab)
  const activeUI = active

  // ====== MACHINE STATE ======
  const [mode, setMode] = React.useState<Mode>('issue')                   // Выдача / Сдача
  const [scanStep, setScanStep] = React.useState<'awaitOperator'|'awaitDevice'>('awaitOperator') // шаг только для выдачи
  const [operatorId, setOperatorId] = React.useState('')

  // ====== UI: выбор, история, баннер ======
  const [selected, setSelected] = React.useState<number[]>([])
  const [noteOpen, setNoteOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyTitle, setHistoryTitle] = React.useState('')
  const [historyList, setHistoryList] = React.useState<any[]>([])
  const [banner, setBanner] = React.useState<{ kind:'ok'|'err', text:string }|null>(null)

  // только «успех»-тост; ошибки — в баннер
  const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' }>({
    open: false, msg: '', sev: 'success'
  })
  const showOk = (m: string) => { setSnack({ open: true, msg: m, sev: 'success' }); setBanner({ kind: 'ok', text: m }) }

  // ====== фокус ======
  const opInputRef  = React.useRef<HTMLInputElement>(null)
  const devSinkRef  = React.useRef<HTMLInputElement>(null)
  const focusOperator = () => { opInputRef.current?.focus() }
  const focusSink     = () => { devSinkRef.current?.focus() }

  // ====== правила: не более 1 ед. данного типа на руках у исполнителя ======
  const hasAlreadyOfThisType = React.useCallback((opId: string, type: TType) => {
    return activeUI.some(a => a.operator_id === opId && (a.item_table ?? tab) === type)
  }, [activeUI, tab])

  // ====== скан-режим ======
  const [scanOn, setScanOn]           = React.useState(true)
  const [autoIssueOn, setAutoIssueOn] = React.useState(true) // имеет смысл только в режиме выдачи

  // Поиск по Внутр. ID
  const [search, setSearch] = React.useState('')
  const norm = (s: string | null | undefined) => (s ?? '').toString().toLowerCase()
  const term = norm(search)

  // Индекс: доступные по серийнику (текущая вкладка)
  const serialIndex = React.useMemo(() => {
    const m = new Map<string, EquipmentItem>()
    for (const it of available) {
      const token = String(it.serial_number ?? '').trim().toUpperCase()
      if (token) m.set(token, it)
    }
    return m
  }, [available])

  // Индекс: активные (на руках) по серийному — для СДАЧИ (текущая вкладка)
  const activeSerialIndex = React.useMemo(() => {
    const m = new Map<string, ActiveLoanRowUI>()
    for (const r of activeUI) {
      const t = String(r.serial_number ?? '').trim().toUpperCase()
      if (t) m.set(t, r)
    }
    return m
  }, [activeUI])

  // ====== оптимистичные мутации ======
  const issueMutation = useMutation({
    mutationFn: async ({ itemIds, note }: { itemIds: number[]; note: string }) => {
      await issueItems({ operatorId: operatorId.trim(), table: tab, itemIds, note })
    },
    onMutate: async ({ itemIds }) => {
      setBanner(null)
      await queryClient.cancelQueries({ queryKey: ['available', tab] })
      await queryClient.cancelQueries({ queryKey: ['active', tab] })
      const prevAv = queryClient.getQueryData<EquipmentItem[]>(['available', tab]) ?? []
      const prevAct = queryClient.getQueryData<ActiveLoanRowUI[]>(['active', tab]) ?? []
      const removed = new Map<number, EquipmentItem>()
      const nextAv = prevAv.filter(r => {
        if (itemIds.includes(r.id)) { removed.set(r.id, r); return false }
        return true
      })
      const nowIso = new Date().toISOString()
      const nextAct = [...prevAct]
      for (const id of itemIds) {
        const src = removed.get(id)
        if (src) {
          nextAct.unshift({
            id: -Date.now(),
            loan_id: -Date.now(),
            operator_id: operatorId.trim(),
            item_id: id,
            item_table: tab,
            issued_at: nowIso,
            due_at: null,
            serial_number: src.serial_number ?? null,
            internal_id: src.internal_id ?? null,
          })
        }
      }
      queryClient.setQueryData(['available', tab], nextAv)
      queryClient.setQueryData(['active', tab], nextAct)
      return { prevAv, prevAct }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevAv) queryClient.setQueryData(['available', tab], ctx.prevAv)
      if (ctx?.prevAct) queryClient.setQueryData(['active', tab], ctx.prevAct)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['available', tab] })
      await queryClient.invalidateQueries({ queryKey: ['active', tab] })
    }
  })

  const returnMutation = useMutation({
    mutationFn: async ({ itemId, note }: { itemId: number; note: string }) => {
      await returnOne({ table: tab, itemId, note })
    },
    onMutate: async ({ itemId }) => {
      setBanner(null)
      await queryClient.cancelQueries({ queryKey: ['available', tab] })
      await queryClient.cancelQueries({ queryKey: ['active', tab] })
      const prevAct = queryClient.getQueryData<ActiveLoanRowUI[]>(['active', tab]) ?? []
      const nextAct = prevAct.filter(a => a.item_id !== itemId)
      queryClient.setQueryData(['active', tab], nextAct)
      return { prevAct }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevAct) queryClient.setQueryData(['active', tab], ctx.prevAct)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['available', tab] })
      await queryClient.invalidateQueries({ queryKey: ['active', tab] })
    }
  })

  // ====== конвейер ======
  const lastScanRef = React.useRef(0)
  const lastValRef  = React.useRef('')
  const cooldownMs  = 300
  const issuingRef  = React.useRef(false)

  const startIssueCycle = React.useCallback(() => {
    setMode('issue')
    setScanStep('awaitOperator')
    setOperatorId('')
    setTimeout(() => { focusOperator() }, 0)
    lastScanRef.current = 0
    lastValRef.current  = ''
  }, [])

  const startReturnCycle = React.useCallback(() => {
    setMode('return')
    setScanStep('awaitDevice') // для единообразия
    setOperatorId('')
    setTimeout(() => { focusSink() }, 0)
    lastScanRef.current = 0
    lastValRef.current  = ''
  }, [])

  // авто-таймаут ожидаем «устройство» — только в режиме выдачи
  React.useEffect(() => {
    if (mode !== 'issue' || scanStep !== 'awaitDevice' || !autoIssueOn) return
    const t = setTimeout(() => startIssueCycle(), 25000)
    return () => clearTimeout(t)
  }, [mode, scanStep, autoIssueOn, startIssueCycle])

  // хоткеи
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); startIssueCycle(); setBanner(null) }
      if (e.key.toLowerCase() === 'f2') { e.preventDefault(); setAutoIssueOn(v => !v) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [startIssueCycle])

  const handleIssue = async (note: string) => {
    if (!isValidOperatorId(operatorId)) { setBanner({ kind: 'err', text: 'Некорректный ID исполнителя' }); beeps.err(); startIssueCycle(); return }
    if (hasAlreadyOfThisType(operatorId.trim(), tab)) {
      setBanner({ kind: 'err', text: 'У этого исполнителя уже есть устройство этого типа' }); beeps.err(); startIssueCycle(); return
    }
    await issueMutation.mutateAsync({ itemIds: selected, note })
    setSelected([])
  }

  // === кросс-тип автовыдача ===
  const processIssueBySerial = async (serialRaw: string) => {
    if (issuingRef.current) return
    const token = normalizeSerialInput(serialRaw)

    // 1) пробуем в текущей вкладке
    let found: { item: EquipmentItem, type: TType } | null = null
    const cur = serialIndex.get(token)
    if (cur) found = { item: cur, type: tab }
    // 2) если не нашли — смотрим в другой
    if (!found) {
      const other: TType = tab === 'tsd' ? 'finger_scanners' : 'tsd'
      let otherAv = queryClient.getQueryData<EquipmentItem[]>(['available', other]) ?? []
      // если кэша нет — подгружаем
      if (!otherAv || otherAv.length === 0) {
        try { otherAv = await fetchAvailable(other) } catch {}
      }
      const hit = otherAv.find(it => (it.serial_number ?? '').trim().toUpperCase() === token)
      if (hit) found = { item: hit, type: other }
    }

    if (!found) {
      setBanner({ kind: 'err', text: `Серийник "${serialRaw}" не найден среди доступных` })
      beeps.err(); startIssueCycle(); return
    }

    if (!isValidOperatorId(operatorId)) {
      setBanner({ kind: 'err', text: 'Сначала отсканируйте корректный ID исполнителя' })
      beeps.err(); startIssueCycle(); return
    }

    if (hasAlreadyOfThisType(operatorId.trim(), found.type)) {
      setBanner({ kind: 'err', text: 'У этого исполнителя уже есть устройство этого типа' })
      beeps.err(); startIssueCycle(); return
    }

    try {
      issuingRef.current = true
      // если тип совпадает с текущей вкладкой — используем оптимистичную мутацию
      if (found.type === tab) {
        await issueMutation.mutateAsync({ itemIds: [found.item.id], note: '' })
      } else {
        // кросс-тип: прямой вызов, затем инвалидация обоих типов
        await issueItems({ operatorId: operatorId.trim(), table: found.type, itemIds: [found.item.id], note: '' })
        await queryClient.invalidateQueries({ queryKey: ['available', found.type] })
        await queryClient.invalidateQueries({ queryKey: ['active', found.type] })
      }
      beeps.ok()
      showOk(`Выдано: ${EQUIPMENT_TYPES[found.type].title} → ${operatorId}`)
      startIssueCycle() // сразу к следующему исполнителю
    } catch (e: any) {
      setBanner({ kind: 'err', text: e?.message || 'Ошибка автовыдачи' })
      beeps.err(); startIssueCycle()
    } finally {
      issuingRef.current = false
    }
  }

const processReturnBySerial = async (serialRaw: string) => {
  const token = normalizeSerialInput(serialRaw)
  const found = await findActiveBySerial(token)

  if (!found) {
    setBanner({ kind: 'err', text: `Серийник "${serialRaw}" не найден среди активных устройств` })
    beeps.err()
    startReturnCycle()
    return
  }

  try {
    if (found.type === tab) {
      // обычный путь — через мутацию текущей вкладки
      await returnMutation.mutateAsync({ itemId: found.row.item_id, note: '' })
    } else {
      // кросс-тип: прямой вызов и инвалидация кэша соседнего типа
      await returnOne({ table: found.type, itemId: found.row.item_id, note: '' })
      await queryClient.invalidateQueries({ queryKey: ['active', found.type] })
      await queryClient.invalidateQueries({ queryKey: ['available', found.type] })
    }

    beeps.ok()
    showOk(`Принято: ${EQUIPMENT_TYPES[found.type].title} SN ${found.row.serial_number ?? found.row.item_id}`)
    // остаёмся в режиме «сдача» и сразу ждём следующее устройство
    setTimeout(() => devSinkRef.current?.focus(), 0)
  } catch (e: any) {
    setBanner({ kind: 'err', text: e?.message || 'Ошибка при сдаче' })
    beeps.err()
    startReturnCycle()
  }
}

  // HID-сканер (единая точка входа)
  useHidScanner({
    enabled: scanOn,
    onScan: (val) => {
      const now = Date.now()
      if (now - lastScanRef.current < cooldownMs) return
      if (val === lastValRef.current && now - lastScanRef.current < 1500) return
      lastScanRef.current = now
      lastValRef.current  = val
      setBanner(null)

      if (mode === 'issue') {
        if (scanStep === 'awaitOperator') {
          // валидация ID исполнителя
          if (!isValidOperatorId(val)) {
            setBanner({ kind: 'err', text: 'Некорректный ID исполнителя (только цифры ≤ 9000000)' })
            beeps.err()
            setTimeout(() => focusOperator(), 0)
            return
          }
          // валидный ID — переходим к устройству
          setOperatorId(val.trim())
          setScanStep('awaitDevice')
          setTimeout(() => { opInputRef.current?.blur(); focusSink() }, 0)
          setBanner({ kind: 'ok', text: `Исполнитель: ${val.trim()}` })
          return
        }
        // ждём устройство
        if (autoIssueOn) {
          focusSink()
          void processIssueBySerial(val)
        } else {
          const token = normalizeSerialInput(val)
          const rec = serialIndex.get(token)
          if (!rec) {
            setBanner({ kind: 'err', text: `Серийник "${val}" не найден` })
            beeps.err(); startIssueCycle(); return
          }
          setSelected(prev => prev.includes(rec.id) ? prev.filter(x => x !== rec.id) : [...prev, rec.id])
          setBanner({ kind: 'ok', text: `Отмечено: ${rec.internal_id ?? rec.id}` })
          setTimeout(focusSink, 0)
        }
      } else {
        // mode === 'return' — всегда ждём устройство
        focusSink()
        void processReturnBySerial(val)
      }
    },
    minLength: 4,
    suffixKeys: ['Enter', 'Tab'],
  })

  // При монтировании — всегда стартуем с «выдачи → оператор»
  React.useEffect(() => {
    startIssueCycle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Смена режима по тумблеру
  const handleModeToggle = (_: any, v: Mode | null) => {
    if (!v) return
    if (v === 'issue') startIssueCycle()
    else startReturnCycle()
  }

  // Применяем поиск по внтр. ID и сортируем
  const filteredAvailable = React.useMemo(() => {
    const arr = term ? available.filter(r => norm(r.internal_id).includes(term)) : available.slice()
    return arr.sort((a, b) => (a.internal_id ?? '').localeCompare(b.internal_id ?? '', undefined, { numeric: true }))
  }, [available, term])

  const filteredActive = React.useMemo(() => {
    const arr = term ? activeUI.filter(r => norm(r.internal_id ?? '').includes(term)) : activeUI.slice()
    return arr.sort((a, b) => (a.internal_id ?? '').localeCompare(b.internal_id ?? '', undefined, { numeric: true }))
  }, [activeUI, term])

  // Ищем активную выдачу по серийному в текущем и соседнем типе
const findActiveBySerial = React.useCallback(
  async (token: string): Promise<{ row: ActiveLoanRowUI; type: TType } | null> => {
    // 1) текущая вкладка
    const here = activeSerialIndex.get(token)
    if (here) return { row: here, type: tab }

    // 2) соседний тип
    const other: TType = tab === 'tsd' ? 'finger_scanners' : 'tsd'
    let otherActive = queryClient.getQueryData<ActiveLoanRowUI[]>(['active', other]) ?? []
    if (!otherActive || otherActive.length === 0) {
      try {
        otherActive = (await fetchActiveByType(other)) as ActiveLoanRowUI[]
      } catch {
        otherActive = []
      }
    }
    const hit = otherActive.find(r => (r.serial_number ?? '').trim().toUpperCase() === token)
    return hit ? { row: hit, type: other } : null
  },
  [activeSerialIndex, tab, queryClient]
)


  // Realtime: слушаем loan_items
  React.useEffect(() => {
    const ch = supabase
      .channel('loans_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['available', tab] })
        queryClient.invalidateQueries({ queryKey: ['active', tab] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [queryClient, tab])

  // Префетч соседней вкладки
  React.useEffect(() => {
    const other = tab === 'tsd' ? 'finger_scanners' : 'tsd'
    queryClient.prefetchQuery({ queryKey: ['available', other], queryFn: () => fetchAvailable(other as TType) })
    queryClient.prefetchQuery({ queryKey: ['active', other],    queryFn: () => fetchActiveByType(other as TType) })
  }, [tab, queryClient])

  // История комментариев
  const openHistory = async (table: EquipmentTableName, item: EquipmentItem) => {
    try {
      const list = await fetchComments(table, item.id)
      setHistoryTitle(`${EQUIPMENT_TYPES[table].title}: ${item.model} — ${item.serial_number}`)
      setHistoryList(list)
      setHistoryOpen(true)
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Ошибка загрузки истории' })
    }
  }


  // Ручная сдача (иконка)
  const [returnItem, setReturnItem] = React.useState<{ table: TType; id: number } | null>(null)

  // Вспомогательные подписи
  const statusHint =
    mode === 'return' ? 'awaitDevice' :
    scanStep === 'awaitOperator' ? 'awaitOperator' : 'awaitDevice'

  return (
    <Box>
      <PageHeader
        title="Выдача / Сдача"
        crumbs={[{ label: 'Главная', to: '/' }, { label: 'Выдача/сдача' }]}
        actions={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
            {/* Тумблер режимов */}
            <ToggleButtonGroup
              size="small"
              value={mode}
              exclusive
              onChange={handleModeToggle}
              sx={{ mr: 1 }}
            >
              <ToggleButton value="issue">Выдача</ToggleButton>
              <ToggleButton value="return">Сдача</ToggleButton>
            </ToggleButtonGroup>

            {/* Поле «ID Исполнителя» — активно только в режиме «Выдача» и на шаге ожидания исполнителя */}
            <TextField
              inputRef={opInputRef}
              size="small"
              label="ID Исполнителя"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              disabled={mode !== 'issue' || scanStep !== 'awaitOperator'}
              sx={{ minWidth: 240 }}
              onKeyDown={(e) => { if (scanOn) e.preventDefault() }}
              inputProps={{ readOnly: scanOn }}
              onPaste={(e) => {
                if (mode !== 'issue') return
                const t = e.clipboardData.getData('text')?.trim() ?? ''
                if (t && t.length >= 4) {
                  e.preventDefault()
                  if (!isValidOperatorId(t)) {
                    setBanner({ kind: 'err', text: 'Некорректный ID исполнителя (только цифры ≤ 9000000)' })
                    beeps.err()
                    focusOperator()
                    return
                  }
                  setOperatorId(t)
                  setScanStep('awaitDevice')
                  requestAnimationFrame(() => requestAnimationFrame(() => devSinkRef.current?.focus()))
                  setBanner({ kind: 'ok', text: `Исполнитель: ${t}` })
                }
              }}
              helperText={mode === 'issue'
                ? (scanStep === 'awaitOperator' ? 'Отсканируйте ID исполнителя' : 'Отсканируйте устройство')
                : 'Режим сдачи: отсканируйте устройство'
              }
            />

            {/* Кнопка ручной выдачи (актуальна только в режиме выдачи) */}
            <Button
              variant="contained"
              disabled={mode !== 'issue' || !operatorId.trim() || selected.length === 0 || loading || !isValidOperatorId(operatorId)}
              onClick={() => setNoteOpen(true)}
            >
              Выдать вручную ({selected.length})
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            {/* Скан-режим и автовыдача */}
            <Paper variant="outlined" sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Switch size="small" checked={scanOn} onChange={(_, v) => setScanOn(v)} />
                  <Typography variant="caption">Скан-режим</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Switch
                    size="small"
                    checked={autoIssueOn}
                    onChange={(_, v) => setAutoIssueOn(v)}
                    disabled={mode !== 'issue'}
                  />
                  <Typography variant="caption">Автовыдача</Typography>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        }
      >
        {/* фильтров нет */}
      </PageHeader>

      {/* Невидимый input-поглотитель для сканов устройства */}
      <input
        ref={devSinkRef}
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        onKeyDown={(e) => e.preventDefault()}
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      {/* Броская плашка «последнее действие» */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.25, mb: 2, display: 'flex', alignItems: 'center', gap: 2,
          borderColor: banner?.kind === 'err' ? 'error.main' : 'success.main',
          backgroundColor: banner?.kind === 'err' ? 'rgba(244,67,54,0.06)' : 'rgba(46,125,50,0.06)',
        }}
      >
        <Chip
          label={
            mode === 'return'
              ? 'Режим: Сдача — сканируйте устройство'
              : statusHint === 'awaitOperator' ? 'Режим: Выдача — сканируйте исполнителя'
              : 'Режим: Выдача — сканируйте устройство'
          }
          color={mode === 'return' ? 'secondary' : (statusHint === 'awaitOperator' ? 'primary' : 'secondary')}
          variant="filled"
        />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {banner?.text ?? 'Готово к сканированию'}
        </Typography>
      </Paper>

      {/* Компактный поиск по внтр. ID */}
      <Paper variant="outlined" sx={{ p: 1, mb: 2, maxWidth: 320 }}>
        <TextField
          size="small"
          label="Поиск по внтр. ID"
          placeholder="например 12345"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          helperText="Поиск производится только по внутрискладскому ID"
        />
      </Paper>

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_e, v) => { setTab(v) }} aria-label="loan-tabs">
          <Tab label="ТСД" value="tsd" />
          <Tab label="Напалечные" value="finger_scanners" />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        {/* Доступны к выдаче */}
        <Section title={`Доступны к выдаче — ${EQUIPMENT_TYPES[tab].title}`} action={
          <Typography variant="caption" color="text.secondary">{filteredAvailable.length} шт.</Typography>
        }>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.length > 0 && selected.length === filteredAvailable.length}
                      indeterminate={selected.length > 0 && selected.length < filteredAvailable.length}
                      onChange={(e) => setSelected(e.target.checked ? filteredAvailable.map(r => r.id) : [])}
                    />
                  </TableCell>
                  {/* ID убран */}
                  <TableCell>Внутр. ID</TableCell>
                  <TableCell>Модель</TableCell>
                  <TableCell>Серийник</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align="right">История</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAvailable.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><Typography color="text.secondary">Нет доступных</Typography></TableCell></TableRow>
                ) : filteredAvailable.map((r) => {
                  const isSel = selected.includes(r.id)
                  return (
                    <TableRow key={r.id} hover onClick={() => setSelected(prev => isSel ? prev.filter(id => id !== r.id) : [...prev, r.id])}>
                      <TableCell padding="checkbox"><Checkbox checked={isSel} /></TableCell>
                      <TableCell>{r.internal_id}</TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell>{r.serial_number}</TableCell>
                      <TableCell>{STATUS_LABELS[r.status]}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="История комментариев">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openHistory(tab, r) }}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Paper>
        </Section>

        {/* Сейчас на руках */}
        <Section title={`Сейчас на руках — ${EQUIPMENT_TYPES[tab].title}`} action={
          <Typography variant="caption" color="text.secondary">{filteredActive.length} поз.</Typography>
        }>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ID выдачи</TableCell>
                  <TableCell>ID Исполнителя</TableCell>
                  <TableCell>Внутр. ID</TableCell>
                  <TableCell>Серийник</TableCell>
                  <TableCell>Выдано</TableCell>
                  <TableCell>Срок</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredActive.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><Typography color="text.secondary">Нет активных выдач</Typography></TableCell></TableRow>
                ) : filteredActive.map((a) => {
                  const dueTs = a.due_at ? new Date(a.due_at).getTime() : null
                  const overdue = dueTs !== null && Date.now() > dueTs
                  return (
                    <TableRow key={a.id} hover selected={overdue}>
                      <TableCell>{a.id}</TableCell>
                      <TableCell>{a.operator_id}</TableCell>
                      <TableCell>{a.internal_id ?? '—'}</TableCell>
                      <TableCell>{a.serial_number ?? '—'}</TableCell>
                      <TableCell>{new Date(a.issued_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {a.due_at ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">{new Date(a.due_at).toLocaleString()}</Typography>
                            {overdue && <Chip size="small" color="error" label="Просрочено" />}
                          </Stack>
                        ) : <Typography variant="body2" color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Принять (сдача)">
                          <IconButton size="small" onClick={() => setReturnItem({ table: tab, id: a.item_id })}>
                            <AssignmentTurnedInIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Paper>
        </Section>
      </Box>

      {/* Выдача — диалог комментария */}
      <NoteDialog
        open={noteOpen}
        title={`Комментарий к выдаче (${selected.length} шт.)`}
        label="Комментарий при выдаче"
        onClose={() => setNoteOpen(false)}
        onSubmit={async (note) => {
          try {
            await handleIssue(note)
            await refetch()
            setNoteOpen(false)
            beeps.ok()
            showOk('Выдача зафиксирована')
            startIssueCycle()
          } catch (e: any) {
            setBanner({ kind: 'err', text: e.message || 'Ошибка при выдаче' })
            beeps.err()
            startIssueCycle()
          }
        }}
      />

      {/* Сдача — диалог комментария (ручная) */}
      <NoteDialog
        open={!!returnItem}
        title="Комментарий к сдаче"
        label="Комментарий при сдаче"
        onClose={() => setReturnItem(null)}
        onSubmit={async (note) => {
          try {
            if (returnItem) {
              await returnMutation.mutateAsync({ itemId: returnItem.id, note })
              setReturnItem(null)
              beeps.ok()
              showOk('Сдача зафиксирована')
              if (mode === 'return') setTimeout(focusSink, 0); else startIssueCycle()
            }
          } catch (e: any) {
            setBanner({ kind: 'err', text: e.message || 'Ошибка при сдаче' })
            beeps.err()
            if (mode === 'return') startReturnCycle(); else startIssueCycle()
          }
        }}
      />

      <CommentHistoryDrawer open={historyOpen} title={historyTitle} onClose={() => setHistoryOpen(false)} comments={historyList} />

      {/* Только успех — снизу; ошибки и успехи дублируются в плашке */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
