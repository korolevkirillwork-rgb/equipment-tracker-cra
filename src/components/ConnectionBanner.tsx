import * as React from 'react'
import { Alert, Collapse, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useOnlineStatus } from '../offline/hooks'

export default function ConnectionBanner() {
  const online = useOnlineStatus()
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => { setOpen(true) }, [online])

  return (
    <Collapse in={open}>
      <Alert
        severity={online ? 'success' : 'warning'}
        sx={{ borderRadius: 0 }}
        action={
          <IconButton size="small" onClick={() => setOpen(false)} color="inherit">
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {online ? 'Онлайн: данные синхронизированы' : 'Офлайн: изменения сохраняются локально и будут синхронизированы'}
      </Alert>
    </Collapse>
  )
}
