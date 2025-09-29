import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { EquipmentItem, EquipmentTableName } from '../types'

import dejavuRegularUrl from '../assets/fonts/DejaVuSans.ttf'
import dejavuBoldUrl    from '../assets/fonts/DejaVuSans-Bold.ttf'
import notoRegularUrl   from '../assets/fonts/NotoSans-Regular.ttf'
import notoBoldUrl      from '../assets/fonts/NotoSans-Bold.ttf'

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  } catch { return null }
}

async function loadImageAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(dataUrl)
  const mime = m?.[1]?.toLowerCase() ?? ''
  return mime.includes('png') ? 'PNG' : 'JPEG'
}

let fontReady = false
let activeFamily: 'DejaVuSans' | 'NotoSans' = 'DejaVuSans'

async function registerFamily(
  doc: jsPDF,
  family: 'DejaVuSans' | 'NotoSans',
  regularUrl: string,
  boldUrl: string
) {
  const regularB64 = await urlToBase64(regularUrl)
  const boldB64    = await urlToBase64(boldUrl)
  if (!regularB64) return false

  const regularVfsName = `${family}-Regular.ttf`
  doc.addFileToVFS(regularVfsName, regularB64)
  doc.addFont(regularVfsName, family, 'normal', 'Identity-H')

  if (boldB64) {
    const boldVfsName = `${family}-Bold.ttf`
    doc.addFileToVFS(boldVfsName, boldB64)
    doc.addFont(boldVfsName, family, 'bold', 'Identity-H')
  } else {
    doc.addFont(regularVfsName, family, 'bold', 'Identity-H')
  }
  return true
}

async function ensureFonts(doc: jsPDF) {
  if (fontReady) { doc.setFont(activeFamily, 'normal'); return }
  if (await registerFamily(doc, 'DejaVuSans', dejavuRegularUrl, dejavuBoldUrl)) {
    activeFamily = 'DejaVuSans'
    fontReady = true
    doc.setFont(activeFamily, 'normal')
    return
  }
  if (await registerFamily(doc, 'NotoSans', notoRegularUrl, notoBoldUrl)) {
    activeFamily = 'NotoSans'
    fontReady = true
    doc.setFont(activeFamily, 'normal')
    return
  }
  throw new Error('Не удалось загрузить шрифты (regular/bold)')
}

function getPageCount(doc: jsPDF): number {
  const d: any = doc
  if (typeof d.getNumberOfPages === 'function') return d.getNumberOfPages()
  const pages = d.internal?.pages
  return Array.isArray(pages) ? Math.max(1, pages.length - 1) : 1
}
function getPageSize(doc: jsPDF): { width: number; height: number } {
  const d: any = doc
  const w = typeof d.internal?.pageSize?.getWidth === 'function'
    ? d.internal.pageSize.getWidth()
    : d.internal?.pageSize?.width || 595.28
  const h = typeof d.internal?.pageSize?.getHeight === 'function'
    ? d.internal.pageSize.getHeight()
    : d.internal?.pageSize?.height || 841.89
  return { width: w, height: h }
}

function addFooter(doc: jsPDF) {
  const pageCount = getPageCount(doc)
  const { width, height } = getPageSize(doc)
  doc.setFont(activeFamily, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.text(`Стр. ${i} из ${pageCount}`, width - 40, height - 20, { align: 'right' })
  }
}

