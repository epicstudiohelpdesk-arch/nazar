import React from 'react';
import { colors } from '@platform/ui';

export function App(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: colors.neutral[50],
        color: colors.neutral[900],
      }}
    >
      <header>
        <h1 style={{ color: colors.primary[600], marginBottom: '0.5rem' }}>Nazar Admin Console</h1>
        <p style={{ color: colors.neutral[700] }}>
          Platform Operations & Moderation Shell (Gate 01)
        </p>
      </header>
    </div>
  );
}
