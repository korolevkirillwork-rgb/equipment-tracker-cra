import * as React from 'react'
import { runSyncQueue } from './adapter'

export function useOnlineStatus() {
  const [online, setOnline] = React.useState<boolean>(navigator.onLine)
  React.useEffect(() => {
    const up = () => { setOnline(true); runSyncQueue().catch(() => void 0) }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}
