import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme.js';
import { adminApi } from '../api/admin-client.js';
import type { AdminDashboardMetricsDto } from '@platform/api-contracts';

export function DashboardView(): React.JSX.Element {
  const [metrics, setMetrics] = useState<AdminDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        const res = await adminApi.getDashboard();
        setMetrics(res.metrics);
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to fetch dashboard metrics');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: theme.textMuted }}>Loading operational metrics...</div>
    );
  }

  if (error || !metrics) {
    return (
      <div style={{ padding: '2rem', color: theme.error }}>
        Failed to load operational dashboard: {error}
      </div>
    );
  }

  const formatCurrency = (minor: number): string => {
    return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const Card = ({
    title,
    value,
    subtitle,
    icon,
    highlight = false,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    highlight?: boolean;
  }) => (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '0.5rem',
        padding: '1.25rem',
        border: `1px solid ${highlight ? theme.primaryBorder : theme.border}`,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: theme.textMuted,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: theme.text }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: theme.textSubtle, marginTop: '0.25rem' }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: theme.text,
          }}
        >
          Platform User Core
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <Card title="Total Accounts" value={metrics.users.totalCount} icon="👥" />
          <Card title="Active Today" value={metrics.users.activeTodayCount} icon="⚡" />
          <Card title="Suspended / Banned" value={metrics.users.suspendedCount} icon="🚫" />
          <Card title="New in 24h" value={metrics.users.newLast24hCount} icon="🌱" />
        </div>
      </div>

      <div>
        <h2
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: theme.text,
          }}
        >
          Trust & Safety Operations
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <Card
            title="Open Cases"
            value={metrics.safety.openCasesCount}
            icon="🛡️"
            highlight={metrics.safety.openCasesCount > 0}
          />
          <Card
            title="Critical Cases"
            value={metrics.safety.criticalCasesCount}
            icon="🚨"
            highlight={metrics.safety.criticalCasesCount > 0}
          />
          <Card title="Pending Reports" value={metrics.safety.pendingReportsCount} icon="⚠️" />
          <Card title="Reports (24h)" value={metrics.safety.totalReports24h} icon="⏱️" />
        </div>
      </div>

      <div>
        <h2
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: theme.text,
          }}
        >
          Revenue & Subscriptions
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <Card
            title="Active Subscriptions"
            value={metrics.billing.activeSubscriptionsCount}
            icon="💎"
          />
          <Card
            title="Gross Revenue"
            value={formatCurrency(metrics.billing.revenueCentsTotal)}
            icon="💳"
          />
        </div>
      </div>

      <div>
        <h2
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: theme.text,
          }}
        >
          Social Graph & System Pipelines
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <Card title="Communities" value={metrics.social.totalCommunitiesCount} icon="🏛️" />
          <Card title="Events" value={metrics.social.totalEventsCount} icon="🎟️" />
          <Card title="Social Posts" value={metrics.social.totalPostsCount} icon="✍️" />
          <Card title="Pending Outbox" value={metrics.system.pendingOutboxCount} icon="📤" />
          <Card
            title="Failed Deliveries"
            value={metrics.system.failedNotificationJobsCount}
            icon="📬"
          />
        </div>
      </div>
    </div>
  );
}
