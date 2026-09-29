import React from 'react';
import { theme } from '../styles/theme.js';
import { useAdminAuth } from '../context/AdminAuthContext.js';

export type AdminViewType = 'dashboard' | 'users' | 'moderation' | 'audit' | 'diagnostics';

interface SidebarProps {
  currentView: AdminViewType;
  onSelectView: (view: AdminViewType) => void;
}

export function Sidebar({ currentView, onSelectView }: SidebarProps): React.JSX.Element {
  const { admin, hasPermission } = useAdminAuth();

  const navItems: { id: AdminViewType; label: string; icon: string; permission?: string }[] = [
    { id: 'dashboard', label: 'Platform Dashboard', icon: '📊', permission: 'health.read' },
    { id: 'users', label: 'User Operations', icon: '👥', permission: 'users.read' },
    { id: 'moderation', label: 'Moderation Queue', icon: '🛡️', permission: 'moderation.read' },
    { id: 'audit', label: 'Audit Trail', icon: '📜', permission: 'audit.read' },
    { id: 'diagnostics', label: 'Health & Diagnostics', icon: '🩺', permission: 'health.read' },
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: theme.sidebarBg,
        color: theme.textLight,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box',
        borderRight: `1px solid ${theme.borderDark}`,
      }}
    >
      <div style={{ padding: '1.5rem', borderBottom: `1px solid ${theme.borderDark}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>👁️</span>
          <div>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 'bold',
                margin: 0,
                letterSpacing: '0.05em',
              }}
            >
              NAZAR ADMIN
            </h2>
            <span style={{ fontSize: '0.75rem', color: theme.primary, fontWeight: 600 }}>
              CONTROL PLANE
            </span>
          </div>
        </div>
      </div>

      <nav
        style={{
          flex: 1,
          padding: '1rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {navItems.map((item) => {
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? theme.primaryDark : 'transparent',
                color: isActive ? '#ffffff' : theme.textSubtle,
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {admin && (
        <div
          style={{
            padding: '1rem',
            borderTop: `1px solid ${theme.borderDark}`,
            backgroundColor: theme.sidebarDark,
          }}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: theme.textLight }}>
            {admin.firstName} {admin.lastName}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: theme.textSubtle,
              marginBottom: '0.5rem',
              wordBreak: 'break-all',
            }}
          >
            {admin.email}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {admin.roles.map((r) => (
              <span
                key={r}
                style={{
                  fontSize: '0.625rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  backgroundColor: theme.primaryDark,
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
