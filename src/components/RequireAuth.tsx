import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LinearProgress, Box } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <Box sx={{ width: '100%', position: 'fixed', top: 0, left: 0 }}>
        <LinearProgress />
      </Box>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />
  }
  return <>{children}</>
}
