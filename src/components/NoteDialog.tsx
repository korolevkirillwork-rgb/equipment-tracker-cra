import * as React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material'

type Props = {
  open: boolean
  title: string
  label?: string
  initial?: string
  onClose: () => void
  onSubmit: (note: string) => void
}

export default function NoteDialog({ open, title, label = 'Комментарий', initial = '', onClose, onSubmit }: Props) {
  const [note, setNote] = React.useState(initial)
  React.useEffect(() => setNote(initial), [initial, open])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          minRows={3}
          margin="dense"
          fullWidth
          label={label}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={() => onSubmit(note)} variant="contained">Ок</Button>
      </DialogActions>
    </Dialog>
  )
}
