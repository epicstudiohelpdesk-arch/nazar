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
        height: '52px',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: theme.text,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h1>
        <span
          style={{
            fontSize: '0.6875rem',
            padding: '0.175rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: theme.successBg,
            color: theme.success,
            fontWeight: 700,
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            border: `1px solid rgba(22, 163, 74, 0.2)`,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: theme.success,
              boxShadow: `0 0 6px ${theme.success}`,
            }}
          />
          SYSTEM LIVE
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => logout()}
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '0.375rem',
            border: `1px solid ${theme.border}`,
            backgroundColor: '#ffffff',
            color: theme.textMuted,
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.primary;
            e.currentTarget.style.color = theme.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.border;
            e.currentTarget.style.color = theme.textMuted;
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
