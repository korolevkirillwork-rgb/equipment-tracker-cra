import * as React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem } from '@mui/material'
import { EquipmentItem, EquipmentTableName, Status } from '../types'
import { supabase } from '../lib/supabase'

export default function AddEquipmentForm({
  open, onClose, table, onAdded
}: {
  open: boolean
  onClose: () => void
  table: EquipmentTableName
  onAdded: () => void
}) {
  const [form, setForm] = React.useState<Omit<EquipmentItem, 'id'>>({
    internal_id: '',
    model: '',
    serial_number: '',
    status: 'on_stock'
  })

  const [saving, setSaving] = React.useState(false)

  const handleChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from(table).insert(form)
    setSaving(false)
    if (error) {
      alert('Ошибка сохранения: ' + error.message)
    } else {
      onAdded()
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Добавить оборудование</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
        <TextField label="Внутр. ID" value={form.internal_id} onChange={handleChange('internal_id')} />
        <TextField label="Модель" value={form.model} onChange={handleChange('model')} />
        <TextField label="Серийный номер" value={form.serial_number} onChange={handleChange('serial_number')} />
        <TextField label="Статус" select value={form.status} onChange={handleChange('status')}>
          {(['on_stock', 'in_repair'] as Status[]).map((s) => (
            <MenuItem key={s} value={s}>{s === 'on_stock' ? 'На складе' : 'В ремонте'}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained">Сохранить</Button>
      </DialogActions>
    </Dialog>
  )
}
