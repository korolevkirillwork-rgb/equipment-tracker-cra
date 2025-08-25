import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { EquipmentItem, EquipmentTableName } from '../types'

// Шрифты и лого
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
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
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

async function registerFamily(doc: jsPDF, family: 'DejaVuSans' | 'NotoSans', regularUrl: string, boldUrl: string) {
  const regularB64 = await urlToBase64(regularUrl)
  const boldB64    = await urlToBase64(boldUrl)
  if (!regularB64) return false

  const regularVfsName = `${family}-Regular.ttf`
  doc.addFileToVFS(regularVfsName, regularB64)
  doc.addFont(regularVfsName, family, 'normal')

  if (boldB64) {
    const boldVfsName = `${family}-Bold.ttf`
    doc.addFileToVFS(boldVfsName, boldB64)
    doc.addFont(boldVfsName, family, 'bold')
  } else {
    doc.addFont(regularVfsName, family, 'bold')
  }
  return true
}

async function ensureFonts(doc: jsPDF) {
  if (fontReady) return
  if (await registerFamily(doc, 'DejaVuSans', dejavuRegularUrl, dejavuBoldUrl)) {
    activeFamily = 'DejaVuSans'
    fontReady = true
    return
  }
  if (await registerFamily(doc, 'NotoSans', notoRegularUrl, notoBoldUrl)) {
    activeFamily = 'NotoSans'
    fontReady = true
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

  const tableStartY = headerH + 20
  autoTable(doc, {
    startY: tableStartY,
    styles:       { font: activeFamily, fontSize: 10, cellPadding: 6, valign: 'middle' },
    headStyles:   { font: activeFamily, fontStyle: 'bold', fillColor: [25,118,210] as any, textColor: 255 },
    bodyStyles:   { font: activeFamily, fontStyle: 'normal' },
    theme: 'striped',
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: { 0: { cellWidth: 34, halign: 'right' }, 1: { cellWidth: 120 }, 2: { cellWidth: 200 }, 3: { cellWidth: 'auto' }},
    head: [['#', 'Внутр. ID', 'Модель', 'Серийный номер']],
    body: opts.items.map((i, idx) => [String(idx + 1), i.internal_id, i.model, i.serial_number])
  })

  const anyDoc = doc as any
  const endY = anyDoc.lastAutoTable?.finalY ?? (tableStartY + 20)

  doc.setTextColor(0, 0, 0)
  doc.setFont(activeFamily, 'normal')
  doc.setFontSize(12)
  doc.text('Итоги:', marginX, endY + 30)
  doc.setFontSize(11)
  doc.text(`Всего позиций: ${opts.items.length}`, marginX, endY + 50)
  doc.text('Подпись отправителя: ____________________', marginX, endY + 90)

  const stamp = new Date().toLocaleString()
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`Сформировано: ${stamp}`, marginX, endY + 120)

  addFooter(doc)
  doc.save(`shipment_${opts.shipmentNumber}.pdf`)
}

// ======================== A4 LABELS (3×8) ========================
type LabelsOptions = {
  title?: string
  cols?: number
  rows?: number
  qrField?: 'serial_number' | 'internal_id' | 'id' | 'composed'
  tableName?: EquipmentTableName
}

export async function generateLabelsPDF(opts: { items: EquipmentItem[] } & LabelsOptions) {
  const items = opts.items || []
  const cols  = Math.max(1, opts.cols ?? 3)
  const rows  = Math.max(1, opts.rows ?? 8)
  const qrMode = opts.qrField ?? 'composed'

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  await ensureFonts(doc)

  const pageW = getPageSize(doc).width
  const pageH = getPageSize(doc).height
  const marginX = 36
  const marginY = 36
  const gap = 8

  const cellW = (pageW - marginX * 2 - gap * (cols - 1)) / cols
  const cellH = (pageH - marginY * 2 - gap * (rows - 1)) / rows

  const pad = 10
  const qrSize = Math.min(90, Math.min(cellW, cellH) * 0.45)

  const buildQR = (it: EquipmentItem) => {
    switch (qrMode) {
      case 'serial_number': return it.serial_number
      case 'internal_id':   return it.internal_id
      case 'id':            return String(it.id)
      default:              return `${opts.tableName ?? ''}:${it.id}:${it.serial_number}`
    }
  }

  const qrCache = new Map<number, string>()
  async function getQR(it: EquipmentItem) {
    if (qrCache.has(it.id)) return qrCache.get(it.id)!
    const dataUrl = await QRCode.toDataURL(buildQR(it), { errorCorrectionLevel: 'M', margin: 0, scale: 4 })
    qrCache.set(it.id, dataUrl)
    return dataUrl
  }

  doc.setProperties({ title: opts.title ? `Этикетки — ${opts.title}` : 'Этикетки оборудования' })

  for (let i = 0; i < items.length; i++) {
    const idxInPage = i % (cols * rows)
    const r = Math.floor(idxInPage / cols)
    const c = idxInPage % cols

    if (i > 0 && idxInPage === 0) doc.addPage()

    const x = marginX + c * (cellW + gap)
    const y = marginY + r * (cellH + gap)

    doc.setDrawColor(210, 210, 210)
    doc.roundedRect(x, y, cellW, cellH, 6, 6)

    const contentX = x + pad
    const contentY = y + pad
    const textMaxW = cellW - pad * 2 - qrSize - 8

    doc.setFont(activeFamily, 'bold'); doc.setFontSize(12)
    const title = opts.title || 'Оборудование'
    doc.text(title, contentX, contentY + 12, { maxWidth: textMaxW })

    doc.setFont(activeFamily, 'normal'); doc.setFontSize(11)
    const it = items[i]
    const line1 = doc.splitTextToSize(`Модель: ${it.model}`, textMaxW)
    const line2 = doc.splitTextToSize(`Внутр. ID: ${it.internal_id}`, textMaxW)
    const line3 = doc.splitTextToSize(`SN: ${it.serial_number}`, textMaxW)

    let ty = contentY + 20
    doc.text(line1 as any, contentX, ty); ty += (Array.isArray(line1) ? line1.length : 1) * 14
    doc.setFont(activeFamily, 'bold')
    doc.text(line2 as any, contentX, ty); ty += (Array.isArray(line2) ? line2.length : 1) * 14
    doc.setFont(activeFamily, 'normal')
    doc.text(line3 as any, contentX, ty)

    const qrData = await getQR(it)
    try {
      const fmt = detectImageFormat(qrData)
      const qrX = x + cellW - pad - qrSize
      const qrY = y + (cellH - qrSize) / 2
      doc.addImage(qrData, fmt, qrX, qrY, qrSize, qrSize, undefined, 'FAST')
    } catch {}
  }

  doc.save(`labels_${opts.title || 'equipment'}.pdf`)
}

