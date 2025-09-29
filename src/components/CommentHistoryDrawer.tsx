import * as React from 'react'
import {
  Drawer, Box, Typography, List, ListItem, ListItemText, Divider,
  IconButton, Stack, Chip, Button
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { EquipmentComment } from '../lib/loansApi'

type Props = {
  open: boolean
  title: string
  comments: EquipmentComment[]
  onClose: () => void
}

function labelByAction(action: string) {
  switch (action) {
    case 'issue':  return 'взятие'
    case 'return': return 'возврат'
    default:       return action
  }
}
function chipColorByAction(action: string): 'default' | 'primary' | 'success' {
  switch (action) {
    case 'issue':  return 'primary'
    case 'return': return 'success'
    default:       return 'default'
  }
}

// CSV-экспорт (UTF-8 + BOM, разделитель ; — удобно для Excel в RU)
function exportCommentsCsv(title: string, comments: EquipmentComment[]) {
  const safe = (s: any) => {
    const v = (s ?? '').toString()
    // экранирование двойных кавычек
    return `"${v.replace(/"/g, '""')}"`
  }
  const fileTitle = (title || 'history')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .slice(0, 80)

  const header = [
    'created_at',
    'action',
    'operator_id',
    'loan_id',
    'item_table',
    'item_id',
    'comment'
  ].join(';')

  const rows = comments.map(c => {
    const created = new Date(c.created_at).toISOString() // стабильный формат
    const action  = labelByAction(c.action)
    return [
      safe(created),
      safe(action),
      safe(c.operator_id ?? ''),
      safe(c.loan_id ?? ''),
      safe(c.item_table),
      safe(c.item_id),
      safe(c.comment ?? '')
    ].join(';')
  })

  const csv = [header, ...rows].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `${fileTitle}_comments.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function CommentHistoryDrawer({ open, title, comments, onClose }: Props) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 480, p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6">{title || 'История комментариев'}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => exportCommentsCsv(title, comments)}
              disabled={!comments || comments.length === 0}
              variant="outlined"
            >
              Скачать CSV
            </Button>
            <IconButton onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        {(!comments || comments.length === 0) ? (
          <Typography color="text.secondary">Комментариев пока нет</Typography>
        ) : (
          <List dense>
            {comments.map((c) => {
              const when = new Date(c.created_at).toLocaleString()
              const color = chipColorByAction(c.action)
              const label = labelByAction(c.action)
              return (
                <React.Fragment key={c.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={
                        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                          <Chip size="small" color={color} label={label} />
                          {c.operator_id && (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Исполнитель: {c.operator_id}
                            </Typography>
                          )}
                          {c.loan_id !== null && (
                            <Typography variant="body2" color="text.secondary">
                              loan #{c.loan_id}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">{when}</Typography>
                        </Stack>
                      }
                      secondary={
                        c.comment
                          ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.comment}</Typography>
                          : <Typography variant="body2" color="text.secondary">—</Typography>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              )
            })}
          </List>
        )}
      </Box>
    </Drawer>
  )
}
