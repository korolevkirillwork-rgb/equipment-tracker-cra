import * as React from 'react'
import { Avatar, IconButton, Menu, MenuItem, ListItemIcon, Tooltip } from '@mui/material'
import Logout from '@mui/icons-material/Logout'
import { useAuth } from '../contexts/AuthContext'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const email = user?.email ?? ''
  const letter = email ? email[0].toUpperCase() : 'U'

  return (
    <>
      <Tooltip title={email || 'Пользователь'}>
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#111' }}>{letter}</Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => signOut()}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          Выйти
        </MenuItem>
      </Menu>
    </>
  )
}
