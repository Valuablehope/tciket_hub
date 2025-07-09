import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CreateTicketPage from './pages/CreateTicketPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const App = () => (
  <AuthProvider>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Authenticated Routes wrapped in Layout */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<DashboardPage />} />

        {/* Tickets: Admin, HIS, User */}
        <Route
          path="tickets"
          element={
            <AuthGuard requiredRoles={['Admin', 'HIS', 'User']}>
              <TicketsPage />
            </AuthGuard>
          }
        />
        <Route
          path="tickets/new"
          element={
            <AuthGuard requiredRoles={['Admin', 'HIS', 'User']}>
              <CreateTicketPage />
            </AuthGuard>
          }
        />
        <Route
          path="tickets/:id"
          element={
            <AuthGuard requiredRoles={['Admin', 'HIS', 'User']}>
              <TicketDetailPage />
            </AuthGuard>
          }
        />

        {/* Reports: Admin, HIS, Viewer */}
        <Route
          path="reports"
          element={
            <AuthGuard requiredRoles={['Admin', 'HIS', 'Viewer']}>
              <ReportsPage />
            </AuthGuard>
          }
        />

        {/* Settings: All Authenticated */}
        <Route path="settings" element={<SettingsPage />} />

        {/* Catch-all inside authenticated layout */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Catch-all for unauthenticated users */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>

    <Toaster />
  </AuthProvider>
);

export default App;
