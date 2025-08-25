import { Alert, Snackbar } from '@mui/material'

export default function Notification({
  open, message, severity = 'success', onClose
}: {
  open: boolean
  message: string
  severity?: 'success' | 'error' | 'warning' | 'info'
  onClose: () => void
}) {
  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert onClose={onClose} severity={severity} variant="filled" sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  )
}
