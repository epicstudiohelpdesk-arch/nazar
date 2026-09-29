import React, { useState } from 'react';
import { theme } from './styles/theme.js';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext.js';
import { Sidebar, type AdminViewType } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { LoginView } from './views/LoginView.js';
import { DashboardView } from './views/DashboardView.js';
import { UsersView } from './views/UsersView.js';
import { ModerationView } from './views/ModerationView.js';
import { AuditView } from './views/AuditView.js';
import { DiagnosticsView } from './views/DiagnosticsView.js';

function AdminConsoleLayout(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const [currentView, setCurrentView] = useState<AdminViewType>('dashboard');

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: theme.bg,
          color: theme.textMuted,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '1rem',
        }}
      >
        Initializing secure administrative session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const viewTitles: Record<AdminViewType, string> = {
    dashboard: 'Platform Overview & Operational KPIs',
    users: 'User Account Investigation & Interventions',
    moderation: 'Trust & Safety Moderation Queues',
    audit: 'Immutable Administrative Audit Log Trail',
    diagnostics: 'Infrastructure Health & Recommendation Diagnostics',
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: theme.bg,
      }}
    >
      <Sidebar currentView={currentView} onSelectView={setCurrentView} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title={viewTitles[currentView]} />

        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: theme.bg }}>
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'users' && <UsersView />}
          {currentView === 'moderation' && <ModerationView />}
          {currentView === 'audit' && <AuditView />}
          {currentView === 'diagnostics' && <DiagnosticsView />}
        </main>
      </div>
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <AdminAuthProvider>
      <AdminConsoleLayout />
    </AdminAuthProvider>
  );
}
