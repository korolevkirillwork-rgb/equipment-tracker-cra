import * as React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import RequireAuth from './components/RequireAuth'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import EquipmentPage from './pages/EquipmentPage'
import Shipments from './pages/Shipments'
import InRepair from './pages/InRepair'
import Login from './pages/Login'

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="in_repair" element={<InRepair />} />
              <Route path="tsd" element={<EquipmentPage table="tsd" />} />
              <Route path="finger_scanners" element={<EquipmentPage table="finger_scanners" />} />
              <Route path="desktop_scanners" element={<EquipmentPage table="desktop_scanners" />} />
              <Route path="tablets" element={<EquipmentPage table="tablets" />} />
              <Route path="shipments" element={<Shipments />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </HashRouter>
  )
}
