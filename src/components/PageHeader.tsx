import * as React from 'react'
import { Box, Breadcrumbs, Button, Stack, Typography } from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { Link as RouterLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

type Crumb = { label: string; to?: string }

type Props = {
  title: string
  crumbs?: Crumb[]
  actions?: React.ReactNode
  children?: React.ReactNode // если передать, появится зона фильтров под шапкой
  defaultFiltersOpen?: boolean
  sticky?: boolean
}

export default function PageHeader({
  title,
  crumbs = [],
  actions,
  children,
  defaultFiltersOpen = true,
  sticky = true
}: Props) {
  const hasFilters = React.Children.count(children) > 0
  const [open, setOpen] = React.useState(defaultFiltersOpen && hasFilters)

  React.useEffect(() => {
    // если children исчезли — скрываем секцию и кнопку
    if (!hasFilters && open) setOpen(false)
  }, [hasFilters, open])

  return (
    <Box
      sx={(theme) => ({
        position: sticky ? 'sticky' : 'static',
        top: 64, // высота AppBar
        zIndex: theme.zIndex.appBar - 1,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider'
      })}
    >
      {/* Верхняя строка: хлебные крошки + заголовок + действия */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
        <Stack spacing={0.5}>
          {crumbs.length > 0 && (
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
              {crumbs.map((c, i) =>
                c.to ? (
                  <Typography
                    key={i}
                    component={RouterLink}
                    to={c.to}
                    color="text.secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    {c.label}
                  </Typography>
                ) : (
                  <Typography key={i} color="text.secondary">{c.label}</Typography>
                )
              )}
            </Breadcrumbs>
          )}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Кнопку фильтров показываем только если есть children */}
          {hasFilters && (
            <Button variant="outlined" onClick={() => setOpen(o => !o)}>
              {open ? 'Скрыть фильтры' : 'Фильтры'}
            </Button>
          )}
          {actions}
        </Stack>
      </Stack>

      {/* Сворачиваемая панель фильтров — только если есть children */}
      <AnimatePresence initial={false}>
        {hasFilters && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              {children}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
