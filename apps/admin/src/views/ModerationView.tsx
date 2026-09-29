import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme.js';
import { adminApi } from '../api/admin-client.js';
import type { AdminModerationCaseDto, AdminReportDto } from '@platform/api-contracts';
import { useAdminAuth } from '../context/AdminAuthContext.js';

export function ModerationView(): React.JSX.Element {
  const { admin } = useAdminAuth();
  const [tab, setTab] = useState<'CASES' | 'REPORTS'>('CASES');
  const [cases, setCases] = useState<AdminModerationCaseDto[]>([]);
  const [reports, setReports] = useState<AdminReportDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [caseStatusFilter, setCaseStatusFilter] = useState('');
  const [casePriorityFilter, setCasePriorityFilter] = useState('');

  // Selected item & decision modal
  const [selectedCase, setSelectedCase] = useState<AdminModerationCaseDto | null>(null);
  const [decisionAction, setDecisionAction] = useState<
    'NO_ACTION' | 'WARNING' | 'SUSPEND' | 'BAN' | 'CONTENT_REMOVAL'
  >('WARNING');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchCases = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await adminApi.getModerationCases({
        status: (caseStatusFilter || undefined) as any,
        priority: (casePriorityFilter || undefined) as any,
        limit: 30,
      });
      setCases(res.items);
    } catch (err: unknown) {
      console.error('Failed to load moderation cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await adminApi.getReports({ limit: 30 });
      setReports(res.items);
    } catch (err: unknown) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'CASES') {
      fetchCases();
    } else {
      fetchReports();
    }
  }, [tab, caseStatusFilter, casePriorityFilter]);

  const handleAssignToMe = async (caseId: string): Promise<void> => {
    if (!admin) return;
    try {
      await adminApi.assignCase(caseId, {
        assignedAdminId: admin.id,
        reason: 'Staff triage self-assignment',
      });
      setNotice('Case successfully assigned.');
      fetchCases();
    } catch (err: unknown) {
      alert(`Assignment failed: ${(err as Error).message}`);
    }
  };

  const handleDecideCase = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!decisionReason.trim() || decisionReason.trim().length < 3) {
      alert('Mandatory reason must be at least 3 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.decideCase(selectedCase.id, {
        action: decisionAction,
        reason: decisionReason,
        notes: decisionNotes || undefined,
      });
      setNotice(`Decision [${decisionAction}] applied to case ${selectedCase.id}`);
      setSelectedCase(null);
      setDecisionReason('');
      setDecisionNotes('');
      fetchCases();
    } catch (err: unknown) {
      alert(`Decision failed: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveReport = async (
    reportId: string,
    status: 'RESOLVED' | 'DISMISSED'
  ): Promise<void> => {
    const reason = prompt(`Enter mandatory reason to mark report ${status}:`);
    if (!reason || reason.trim().length < 3) {
      alert('Action cancelled: Reason of at least 3 characters is mandatory.');
      return;
    }

    try {
      await adminApi.resolveReport(reportId, {
        status,
        reason: reason.trim(),
      });
      setNotice(`Report ${reportId} marked as ${status}`);
      fetchReports();
    } catch (err: unknown) {
      alert(`Report resolution failed: ${(err as Error).message}`);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      CRITICAL: { bg: theme.errorBg, text: theme.error },
      URGENT: { bg: theme.errorBg, text: theme.error },
      HIGH: { bg: theme.warningBg, text: theme.warning },
      NORMAL: { bg: '#e0f2fe', text: '#075985' },
      LOW: { bg: '#f1f5f9', text: '#475569' },
    };
    const c = colorMap[priority] || { bg: '#f1f5f9', text: '#475569' };
    return (
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          padding: '0.2rem 0.5rem',
          borderRadius: '0.25rem',
          backgroundColor: c.bg,
          color: c.text,
        }}
      >
        {priority}
      </span>
    );
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Sub Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => setTab('CASES')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '0.375rem',
            backgroundColor: tab === 'CASES' ? theme.primary : 'transparent',
            color: tab === 'CASES' ? '#ffffff' : theme.textMuted,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Moderation Cases Queue
        </button>
        <button
          onClick={() => setTab('REPORTS')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '0.375rem',
            backgroundColor: tab === 'REPORTS' ? theme.primary : 'transparent',
            color: tab === 'REPORTS' ? '#ffffff' : theme.textMuted,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Raw Reports Queue
        </button>
      </div>

      {notice && (
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
          ✓ {notice}
        </div>
      )}

      {tab === 'CASES' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
              value={caseStatusFilter}
              onChange={(e) => setCaseStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: `1px solid ${theme.border}`,
                fontSize: '0.875rem',
              }}
            >
              <option value="">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="DISMISSED">DISMISSED</option>
            </select>
            <select
              value={casePriorityFilter}
              onChange={(e) => setCasePriorityFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: `1px solid ${theme.border}`,
                fontSize: '0.875rem',
              }}
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="NORMAL">NORMAL</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          {/* Cases Table */}
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
                <tr
                  style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}
                >
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Case ID</th>
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Reports</th>
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Opened</th>
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Assignee</th>
                  <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: '2rem', textAlign: 'center', color: theme.textSubtle }}
                    >
                      {loading ? 'Fetching cases...' : 'No moderation cases in queue.'}
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {c.id.slice(0, 13)}...
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{getPriorityBadge(c.priority)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.status}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <b>{c.reportCount}</b> reports
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                        {c.assignedAdminId ? c.assignedAdminId.slice(0, 8) : 'Unassigned'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                        {!c.assignedAdminId && (
                          <button
                            onClick={() => handleAssignToMe(c.id)}
                            style={{
                              padding: '0.375rem 0.5rem',
                              borderRadius: '0.25rem',
                              border: `1px solid ${theme.border}`,
                              backgroundColor: '#ffffff',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Assign to Me
                          </button>
                        )}
                        {c.status !== 'RESOLVED' && (
                          <button
                            onClick={() => {
                              setSelectedCase(c);
                              setDecisionReason('');
                              setDecisionNotes('');
                            }}
                            style={{
                              padding: '0.375rem 0.5rem',
                              borderRadius: '0.25rem',
                              border: 'none',
                              backgroundColor: theme.primary,
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Decide
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'REPORTS' && (
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
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Report ID</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Reason Category</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Target Type</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Submitted</th>
                <th style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: '2rem', textAlign: 'center', color: theme.textSubtle }}
                  >
                    {loading ? 'Fetching reports...' : 'No reports found.'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {r.id.slice(0, 13)}...
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{r.reasonCategory}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{r.targetType}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{r.status}</td>
                    <td style={{ padding: '0.75rem 1rem', color: theme.textMuted }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                      {r.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => handleResolveReport(r.id, 'RESOLVED')}
                            style={{
                              padding: '0.375rem 0.5rem',
                              borderRadius: '0.25rem',
                              border: 'none',
                              backgroundColor: theme.success,
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id, 'DISMISSED')}
                            style={{
                              padding: '0.375rem 0.5rem',
                              borderRadius: '0.25rem',
                              border: `1px solid ${theme.border}`,
                              backgroundColor: '#ffffff',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Decision Modal */}
      {selectedCase && (
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
              maxWidth: '500px',
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
              Render Moderation Decision
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: theme.textMuted }}>
              Case Subject: {selectedCase.subjectId} ({selectedCase.subjectType}).
            </p>

            <form
              onSubmit={handleDecideCase}
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
                  Decision Action *
                </label>
                <select
                  value={decisionAction}
                  onChange={(e) => setDecisionAction(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${theme.border}`,
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="WARNING">Issue Formal Warning</option>
                  <option value="CONTENT_REMOVAL">Remove Reported Content</option>
                  <option value="SUSPEND">Account Suspension (30 Days)</option>
                  <option value="BAN">Permanent Account Ban</option>
                  <option value="NO_ACTION">No Action / False Positive</option>
                </select>
              </div>

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
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="State the regulatory / community safety policy rationale..."
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

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    marginBottom: '0.25rem',
                  }}
                >
                  Staff Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Additional context or internal references..."
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
                  onClick={() => setSelectedCase(null)}
                  disabled={submitting}
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
                  disabled={submitting || decisionReason.trim().length < 3}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    backgroundColor: theme.primary,
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {submitting ? 'Applying...' : 'Apply Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
