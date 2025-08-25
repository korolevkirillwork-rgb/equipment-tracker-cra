import * as React from 'react'
import { Box, Typography } from '@mui/material'
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridToolbarQuickFilter,
  GridToolbarExport,
} from '@mui/x-data-grid'

type Props = {
  selectionCount: number
  fileName?: string
}

export default function SmartGridToolbar({ selectionCount, fileName }: Props) {
  return (
    <GridToolbarContainer sx={{ justifyContent: 'space-between', p: 1, gap: 1 }}>
      <Box display="flex" alignItems="center" gap={1}>
        <GridToolbarColumnsButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport
          csvOptions={{
            utf8WithBom: true,
            fileName: fileName || 'export',
          }}
          printOptions={{ disableToolbarButton: true }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Выбрано: <b>{selectionCount}</b>
        </Typography>
      </Box>
      <GridToolbarQuickFilter debounceMs={300} />
    </GridToolbarContainer>
  )
}
