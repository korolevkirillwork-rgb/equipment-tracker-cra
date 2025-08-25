import * as React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material'
import { format } from 'date-fns'

export default function ShipmentModal({
  open, onClose, onConfirm
}: {
  open: boolean
  onClose: () => void
  onConfirm: (shipmentNumber: string, shipmentDate: string) => void
}) {
  const [shipmentNumber, setNumber] = React.useState('')
  const [shipmentDate, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))

  const submit = () => {
    if (!shipmentNumber.trim()) return alert('Введите номер отгрузки')
    onConfirm(shipmentNumber.trim(), shipmentDate)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Отгрузка на ремонт</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
        <TextField label="Номер отгрузки" value={shipmentNumber} onChange={(e) => setNumber(e.target.value)} />
        <TextField label="Дата" type="date" value={shipmentDate} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={submit}>Сформировать</Button>
      </DialogActions>
    </Dialog>
  )
}
