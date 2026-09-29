import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme.js';
import { adminApi } from '../api/admin-client.js';
import type { AdminUserSummaryDto, AdminUserDetailDto } from '@platform/api-contracts';
import { useAdminAuth } from '../context/AdminAuthContext.js';

export function UsersView(): React.JSX.Element {
  const { hasPermission } = useAdminAuth();
  const [users, setUsers] = useState<AdminUserSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal actions
  const [actionType, setActionType] = useState<'SUSPEND' | 'RESTORE' | 'REVOKE_SESSIONS' | null>(
    null
  );
  const [actionReason, setActionReason] = useState('');
  const [actionDurationDays, setActionDurationDays] = useState<number | undefined>(undefined);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await adminApi.searchUsers({
        query: query.trim() || undefined,
        status: (statusFilter || undefined) as any,
        limit: 25,
      });
      setUsers(res.items);
    } catch (err: unknown) {
      console.error('Failed to search users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  const handleSelectUser = async (userId: string): Promise<void> => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setActionNotice(null);
    try {
      const res = await adminApi.getUserDetail(userId);
      setUserDetail(res.user);
    } catch (err: unknown) {
      console.error('Failed to load user detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExecuteAction = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedUserId || !actionType) return;
    if (!actionReason.trim() || actionReason.trim().length < 3) {
      alert('Mandatory reason must be at least 3 characters.');
      return;
    }

    setActionSubmitting(true);
    try {
      if (actionType === 'SUSPEND') {
        await adminApi.suspendUser(selectedUserId, {
          reason: actionReason,
          durationDays: actionDurationDays,
        });
        setActionNotice(`User successfully suspended.`);
      } else if (actionType === 'RESTORE') {
        await adminApi.restoreUser(selectedUserId, { reason: actionReason });
        setActionNotice(`User successfully restored to active status.`);
      } else if (actionType === 'REVOKE_SESSIONS') {
        await adminApi.revokeSessions(selectedUserId, { reason: actionReason });
        setActionNotice(`All active sessions successfully revoked.`);
      }

      setActionType(null);
      setActionReason('');
      setActionDurationDays(undefined);
      await handleSelectUser(selectedUserId);
      await fetchUsers();
    } catch (err: unknown) {
      alert(`Action failed: ${(err as Error).message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: `1px solid ${theme.border}`,
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
          placeholder="Search by name or UUID..."
          style={{
            flex: 1,
            padding: '0.625rem 0.875rem',
            borderRadius: '0.375rem',
            border: `1px solid ${theme.border}`,
            fontSize: '0.875rem',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.625rem 0.875rem',
            borderRadius: '0.375rem',
            border: `1px solid ${theme.border}`,
            fontSize: '0.875rem',
            backgroundColor: '#ffffff',
          }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="BANNED">BANNED</option>
          <option value="DEACTIVATED">DEACTIVATED</option>
        </select>
        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '0.375rem',
            border: 'none',
            backgroundColor: theme.primary,
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {actionNotice && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: theme.successBg,
            border: `1px solid ${theme.success}`,
            borderRadius: '0.375rem',
            color: theme.success,
            fontSize: '0.875rem',
          }}
        >
          ✓ {actionNotice}
        </div>
      )}

      {/* Main Grid: Table & Inspection Drawer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedUserId ? '1fr 450px' : '1fr',
          gap: '1.5rem',
        }}
      >
        {/* Users Table */}
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
              fontSize: '0.875rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Display Name</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Identifier</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Reports</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Joined</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: '2rem', textAlign: 'center', color: theme.textSubtle }}
                  >
                    {loading ? 'Fetching users...' : 'No users found matching query.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: `1px solid ${theme.border}`,
                      backgroundColor: selectedUserId === u.id ? theme.primaryLight : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: theme.text }}>
                      {u.displayName || 'No profile'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontWeight: 600,
                          backgroundColor: u.status === 'ACTIVE' ? theme.successBg : theme.errorBg,
                          color: u.status === 'ACTIVE' ? theme.success : theme.error,
                        }}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                      {u.phoneNumber || u.email || u.id.slice(0, 8)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        color: u.reportsCount > 0 ? theme.error : theme.textMuted,
                        fontWeight: u.reportsCount > 0 ? 700 : 400,
                      }}
                    >
                      {u.reportsCount}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleSelectUser(u.id)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.25rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: '#ffffff',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* User Detail Drawer */}
        {selectedUserId && (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: `1px solid ${theme.border}`,
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${theme.border}`,
                paddingBottom: '0.75rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: theme.text }}>
                User Investigation
              </h3>
              <button
                onClick={() => setSelectedUserId(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div style={{ color: theme.textMuted }}>Loading user records...</div>
            ) : userDetail ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  fontSize: '0.875rem',
                }}
              >
                <div>
                  <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>USER ID</div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{userDetail.id}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>STATUS</div>
                    <div style={{ fontWeight: 600 }}>{userDetail.status}</div>
                  </div>
                  <div>
                    <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>IDENTIFIER</div>
                    <div>{userDetail.phoneNumber || userDetail.email || 'None'}</div>
                  </div>
                </div>

                {userDetail.profile && (
                  <div
                    style={{
                      backgroundColor: theme.bg,
                      padding: '0.75rem',
                      borderRadius: '0.375rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      {userDetail.profile.displayName}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: '0.8125rem' }}>
                      {userDetail.profile.bio || 'No biography entered'}
                    </div>
                    <div
                      style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: theme.textSubtle }}
                    >
                      Gender: {userDetail.profile.gender} · Media items:{' '}
                      {userDetail.profile.media.length}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: theme.text }}>
                    Safety Summary
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div>
                      Reports Received: <b>{userDetail.safetyStats.reportsReceivedCount}</b>
                    </div>
                    <div>
                      Blocks Received: <b>{userDetail.safetyStats.blocksReceivedCount}</b>
                    </div>
                    <div>
                      Active Cases: <b>{userDetail.safetyStats.activeModerationCasesCount}</b>
                    </div>
                    <div>
                      Active Sessions: <b>{userDetail.recentSessions.length}</b>
                    </div>
                  </div>
                </div>

                {/* Operations / Actions */}
                <div
                  style={{
                    borderTop: `1px solid ${theme.border}`,
                    paddingTop: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: theme.text }}>
                    Account Interventions (Audited)
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {hasPermission('users.suspend') && userDetail.status !== 'SUSPENDED' && (
                      <button
                        onClick={() => {
                          setActionType('SUSPEND');
                          setActionReason('');
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          backgroundColor: theme.error,
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Suspend User
                      </button>
                    )}
                    {hasPermission('users.restore') && userDetail.status === 'SUSPENDED' && (
                      <button
                        onClick={() => {
                          setActionType('RESTORE');
                          setActionReason('');
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          backgroundColor: theme.success,
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Restore User
                      </button>
                    )}
                    {hasPermission('users.sessions.revoke') && (
                      <button
                        onClick={() => {
                          setActionType('REVOKE_SESSIONS');
                          setActionReason('');
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.25rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: '#ffffff',
                          color: theme.text,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Revoke Sessions
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Mandatory Reason Action Modal */}
      {actionType && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: theme.text,
              }}
            >
              Confirm {actionType.replace('_', ' ')}
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: theme.textMuted }}>
              This operational change is subject to immutable audit logging. An explicit reason is
              strictly mandatory.
            </p>

            <form
              onSubmit={handleExecuteAction}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    marginBottom: '0.25rem',
                  }}
                >
                  Mandatory Operational Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Detail the investigation finding or operator reason (min 3 chars)..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${theme.border}`,
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {actionType === 'SUSPEND' && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      marginBottom: '0.25rem',
                    }}
                  >
                    Duration in Days (Optional, leave blank for permanent)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={actionDurationDays || ''}
                    onChange={(e) =>
                      setActionDurationDays(
                        e.target.value ? parseInt(e.target.value, 10) : undefined
                      )
                    }
                    placeholder="e.g. 7"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: `1px solid ${theme.border}`,
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  disabled={actionSubmitting}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting || actionReason.trim().length < 3}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    backgroundColor: actionType === 'SUSPEND' ? theme.error : theme.primary,
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: actionSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {actionSubmitting ? 'Executing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
