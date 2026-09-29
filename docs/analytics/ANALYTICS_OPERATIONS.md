# Nazar Analytics Operations Runbook

## 1. Monitoring & Health Diagnostics

Operators can inspect the health of the analytics ingestion pipeline, aggregation freshness, and quarantine volume via the Admin API:

```http
GET /v1/admin/analytics/health
Authorization: Bearer <AdminToken>
```

**Response Format**:

```json
{
  "success": true,
  "data": {
    "status": "HEALTHY",
    "totalEventsIngested": 1845920,
    "eventsPast24Hours": 94102,
    "quarantinedPast24Hours": 14,
    "lastAggregationAt": "2026-09-29T02:00:00.000Z",
    "workerLagSeconds": 12
  }
}
```

### Alert Thresholds

- **Critical**: `quarantinedPast24Hours` $> 5\%$ of total ingested events (indicates client contract mismatch or malicious injection attempt).
- **Warning**: `workerLagSeconds` $> 3600$ (indicates aggregation runner backlog or database lock contention).

---

## 2. Inspecting Quarantined Payloads

When invalid or unauthorized events are rejected, they are preserved in `analytics_event_quarantine` for forensic evaluation:

```http
GET /v1/admin/analytics/quarantine?limit=25
Authorization: Bearer <AdminToken>
```

Each quarantined entry records:

- `raw_payload`: Complete JSON received from the client.
- `quarantine_reason`: Error description.
- `error_code`: E.g., `UNAUTHORIZED_PRODUCER`, `PROHIBITED_PAYLOAD_CONTENT`, `INVALID_TAXONOMY_NAME`.
- `received_at`: Exact timestamp of receipt.

---

## 3. Reprocessing & Manual Aggregation Trigger

If aggregation fails to run automatically or historical metrics need recalculation:

```http
POST /v1/admin/analytics/aggregate
Authorization: Bearer <AdminToken>
Content-Type: application/json

{
  "targetDate": "2026-09-28"
}
```

This triggers `AnalyticsAggregationService.computeDailyMetrics(targetDate)`, updating `analytics_daily_metrics` idempotently.
