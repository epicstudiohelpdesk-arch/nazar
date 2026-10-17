import React, { useState } from 'react';
import { theme } from '../styles/theme.js';
import { useAdminAuth } from '../context/AdminAuthContext.js';

export function LoginView(): React.JSX.Element {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('admin@nazar.internal');
  const [password, setPassword] = useState('SuperAdmin123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0c0f17',
        backgroundImage:
          'radial-gradient(circle at 50% 20%, rgba(219, 39, 119, 0.12) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(30, 41, 59, 0.4) 0%, transparent 60%)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '1rem',
          padding: '2.25rem',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          {/* Nazar Vector Emblem */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '26px',
              backgroundColor: 'rgba(219, 39, 119, 0.12)',
              border: '1px solid rgba(219, 39, 119, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.875rem',
              boxShadow: '0 0 20px rgba(219, 39, 119, 0.25)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <path
                d="M18 6C10.5 6 4.2 11.4 1.5 18c2.7 6.6 9 12 16.5 12s13.8-5.4 16.5-12C31.8 11.4 25.5 6 18 6z"
                stroke="#ec4899"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="18" r="6" stroke="#ffffff" strokeWidth="2" fill="#db2777" />
              <circle cx="18" cy="18" r="2.5" fill="#ffffff" />
            </svg>
          </div>

          <h1
            style={{
              margin: '0 0 0.375rem 0',
              fontSize: '1.375rem',
              fontWeight: 800,
              color: '#f8fafc',
              letterSpacing: '-0.02em',
            }}
          >
            Nazar Operations Console
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: '#94a3b8',
              letterSpacing: '0.01em',
            }}
          >
            Authorized Personnel Control Plane (Gate 14)
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '0.625rem 0.875rem',
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              borderRadius: '0.5rem',
              color: '#f87171',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#cbd5e1',
                marginBottom: '0.375rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Operator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@nazar.internal"
              style={{
                width: '100%',
                padding: '0.6875rem 0.875rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(2, 6, 23, 0.65)',
                color: '#f8fafc',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#db2777';
                e.target.style.boxShadow = '0 0 0 3px rgba(219, 39, 119, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#cbd5e1',
                marginBottom: '0.375rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Staff Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: '100%',
                padding: '0.6875rem 0.875rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(2, 6, 23, 0.65)',
                color: '#f8fafc',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#db2777';
                e.target.style.boxShadow = '0 0 0 3px rgba(219, 39, 119, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: theme.primary,
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(219, 39, 119, 0.4)',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = theme.primaryDark;
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = theme.primary;
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Console'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: theme.textSubtle,
            lineHeight: 1.5,
          }}
        >
          All administrative actions are strictly audited and permanently logged.
        </div>
      </div>
    </div>
  );
}
