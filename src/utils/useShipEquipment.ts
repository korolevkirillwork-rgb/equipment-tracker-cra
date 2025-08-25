import { supabase } from '../lib/supabase'
import { EquipmentItem, EquipmentTableName } from '../types'
import { generateShipmentPDF } from './pdf'

export default function useShipEquipment() {
  async function ship({
    table,
    selectedItems,
    shipmentNumber,
    shipmentDate,
    equipmentTitle
  }: {
    table: EquipmentTableName
    selectedItems: EquipmentItem[]
    shipmentNumber: string
    shipmentDate: string
    equipmentTitle: string
  }) {
    if (selectedItems.length === 0) throw new Error('Нет выбранных элементов')
    const ids = selectedItems.map((i) => i.id)

    const { data: sData, error: sErr } = await supabase
      .from('shipments')
      .insert({ shipment_number: shipmentNumber, shipment_date: shipmentDate })
      .select()
      .single()

    if (sErr || !sData) throw new Error(`Не удалось создать отгрузку: ${sErr?.message}`)
    const shipmentId = sData.id as number

    const itemsPayload = ids.map((id) => ({
      shipment_id: shipmentId,
      item_id: id,
      table_name: table
    }))

    const { error: siErr } = await supabase.from('shipment_items').insert(itemsPayload)
    if (siErr) throw new Error(`Не удалось записать состав отгрузки: ${siErr.message}`)

    const { error: upErr } = await supabase
      .from(table)
      .update({ status: 'in_repair' })
      .in('id', ids)
      .eq('status', 'on_stock')

    if (upErr) throw new Error(`Не удалось обновить статус: ${upErr.message}`)

    await generateShipmentPDF({
      shipmentNumber,
      shipmentDate,
      items: selectedItems,
      equipmentTitle
    })
  }

  return { ship }
}
