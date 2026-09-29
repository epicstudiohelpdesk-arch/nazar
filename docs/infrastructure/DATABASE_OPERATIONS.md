# Production Database Operations Guide

This document defines the database operations, tuning standards, query optimization protocols, and maintenance procedures for the **PostgreSQL 16 + PostGIS** database powering the Nazar platform.

---

## 1. Database Architecture & Provisioning

The Nazar persistence layer relies on AWS RDS PostgreSQL 16 with the PostGIS extension installed.

### 1.1 Cluster Topology

- **Primary Database**: Handles all transactional writes, outbox processing, and low-latency point reads. Multi-AZ synchronous replication ensures zero data loss upon hardware degradation.
- **Read Replicas**: Provisioned asynchronously for read-heavy workloads (discovery scoring sweeps, recommendation feature extractions, analytical aggregations).
- **Storage Configuration**: GP3 storage with 3,000 baseline IOPS, 125 MB/s throughput, and storage autoscaling enabled up to 1TB.

---

## 2. Connection Pool Sizing & Resource Tuning

### 2.1 Connection Limits

PostgreSQL connection creation incurs process-level memory overhead. Nazar enforces strict connection budget allocation:

- **RDS Instance Max Connections**: Set to `100` for launch tier (`db.t4g.xlarge`).
- **Application Pool Configuration**:
  - Max Pool Size per API task: `20` connections.
  - With 2 API tasks = 40 connections.
  - Worker tasks: `10` connections.
  - Migration / Operational reserve: `15` connections.
  - Total allocated = 65 connections (< 70% of max limit, preventing connection exhaustion).

### 2.2 Defensive Timeout Configurations

Configured in RDS Custom Parameter Group `nazar-pg16-params`:

```ini
# Prevent runaway queries from consuming database resources
statement_timeout = 3000ms

# Prevent transactions from holding locks and blocking concurrent transactions
lock_timeout = 2000ms

# Terminate orphaned transactions left idle in open state
idle_in_transaction_session_timeout = 5000ms

# Logging slow queries for proactive profiling
log_min_duration_statement = 200ms
```

---

## 3. PostGIS Spatial Query Optimization

Nazar's core discovery feed queries rely on spatial proximity matching.

### 3.1 Geospatial Indexing & SRID Standard

- All user location coordinates are stored using WGS 84 (`SRID 4326`) as `geography(Point, 4326)`.
- **Spatial Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_profiles_location_gist
  ON profiles USING GIST (location);
  ```

### 3.2 Optimized Proximity Filter Pattern

Spatial distance filtering employs PostGIS `ST_DWithin` which leverages the GIST index bounding box check:

```sql
SELECT p.user_id, p.display_name, ST_Distance(p.location, $1) AS distance_meters
FROM profiles p
WHERE ST_DWithin(p.location, $1, $2) -- $1 = user point, $2 = max distance in meters
  AND p.status = 'active'
ORDER BY p.location <-> $1
LIMIT 20;
```

Empirical testing in Gate 17 showed this query pattern completes in **< 12ms** across 100,000 spatial records.

---

## 4. Maintenance & Index Hygiene

### 4.1 Autovacuum Tuning

High-churn tables (such as `outbox_events` and `active_sessions`) generate substantial dead tuples. Custom autovacuum settings are applied:

```sql
ALTER TABLE outbox_events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit = 1000,
  autovacuum_vacuum_cost_delay = 2
);
```

### 4.2 Non-Blocking Index Operations

- Never run `CREATE INDEX` or `REINDEX` directly on production tables.
- Always use `CREATE INDEX CONCURRENTLY` and `REINDEX TABLE CONCURRENTLY`:
  ```sql
  REINDEX TABLE CONCURRENTLY user_interactions;
  ```

---

## 5. Query Profiling & Observability

1. **`pg_stat_statements`**:
   - Monitored continuously to identify top SQL statements by cumulative execution time, call frequency, and buffer reads.
   ```sql
   SELECT query, calls, total_exec_time, mean_exec_time, rows
   FROM pg_stat_statements
   ORDER BY total_exec_time DESC
   LIMIT 10;
   ```
2. **RDS Performance Insights**:
   - Enabled with 7-day retention to visualize Average Active Sessions (AAS) against max vCPU capacity.
   - Any sustained AAS exceeding 2x vCPU triggers an automatic investigation.

---

## 6. Multi-AZ Automated Failover Protocol

When AWS detects hardware or network impairment on the primary RDS instance:

1. RDS automatically modifies the DNS CNAME record for the database endpoint to point to the standby replica.
2. Failover completes within **60 to 120 seconds**.
3. Application connection pools detect severed TCP sockets, automatically purge stale connections, and reconnect to the new primary using exponential backoff retry.
4. The former primary is recreated as the new standby replica in the background.