// ======================== SHIPMENTS PDF ========================
export async function generateShipmentPDF(opts: {
  shipmentNumber: string
  shipmentDate: string
  items: EquipmentItem[]
  equipmentTitle: string
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  await ensureFonts(doc)

  const logoDataUrl = await loadImageAsDataURL('/logo.png')
  const { width: pageW } = getPageSize(doc)
  const marginX = 40
  const brand = { primary: [25, 118, 210] as [number, number, number] }

  doc.setProperties({
    title: `Отгрузка ${opts.shipmentNumber}`,
    subject: 'Оборудование на ремонт',
    author: 'Equipment Tracker',
    creator: 'Equipment Tracker'
  })

  const headerH = 80
  doc.setFillColor(...brand.primary)
  doc.rect(0, 0, pageW, headerH, 'F')

  if (logoDataUrl) {
    try {
      const fmt = detectImageFormat(logoDataUrl)
      let targetW = 110, targetH = 36
      const props = (doc as any).getImageProperties?.(logoDataUrl)
      if (props?.width && props?.height) {
        targetH = 36
        targetW = (props.width / props.height) * targetH
      }
      doc.addImage(logoDataUrl, fmt, marginX, 22, targetW, targetH, undefined, 'FAST')
    } catch {}
  }

  doc.setFont(activeFamily, 'normal')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  const titleX = logoDataUrl ? (marginX + 130) : marginX
  doc.text('Акт отгрузки оборудования на ремонт', titleX, 40)

  doc.setFontSize(11)
  doc.text(`Номер: ${opts.shipmentNumber}`, titleX, 60)
  doc.text(`Дата: ${opts.shipmentDate}`, titleX + 180, 60)
  doc.text(`Тип: ${opts.equipmentTitle}`, titleX, 76)
  doc.text(`Позиции: ${opts.items.length}`, titleX + 180, 76)

  const tableStartY = 100
  autoTable(doc, {
    startY: tableStartY,
    styles:       { font: activeFamily, fontStyle: 'normal', fontSize: 10, cellPadding: 6, valign: 'middle' },
    headStyles:   { font: activeFamily, fontStyle: 'bold',   fillColor: [25,118,210] as any, textColor: 255 },
    bodyStyles:   { font: activeFamily, fontStyle: 'normal' },
    theme: 'striped',
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: { 0: { cellWidth: 34, halign: 'right' }, 1: { cellWidth: 120 }, 2: { cellWidth: 200 }, 3: { cellWidth: 'auto' }},
    head: [['#', 'Внутр. ID', 'Модель', 'Серийный номер']],
    body: opts.items.map((i, idx) => [String(idx + 1), i.internal_id, i.model, i.serial_number])
  })
  doc.setFont(activeFamily, 'normal')

  const anyDoc = doc as any
  const endY = anyDoc.lastAutoTable?.finalY ?? (tableStartY + 20)

  doc.setTextColor(0, 0, 0)
  doc.setFont(activeFamily, 'normal')
  doc.setFontSize(12)
  doc.text('Итоги:', marginX, endY + 30)
  doc.setFontSize(11)
  doc.text(`Всего позиций: ${opts.items.length}`, marginX, endY + 50)
  doc.text('Подпись|ФИО отправителя _______________________________________________________________', marginX, endY + 90)
  const stamp = new Date().toLocaleString()
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`Сформировано: ${stamp}`, marginX, endY + 120)

  addFooter(doc)
  doc.save(`shipment_${opts.shipmentNumber}.pdf`)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LabelsOptions = {
  title?: string
  cols?: number
  rows?: number
  qrField?: 'serial_number' | 'internal_id' | 'id' | 'composed'
  tableName?: EquipmentTableName
}

// ======================== STICKERS 100×70 мм ========================
export async function generateLabelsPDF(opts: {
  items: EquipmentItem[]
  title?: string
  qrField?: 'serial_number' | 'internal_id' | 'id' | 'composed'
  tableName?: EquipmentTableName
}) {
  const items = opts.items || []

  // КЛЮЧЕВОЕ: landscape + формат [70, 100] (ширина=100, высота=70 после поворота)
  const doc = new jsPDF({ unit: 'mm', format: [70, 100], orientation: 'landscape' })
  await ensureFonts(doc)
  doc.setFont(activeFamily, 'normal')
  doc.setProperties({
    title: opts.title ? `Этикетки 100x70 — ${opts.title}` : 'Этикетки 100x70'
  })

  const pad = 4
  const qrSize = 32
  const mmToPx = (mm: number) => Math.max(80, Math.round((mm / 25.4) * 203))

  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage([70, 100], 'landscape') // важна ориентация

    const it = items[i]
    const textMaxW = 100 - pad * 2 - qrSize - 4

    doc.setFontSize(12)
    doc.text(opts.title || 'Оборудование', pad, 10, { maxWidth: textMaxW })

    doc.setFontSize(11)
    const l1 = doc.splitTextToSize(`Модель: ${it.model ?? ''}`, textMaxW)
    const l2 = doc.splitTextToSize(`Внутр. ID: ${it.internal_id ?? ''}`, textMaxW)
    const l3 = doc.splitTextToSize(`SN: ${it.serial_number ?? ''}`, textMaxW)

    let y = 16
    doc.text(l1 as any, pad, y); y += (Array.isArray(l1) ? l1.length : 1) * 5
    doc.text(l2 as any, pad, y); y += (Array.isArray(l2) ? l2.length : 1) * 5
    doc.text(l3 as any, pad, y)

    const sn = (it.serial_number ?? '').trim()
    if (sn) {
      const qrData = await QRCode.toDataURL(sn, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: mmToPx(qrSize),
        color: { dark: '#000000', light: '#FFFFFF' }
      })
      try {
        const fmt = detectImageFormat(qrData)
        const x = 100 - pad - qrSize
        const yq = (70 - qrSize) / 2
        doc.addImage(qrData, fmt, x, yq, qrSize, qrSize, undefined, 'FAST')
      } catch {}
    }
  }

  doc.save(`labels_100x70_${opts.title || 'equipment'}.pdf`)
}

