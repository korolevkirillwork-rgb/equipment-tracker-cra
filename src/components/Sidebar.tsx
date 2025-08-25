import * as React from 'react'
import { Box, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import ScannerIcon from '@mui/icons-material/DocumentScanner'
import TabletIcon from '@mui/icons-material/TabletMac'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import BuildIcon from '@mui/icons-material/Build'
import { Link as RouterLink, useLocation } from 'react-router-dom'

export const drawerWidth = 224

export default function Sidebar() {
  const { pathname } = useLocation()
  const Item = (opts: { to: string, icon: React.ReactNode, label: string }) => (
    <ListItemButton
      component={RouterLink}
      to={opts.to}
      selected={pathname === opts.to || (opts.to === '/' && pathname === '/')}
    >
      <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>{opts.icon}</ListItemIcon>
      <ListItemText primary={opts.label} />
    </ListItemButton>
  )

  const content = (
    <Box role="navigation" sx={{ width: drawerWidth }}>
      <Toolbar />
      <Divider />
      {/* Главная */}
      <List dense>
        <Item to="/" icon={<DashboardIcon />} label="Главная" />
      </List>

      <Divider />
      {/* Типы оборудования */}
      <List dense>
        <Item to="/tsd" icon={<WarehouseIcon />} label="ТСД" />
        <Item to="/finger_scanners" icon={<QrCodeScannerIcon />} label="Напалечные" />
        <Item to="/desktop_scanners" icon={<ScannerIcon />} label="Настольные" />
        <Item to="/tablets" icon={<TabletIcon />} label="Планшеты" />
      </List>

      <Divider />
      {/* Логистика/ремонт */}
      <List dense>
        <Item to="/shipments" icon={<LocalShippingIcon />} label="Отгрузки" />
        <Item to="/in_repair" icon={<BuildIcon />} label="В ремонте" />
      </List>
    </Box>
  )

  return (
    <Drawer
      variant="permanent"
      open
      sx={{ '& .MuiDrawer-paper': { width: drawerWidth, borderRight: '1px solid #e5e7eb', backgroundColor: '#fff' } }}
    >
      {content}
    </Drawer>
  )
}
