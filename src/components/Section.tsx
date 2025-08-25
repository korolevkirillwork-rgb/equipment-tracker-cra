import * as React from 'react'
import { Paper, Box, Typography, Button } from '@mui/material'

type Props = {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export default function Section({ title, subtitle, action, children }: Props) {
  return (
    <Paper variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box
        sx={{
          px: 2, py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ letterSpacing: 0.4 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action ?? <Button size="small" variant="text">Все</Button>}
      </Box>
      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Paper>
  )
}
