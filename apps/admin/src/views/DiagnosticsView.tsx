import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme.js';
import { adminApi } from '../api/admin-client.js';
import type {
  AdminSystemHealthDto,
  AdminRecommendationDiagnosticsDto,
  AdminOutboxJobDto,
} from '@platform/api-contracts';

export function DiagnosticsView(): React.JSX.Element {
  const [health, setHealth] = useState<AdminSystemHealthDto | null>(null);
  const [recs, setRecs] = useState<AdminRecommendationDiagnosticsDto | null>(null);
  const [outboxJobs, setOutboxJobs] = useState<AdminOutboxJobDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDiagnostics(): Promise<void> {
      try {
        const [healthRes, recsRes, outboxRes] = await Promise.all([
          adminApi.getHealth().catch(() => null),
          adminApi.getRecommendationDiagnostics().catch(() => null),
          adminApi.getOutboxJobs().catch(() => null),
        ]);

        if (healthRes) setHealth(healthRes.health);
        if (recsRes) setRecs(recsRes.diagnostics);
        if (outboxRes) setOutboxJobs(outboxRes.items);
      } finally {
        setLoading(false);
      }
    }
    loadDiagnostics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: theme.textMuted }}>Running system diagnostics...</div>
    );
  }

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Infrastructure Core */}
      <div>
        <h2
          style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 700, color: theme.text }}
        >
          Infrastructure & Latency Health
        </h2>
        {health && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textMuted, fontSize: '0.75rem', fontWeight: 600 }}>
                DATABASE (POSTGRESQL)
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: health.services.database.status === 'UP' ? theme.success : theme.error,
                }}
              >
                {health.services.database.status}
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSubtle, marginTop: '0.25rem' }}>
                Latency: {health.services.database.latencyMs}ms
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textMuted, fontSize: '0.75rem', fontWeight: 600 }}>
                MEMORY CONSUMPTION
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text }}>
                {health.memory.rssMb} MB RSS
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSubtle, marginTop: '0.25rem' }}>
                Heap: {health.memory.heapUsedMb} / {health.memory.heapTotalMb} MB
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textMuted, fontSize: '0.75rem', fontWeight: 600 }}>
                WORKERS & OUTBOX
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text }}>
                {health.services.workers.pendingJobsCount} Pending
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSubtle, marginTop: '0.25rem' }}>
                Workers: {health.services.workers.status}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textMuted, fontSize: '0.75rem', fontWeight: 600 }}>
                SYSTEM UPTIME
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text }}>
                {Math.floor(health.uptimeSeconds / 60)} mins
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSubtle, marginTop: '0.25rem' }}>
                Status: {health.status}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation Engine Diagnostics */}
      {recs && (
        <div>
          <h2
            style={{
              margin: '0 0 1rem 0',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: theme.text,
            }}
          >
            Recommendation Engine Diagnostics (Gate 13)
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>
                COMPUTED FEATURE VECTORS
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {recs.featuresCoverageCount} users
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>
                24H RECOMMENDATION EXPOSURES
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {recs.exposuresLast24hCount} exposures
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: `1px solid ${theme.border}`,
              padding: '1rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Active Model Versions & Rollouts
            </div>
            {recs.activeModelVersions.length === 0 ? (
              <div style={{ color: theme.textSubtle, fontSize: '0.8125rem' }}>
                No active model versions deployed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recs.activeModelVersions.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      backgroundColor: theme.bg,
                      borderRadius: '0.25rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div>
                      <b>{m.version}</b> ({m.mode})
                    </div>
                    <div>
                      Rollout: <b>{m.rolloutPercentage}%</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transactional Outbox Pipeline */}
      <div>
        <h2
          style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 700, color: theme.text }}
        >
          Transactional Outbox Event Dispatch
        </h2>
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
                <th style={{ padding: '0.625rem 1rem' }}>Event Type</th>
                <th style={{ padding: '0.625rem 1rem' }}>Aggregate</th>
                <th style={{ padding: '0.625rem 1rem' }}>Status</th>
                <th style={{ padding: '0.625rem 1rem' }}>Attempts</th>
                <th style={{ padding: '0.625rem 1rem' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {outboxJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: '1.5rem', textAlign: 'center', color: theme.textSubtle }}
                  >
                    Outbox queue is empty.
                  </td>
                </tr>
              ) : (
                outboxJobs.slice(0, 10).map((job) => (
                  <tr key={job.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td
                      style={{ padding: '0.625rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}
                    >
                      {job.eventType}
                    </td>
                    <td style={{ padding: '0.625rem 1rem' }}>
                      {job.aggregateType}: {job.aggregateId.slice(0, 8)}
                    </td>
                    <td style={{ padding: '0.625rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          backgroundColor:
                            job.status === 'PUBLISHED' ? theme.successBg : theme.warningBg,
                          color: job.status === 'PUBLISHED' ? theme.success : theme.warning,
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 1rem' }}>{job.attempts}</td>
                    <td style={{ padding: '0.625rem 1rem', color: theme.textMuted }}>
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
