import * as React from 'react'
import { Paper, Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'

type Props = {
  title: string
  value: React.ReactNode
  caption?: string
  icon?: React.ReactNode
  onClick?: () => void
}

export default function StatCard({ title, value, caption, icon, onClick }: Props) {
  return (
    <Paper
      variant="outlined"
      component={motion.div}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        p: 2,
        bgcolor: 'background.paper',
        borderColor: 'divider',
        userSelect: 'none',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="overline" sx={{ letterSpacing: 0.6, color: 'text.secondary' }}>
          {title}
        </Typography>
        {icon && <Box sx={{ color: 'text.secondary' }}>{icon}</Box>}
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1, color: 'text.primary' }}>
        {value}
      </Typography>
      {caption && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {caption}
        </Typography>
      )}
    </Paper>
  )
}
