# Nazar Analytics Data Retention & Lifecycle Policy

## 1. Storage Tiers & Retention Windows

To prevent PostgreSQL from experiencing unbounded table growth while preserving critical operational and financial auditability, Nazar enforces three distinct data retention tiers:

| Data Category              | Table                            |   Retention Window   | Purge Frequency | Action on Expiry                        |
| :------------------------- | :------------------------------- | :------------------: | :-------------: | :-------------------------------------- |
| **Hot Raw Events**         | `analytics_events`               |       90 Days        |      Daily      | Pruned by `workers/analytics`           |
| **Quarantined Events**     | `analytics_event_quarantine`     |       14 Days        |      Daily      | Permanently purged                      |
| **Precomputed Aggregates** | `analytics_daily_metrics`        | 3 Years (Indefinite) |       N/A       | Retained for historical BI & accounting |
| **Experiment Exposures**   | `analytics_experiment_exposures` |       180 Days       |     Weekly      | Pruned after conclusion of tests        |

---

## 2. Automated Cleanup Mechanism

Scheduled cleanup is handled directly by `workers/analytics` during off-peak execution cycles:

```typescript
// workers/analytics/src/index.ts
const retentionThreshold = new Date(Date.now() - 90 * 86_400_000);
await db.delete(analyticsEvents).where(lt(analyticsEvents.occurredAt, retentionThreshold));

const quarantineThreshold = new Date(Date.now() - 14 * 86_400_000);
await db
  .delete(analyticsEventQuarantine)
  .where(lt(analyticsEventQuarantine.createdAt, quarantineThreshold));
```

---

## 3. Warehouse Archival Strategy

Before raw rows are deleted from `analytics_events` on Day 90:

1. An automated export script or batch pipeline extracts rows matching:
   $$\text{occurred\_at} \in [T - 90\text{ days}, T - 89\text{ days}]$$
2. Data is written to compressed columnar Parquet files in cold object storage (Google Cloud Storage / AWS S3).
3. BigQuery or ClickHouse external tables query the cold Parquet lake directly for long-term historical research, ensuring zero storage bloat on the operational PostgreSQL cluster.
