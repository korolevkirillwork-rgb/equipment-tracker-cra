import * as React from 'react'
import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material'
import Sidebar, { drawerWidth } from './Sidebar'
import ConnectionBanner from './ConnectionBanner'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import UserMenu from './UserMenu'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          bgcolor: '#ffffff',
          color: 'text.primary',
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" noWrap sx={{ flex: 1 }}>Учет оборудования</Typography>
          <UserMenu />
        </Toolbar>
      </AppBar>

      <Sidebar />

      <Box component="main" sx={{ flexGrow: 1, ml: `${drawerWidth}px`, mt: '64px' }}>
        <ConnectionBanner />
        <Container sx={{ py: 2 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Container>
      </Box>
    </Box>
  )
}
