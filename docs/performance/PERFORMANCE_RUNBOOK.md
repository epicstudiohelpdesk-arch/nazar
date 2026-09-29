# PERFORMANCE & SCALABILITY OPERATIONAL RUNBOOK · NAZAR PLATFORM

## 1. Overview & Operational Responsibilities

This runbook defines operational protocols, monitoring signals, diagnostic commands, and emergency remediation procedures for performance, latency, and concurrency anomalies on the Nazar platform.

---

## 2. Core Telemetry Signals & Alert Thresholds

| Metric                   | Target Baseline |  Warning Threshold   |    Critical Incident Threshold    | Remediation Runbook             |
| :----------------------- | :-------------: | :------------------: | :-------------------------------: | :------------------------------ |
| **API Latency (p95)**    |    < 120 ms     | > 250 ms (for 2 min) |       > 500 ms (for 1 min)        | Section 3.2: Degraded Latency   |
| **DB Pool Utilization**  |      < 40%      |    > 75% capacity    | > 90% capacity (stalled acquires) | Section 3.1: Pool Exhaustion    |
| **Active Long Queries**  |     0 > 1s      | $\ge 2$ queries > 2s |   Any query > 3s (hit timeout)    | Section 3.1: Query Termination  |
| **Outbox Queue Lag**     |   < 2 seconds   |     > 30 seconds     |   > 120 seconds (> 5k pending)    | Section 3.3: Worker Backlog     |
| **Push Error Rate**      |     < 0.1%      |        > 2.0%        |     > 5.0% dispatch failures      | Section 3.4: Push Degradation   |
| **WebSocket Event Loop** |     < 10 ms     |       > 50 ms        |           > 150 ms lag            | Section 3.5: Gateway Congestion |
| **Redis Memory**         |    < 50% max    |   > 75% maxmemory    |          > 85% maxmemory          | Section 3.6: Redis Saturation   |

---

## 3. Incident Remediation Runbooks

### 3.1 Runbook: Database Connection Pool Exhaustion

#### Symptom

API logs report: `TimeoutError: ResourceRequest timed out` or `Connection pool exhausted`. Requests return `503 Service Unavailable`.

#### Step 1: Inspect Active PostgreSQL Connections & Lock Trees

Execute in PostgreSQL management console:

```sql
-- View all currently active queries and their execution duration
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Identify blocking and waiting processes
SELECT blocked_locks.pid     AS blocked_pid,
       blocking_locks.pid    AS blocking_pid,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM  pg_catalog.pg_locks         blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks         blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Step 2: Terminate Offending Blockers

```sql
-- Gracefully cancel query
SELECT pg_cancel_backend(<blocking_pid>);

-- If unresponsive after 5 seconds, terminate connection forcefully
SELECT pg_terminate_backend(<blocking_pid>);
```

---

### 3.2 Runbook: Discovery Feed Latency Cliff (> 300ms)

#### Symptom

`GET /v1/discovery` p95 latency spikes above 300ms. Mobile clients report sluggish swipe card loading.

#### Diagnosis

1. Verify PostGIS GIST spatial index status:
   ```sql
   SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE indexrelname = 'idx_profiles_location';
   ```
   If `idx_scan` is not increasing, the query planner is doing sequential scans due to stale table statistics.

#### Immediate Remediation

```sql
-- Refresh PostgreSQL query planner statistics
ANALYZE profiles;
ANALYZE profile_preferences;
ANALYZE interactions;

-- If spatial index is fragmented, reindex concurrently (zero lock contention)
REINDEX INDEX CONCURRENTLY idx_profiles_location;
```

---

### 3.3 Runbook: Outbox Queue Backlog & Delayed Notifications

#### Symptom

Users report delayed match alerts or push messages. Telemetry shows `outbox_events` pending count > 5,000.

#### Step 1: Inspect Queue Status

```sql
SELECT status, count(*), MIN(available_at) AS oldest_available, MAX(attempts) AS max_attempts
FROM outbox_events
GROUP BY status;
```

#### Step 2: Recover Stranded Jobs from Dead Workers

```sql
-- Reclaim jobs stuck in PROCESSING for more than 5 minutes
UPDATE outbox_events
SET status = 'PENDING', attempts = attempts + 1
WHERE status = 'PROCESSING' AND processed_at < NOW() - INTERVAL '5 minutes';

UPDATE notification_delivery_jobs
SET status = 'PENDING', worker_id = NULL
WHERE status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '5 minutes';
```

#### Step 3: Scale Worker Processes

If pending events continue rising despite recovery:

- Scale worker pods from 1 to 3 instances.
- Because queue claiming uses `FOR UPDATE SKIP LOCKED`, new worker pods instantly consume queue slices in parallel without configuration changes.

---

### 3.4 Runbook: Push Delivery Failure Spikes

#### Symptom

`notification_delivery_jobs` exhibits high error rates with error categories `TOKEN_INVALID` or `RATE_LIMITED`.

#### Remediation

1. **Invalid Token Scrubbing**: Verify that devices marked invalid are revoked so future notifications are not scheduled for dead tokens:
   ```sql
   UPDATE devices
   SET revoked_at = NOW()
   WHERE id IN (
     SELECT device_id FROM notification_delivery_jobs
     WHERE last_error LIKE '%Invalid device registration token%'
   );
   ```
2. **Provider Rate Limiting**: If APNS/FCM returns `429 Too Many Requests`, throttle the worker claim limit from 50 to 20 jobs per batch and enforce a 50ms delay between batch dispatches.

---

### 3.5 Runbook: WebSocket Gateway Event Loop Congestion

#### Symptom

Socket.io ping/pong timeouts increase, and clients experience frequent reconnections.

#### Remediation

1. Inspect active socket count per Node.js process:
   - If sockets per instance > 12,000, trigger auto-scaling to deploy additional API pods.
2. Verify typing timer cleanup:
   - Ensure `typingTimers` map size in `ChatGateway` does not exceed connected socket count (prevents memory leak).
3. Perform a zero-downtime rolling restart of WebSocket gateway nodes:
   - Rolling restarts gracefully disconnect clients, allowing mobile apps to reconnect with exponential jitter to sibling nodes.

---

## 4. Routine Preventative Maintenance

| Frequency             | Task                             | Command / Action                                                                |
| :-------------------- | :------------------------------- | :------------------------------------------------------------------------------ |
| **Daily (Automated)** | Autovacuum high-churn tables     | Monitored by PostgreSQL autovacuum daemon.                                      |
| **Weekly**            | Vacuum analyze outbox and jobs   | `VACUUM ANALYZE outbox_events; VACUUM ANALYZE notification_delivery_jobs;`      |
| **Monthly**           | Reindex high-traffic b-trees     | `REINDEX TABLE CONCURRENTLY messages; REINDEX TABLE CONCURRENTLY interactions;` |
| **Quarterly**         | Disaster & Load Resilience Audit | Run synthetic benchmark suite `pnpm db:perf:seed && pnpm test tests/perf/`.     |