// ======================== THERMAL LABELS 50×50 ========================
export async function generateThermalLabelsPDF50(opts: {
  items: EquipmentItem[]
  title?: string
  qrField?: 'serial_number' | 'internal_id' | 'id' | 'composed'
  tableName?: EquipmentTableName
}) {
  const items = opts.items || []
  const type: EquipmentTableName = (opts.tableName || 'tsd') as EquipmentTableName

  const doc = new jsPDF({ unit: 'mm', format: [50, 50], orientation: 'portrait' })
  await ensureFonts(doc)
  doc.setFont(activeFamily, 'normal')
  doc.setProperties({
    title: opts.title ? `Этикетки 50x50 — ${opts.title}` : 'Этикетки 50x50',
    author: 'Equipment Tracker',
    creator: 'Equipment Tracker'
  })

  const pad = 3
  const centerX = (mm: number) => 25 - mm / 2
  const centerY = (mm: number) => 25 - mm / 2

  const qrCache = new Map<number, string>()
  async function getSerialQR(it: EquipmentItem, px: number) {
    const sn = (it.serial_number ?? '').trim()
    if (!sn) return null
    if (qrCache.has(it.id)) return qrCache.get(it.id)!
    const dataUrl = await QRCode.toDataURL(sn, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: px,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
    qrCache.set(it.id, dataUrl)
    return dataUrl
  }

  const mmToPx = (mm: number) => Math.max(60, Math.round((mm / 25.4) * 203))

  async function drawTablet(it: EquipmentItem) {
    const qrSize = 20
    const qr = await getSerialQR(it, mmToPx(qrSize))
    if (qr) {
      const fmt = detectImageFormat(qr)
      doc.addImage(qr, fmt, pad, pad, qrSize, qrSize, undefined, 'FAST')
    }
    doc.setFont(activeFamily, 'normal')
    doc.setFontSize(12)
    const x = pad + qrSize + 2
    const maxW = 50 - x - pad
    const id = (it.internal_id ?? '').trim() || '—'
    doc.text(id, x, pad + 8, { maxWidth: maxW })
  }

  async function drawTsd(it: EquipmentItem) {
    const qrSize = 18
    const qr = await getSerialQR(it, mmToPx(qrSize))
    if (qr) {
      const fmt = detectImageFormat(qr)
      doc.addImage(qr, fmt, 50 - pad - qrSize, pad, qrSize, qrSize, undefined, 'FAST')
    }
    const maxW = 50 - pad * 2 - (qr ? (qrSize + 2) : 0)
    doc.setFont(activeFamily, 'normal')
    doc.setFontSize(11)
    const title = (it.model ?? '').trim() || 'ТСД'
    doc.text(title, pad, pad + 6, { maxWidth: maxW })
    doc.setFontSize(12)
    const id = (it.internal_id ?? '').trim() || '—'
    doc.text(id, pad, pad + 14, { maxWidth: maxW })
  }

  async function drawFinger(it: EquipmentItem) {
    const side = Math.min(31, 50 * Math.sqrt(0.4))
    const qr = await getSerialQR(it, mmToPx(side))
    if (qr) {
      const fmt = detectImageFormat(qr)
      const qx = centerX(side)
      const qy = centerY(side) - 4
      doc.addImage(qr, fmt, qx, qy, side, side, undefined, 'FAST')
    }
    const id = (it.internal_id ?? '').trim()
    if (id) {
      doc.setFont(activeFamily, 'normal')
      doc.setFontSize(10)
      doc.text(id, 25, 46, { align: 'center', maxWidth: 44 })
    }
  }

  async function drawDesktop(it: EquipmentItem) {
    const id = (it.internal_id ?? '').trim() || '—'
    doc.setFont(activeFamily, 'normal')
    doc.setFontSize(16)
    doc.text(id, 25, 27, { align: 'center', maxWidth: 46 })
  }

  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage([50, 50], 'portrait')
    const it = items[i]
    doc.setDrawColor(230, 230, 230)
    doc.rect(0.5, 0.5, 49, 49)

    if (type === 'tablets') {
      await drawTablet(it)
    } else if (type === 'tsd') {
      await drawTsd(it)
    } else if (type === 'finger_scanners') {
      await drawFinger(it)
    } else if (type === 'desktop_scanners') {
      await drawDesktop(it)
    } else {
      await drawTablet(it)
    }
  }

  doc.save(`labels_50x50_${opts.title || type}.pdf`)
}