// ======================== THERMAL LABELS 50×50 ========================
export async function generateThermalLabelsPDF50(opts: {
  items: EquipmentItem[]
  title?: string
  qrField?: 'serial_number' | 'internal_id' | 'id' | 'composed'
  tableName?: EquipmentTableName
}) {
  const items = opts.items || []

  // Страница ровно 50×50 мм (под термоленту 50x50)
  const doc = new jsPDF({ unit: 'mm', format: [50, 50], orientation: 'portrait' })
  await ensureFonts(doc)
  doc.setProperties({
    title: opts.title ? `Этикетки 50x50 — ${opts.title}` : 'Этикетки 50x50',
    author: 'Equipment Tracker',
    creator: 'Equipment Tracker'
  })

  // Геометрия
  const pad = 3
  const qrSizeMM = 13 // в 2 раза меньше предыдущих 26 мм
  const dpi = 203
  const qrWidthPx = Math.max(90, Math.round((qrSizeMM / 25.4) * dpi)) // ~104px при 203 dpi
  const textMaxW = 50 - pad * 2 - qrSizeMM - 2 // ширина под текст слева от QR

  // QR только из серийника (если пуст — fallback к ID/внутр. ID, чтобы не было пустых QR)
  const buildQR = (it: EquipmentItem) => {
    const serial = (it.serial_number ?? '').trim()
    const internalId = (it.internal_id ?? '').trim()
    const idStr = String(it.id ?? '')
    return serial || internalId || idStr
  }

  const qrCache = new Map<number, string>()
  async function getQR(it: EquipmentItem) {
    if (qrCache.has(it.id)) return qrCache.get(it.id)!
    const content = buildQR(it)
    const dataUrl = await QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: qrWidthPx, // фиксируем пиксели под 203 dpi
      color: { dark: '#000000', light: '#FFFFFF' }
    })
    qrCache.set(it.id, dataUrl)
    return dataUrl
  }

  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage([50, 50], 'portrait')

    const it = items[i]
    const x = pad, y = pad

    // Заголовок — крупнее
    doc.setFont(activeFamily, 'bold')
    doc.setFontSize(15) // было 7.5
    const title = opts.title || 'Оборудование'
    doc.text(title, x, y + 6, { maxWidth: textMaxW })

    // Основной текст — крупнее и читаемее
    // Модель (обычный), Внутр. ID (жирный), Серийник (обычный)
    let ty = y + 14
    doc.setFont(activeFamily, 'normal')
    doc.setFontSize(12) // было 6.2
    const ln1 = doc.splitTextToSize(`Модель: ${it.model}`, textMaxW)
    doc.text(ln1 as any, x, ty); ty += (Array.isArray(ln1) ? ln1.length : 1) * 4.3

    doc.setFont(activeFamily, 'bold')
    doc.setFontSize(12)
    const ln2 = doc.splitTextToSize(`ID: ${it.internal_id}`, textMaxW)
    doc.text(ln2 as any, x, ty); ty += (Array.isArray(ln2) ? ln2.length : 1) * 4.5

    doc.setFont(activeFamily, 'normal')
    doc.setFontSize(12)
    const ln3 = doc.splitTextToSize(`SN: ${it.serial_number}`, textMaxW)
    doc.text(ln3 as any, x, ty)

    // QR — в правом верхнем углу
    const qrData = await getQR(it)
    try {
      const fmt = detectImageFormat(qrData)
      const qrX = 50 - pad - qrSizeMM
      const qrY = pad
      doc.addImage(qrData, fmt, qrX, qrY, qrSizeMM, qrSizeMM, undefined, 'FAST')
    } catch {
      // если по какой-то причине QR не отрисовался — выведем текстовое значение серийника в угол
      doc.setFont(activeFamily, 'bold')
      doc.setFontSize(8)
      doc.text(buildQR(it), 50 - pad - qrSizeMM, pad + 6, { maxWidth: qrSizeMM })
    }
  }

  doc.save(`labels_50x50_${opts.title || 'equipment'}.pdf`)
}


