import * as React from 'react'
import {
  Box, Paper, TextField, Button, Typography, Stack, Alert, InputAdornment
} from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import EmailIcon from '@mui/icons-material/Email'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation() as any
  const { user } = useAuth()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      const to = loc.state?.from?.pathname || '/'
      nav(to, { replace: true })
    }
  }, [user, loc, nav])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // редирект выполнится в useEffect при появлении user
    } catch (e: any) {
      setError(e.message || 'Неверный email или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', px: 2 }}>
      <Paper variant="outlined" sx={{ width: 360, p: 3 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" fontWeight={700} align="center">Вход</Typography>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            inputProps={{ minLength: 6 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Button type="submit" variant="contained" disabled={loading}>Войти</Button>
        </Stack>
      </Paper>
    </Box>
  )
}
