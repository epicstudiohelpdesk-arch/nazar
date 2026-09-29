import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme.js';
import { adminApi } from '../api/admin-client.js';
import type { AdminAuditLogDto, AdminSecurityEventDto } from '@platform/api-contracts';

export function AuditView(): React.JSX.Element {
  const [tab, setTab] = useState<'AUDIT' | 'SECURITY'>('AUDIT');
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDto[]>([]);
  const [securityEvents, setSecurityEvents] = useState<AdminSecurityEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const fetchAuditLogs = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({
        action: actionFilter.trim() || undefined,
        resourceType: resourceFilter.trim() || undefined,
        limit: 40,
      });
      setAuditLogs(res.items);
    } catch (err: unknown) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityEvents = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await adminApi.getSecurityEvents({ limit: 40 });
      setSecurityEvents(res.items);
    } catch (err: unknown) {
      console.error('Failed to fetch security events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'AUDIT') {
      fetchAuditLogs();
    } else {
      fetchSecurityEvents();
    }
  }, [tab]);

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setTab('AUDIT')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              backgroundColor: tab === 'AUDIT' ? theme.primary : 'transparent',
              color: tab === 'AUDIT' ? '#ffffff' : theme.textMuted,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Staff Audit Logs (Append-Only)
          </button>
          <button
            onClick={() => setTab('SECURITY')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              backgroundColor: tab === 'SECURITY' ? theme.primary : 'transparent',
              color: tab === 'SECURITY' ? '#ffffff' : theme.textMuted,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Security Telemetry Events
          </button>
        </div>

        {tab === 'AUDIT' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Filter by action..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
              style={{
                padding: '0.375rem 0.625rem',
                borderRadius: '0.25rem',
                border: `1px solid ${theme.border}`,
                fontSize: '0.8125rem',
              }}
            />
            <input
              type="text"
              placeholder="Filter by resource..."
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
              style={{
                padding: '0.375rem 0.625rem',
                borderRadius: '0.25rem',
                border: `1px solid ${theme.border}`,
                fontSize: '0.8125rem',
              }}
            />
            <button
              onClick={fetchAuditLogs}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.25rem',
                border: 'none',
                backgroundColor: theme.sidebarBg,
                color: '#fff',
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Filter
            </button>
          </div>
        )}
      </div>

      {tab === 'AUDIT' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            border: `1px solid ${theme.border}`,
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8125rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Timestamp</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Staff Actor</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Role</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Action</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Resource</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                  Mandatory Reason
                </th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Break-Glass</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: '2rem', textAlign: 'center', color: theme.textSubtle }}
                  >
                    {loading ? 'Loading audit records...' : 'No audit records logged yet.'}
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        color: theme.textMuted,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{log.actorEmail}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          backgroundColor: theme.primaryLight,
                          color: theme.primaryDark,
                        }}
                      >
                        {log.actorRole || 'ADMIN'}
                      </span>
                    </td>
                    <td
                      style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}
                    >
                      {log.action}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {log.resourceType}: {log.resourceId ? log.resourceId.slice(0, 8) : 'N/A'}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        maxWidth: '300px',
                        wordBreak: 'break-word',
                        color: theme.text,
                      }}
                    >
                      {log.reason}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {log.isBreakGlass ? (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            backgroundColor: theme.errorBg,
                            color: theme.error,
                          }}
                        >
                          BREAK GLASS
                        </span>
                      ) : (
                        <span style={{ color: theme.textSubtle }}>Standard</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'SECURITY' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            border: `1px solid ${theme.border}`,
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8125rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Timestamp</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Event Type</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Severity</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>User ID</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {securityEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: '2rem', textAlign: 'center', color: theme.textSubtle }}
                  >
                    {loading ? 'Loading security telemetry...' : 'No security events recorded.'}
                  </td>
                </tr>
              ) : (
                securityEvents.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        color: theme.textMuted,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{evt.eventType}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          backgroundColor: evt.severity === 'CRITICAL' ? theme.errorBg : '#e0f2fe',
                          color: evt.severity === 'CRITICAL' ? theme.error : '#0369a1',
                        }}
                      >
                        {evt.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                      {evt.userId || 'System'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                      {evt.ipAddress || 'Internal'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
