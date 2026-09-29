import React from 'react';
import { theme } from '../styles/theme.js';
import { useAdminAuth } from '../context/AdminAuthContext.js';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps): React.JSX.Element {
  const { logout } = useAdminAuth();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#ffffff',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: theme.text }}>
          {title}
        </h1>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: theme.successBg,
            color: theme.success,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: theme.success,
            }}
          />
          SYSTEM LIVE
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => logout()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: `1px solid ${theme.border}`,
            backgroundColor: '#ffffff',
            color: theme.textMuted,
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
