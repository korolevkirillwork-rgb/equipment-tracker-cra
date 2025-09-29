import * as React from 'react'

type Options = {
  enabled: boolean
  onScan: (value: string) => void
  suffixKeys?: string[]              // чем заканчивается скан: Enter/Tab и т.п.
  minLength?: number                 // минимальная длина полезных данных
  interKeyTimeoutMs?: number         // пауза между символами, после которой буфер сбрасывается
  prefix?: string | null             // ожидаемый префикс (если настроен на сканере)
  sanitize?: (s: string) => string   // кастомная очистка
}

const DEFAULTS = {
  suffixKeys: ['Enter', 'Tab'],
  minLength: 4,
  interKeyTimeoutMs: 35, // сканер шлёт очень быстро (<10–20мс между символами)
}

function defaultSanitize(s: string) {
  return s.replace(/\s+/g, '').trim()
}

let audioCtx: AudioContext | null = null
function beep(freq = 880, durationMs = 80) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      osc.disconnect()
      gain.disconnect()
    }, durationMs)
  } catch { /* без звука – ок */ }
}

export function useHidScanner(opts: Options) {
  const {
    enabled,
    onScan,
    suffixKeys = DEFAULTS.suffixKeys,
    minLength = DEFAULTS.minLength,
    interKeyTimeoutMs = DEFAULTS.interKeyTimeoutMs,
    prefix = null,
    sanitize = defaultSanitize,
  } = opts

  const bufferRef = React.useRef<string>('')
  const lastTsRef = React.useRef<number>(0)

  const reset = React.useCallback(() => {
    bufferRef.current = ''
    lastTsRef.current = 0
  }, [])

  const accept = React.useCallback((raw: string) => {
    let val = sanitize(raw)
    if (prefix && !val.startsWith(prefix)) {
      reset()
      beep(220, 120) // низкий тон — ошибка
      return
    }
    if (prefix) val = val.slice(prefix.length)
    if (val.length < minLength) {
      reset()
      beep(220, 120)
      return
    }
    onScan(val)
    reset()
    beep(880, 80) // успех
  }, [onScan, sanitize, prefix, minLength, reset])

  React.useEffect(() => {
    if (!enabled) return

    const keyHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const isInputLike = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable
      )

      const now = performance.now()
      const gap = now - (lastTsRef.current || now)
      if (gap > interKeyTimeoutMs) bufferRef.current = ''
      lastTsRef.current = now

      if (suffixKeys.includes(e.key)) {
        const chunk = bufferRef.current
        if (chunk) {
          e.preventDefault()
          e.stopPropagation()
          accept(chunk)
        }
        reset()
        return
      }

      if (e.key.length === 1) {
        if (!isInputLike) {
          bufferRef.current += e.key
          e.preventDefault()
          e.stopPropagation()
        } else {
          bufferRef.current += e.key
        }
      }
    }

    // ВАЖНО: 'paste' — у document, не у window
    const pasteHandler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') || ''
      if (text && text.trim().length >= minLength) {
        e.preventDefault()
        accept(text.trim())
      }
    }

    window.addEventListener('keydown', keyHandler, true)
    document.addEventListener('paste', pasteHandler, true)

    return () => {
      window.removeEventListener('keydown', keyHandler, true)
      document.removeEventListener('paste', pasteHandler, true)
      reset()
    }
  }, [enabled, accept, interKeyTimeoutMs, suffixKeys, reset])
}
