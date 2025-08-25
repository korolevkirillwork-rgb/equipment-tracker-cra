import { createTheme } from '@mui/material/styles'
import '@mui/x-data-grid/themeAugmentation' // важно: добавляет MuiDataGrid в типы theme.components

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#111827' },          // gray-900
    secondary: { main: '#374151' },        // gray-700
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#4b5563' },
    divider: '#e5e7eb'
  },
  shape: { borderRadius: 0 },              // без скруглений
  typography: {
    fontFamily: ['Inter', 'Segoe UI', 'Roboto', 'Arial', 'system-ui', 'sans-serif'].join(','),
    h6: { fontWeight: 600 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        html, body, #root { height: 100%; background:#fff; }
        * { scrollbar-color: #9ca3af #f3f4f6; }
      `
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 0, boxShadow: 'none', border: '1px solid #e5e7eb' }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 0,
          textTransform: 'none',
          transition: 'transform 120ms ease, background-color 120ms ease, opacity 120ms ease',
          '&:hover': { transform: 'translateY(-1px)' }
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#ffffff', color: '#111827', borderBottom: '1px solid #e5e7eb' }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #e5e7eb', backgroundColor: '#ffffff' }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          '&.Mui-selected': { backgroundColor: '#f3f4f6' },
          '&.Mui-selected:hover': { backgroundColor: '#e5e7eb' }
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          borderColor: '#e5e7eb',
          '--DataGrid-rowBorderColor': '#e5e7eb',
          '& .MuiDataGrid-columnHeaders': { backgroundColor: '#f7f7f7' },
          '& .MuiDataGrid-row:hover': { backgroundColor: '#fafafa' }
        }
      }
    }
  }
})
