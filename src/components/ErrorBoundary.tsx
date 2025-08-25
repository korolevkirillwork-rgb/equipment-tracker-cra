import * as React from 'react'
import { Box, Button, Typography } from '@mui/material'

type State = { hasError: boolean }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => window.location.reload()

  render() {
    if (this.state.hasError) {
      return (
        <Box p={4}>
          <Typography variant="h6" gutterBottom>Что-то пошло не так.</Typography>
          <Button variant="contained" onClick={this.handleReload}>Перезагрузить</Button>
        </Box>
      )
    }
    return this.props.children as any
  }
}
