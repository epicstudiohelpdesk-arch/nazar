# Nazar Privacy Classification & Data Protection

## 1. Classification Tiers

Nazar categorizes all analytics events and contextual attributes into four strict privacy tiers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIVACY CLASSIFICATION TIERS                    │
├──────────────────────┬─────────────────────────────────────────────────┤
│ Tier                 │ Definition & Handling                           │
├──────────────────────┼─────────────────────────────────────────────────┤
│ PUBLIC               │ Non-identifiable platform interactions          │
│                      │ (e.g. social post views, public event views).   │
├──────────────────────┼─────────────────────────────────────────────────┤
│ PSEUDONYMOUS         │ Activity tied to actorUserId or anonymousId.    │
│                      │ Contains no raw PII or intimate content.        │
│                      │ Default tier for standard telemetry.            │
├──────────────────────┼─────────────────────────────────────────────────┤
│ RESTRICTED_PII       │ Profile updates, financial purchases, email/sms │
│                      │ channels. Strictly access-controlled.           │
├──────────────────────┼─────────────────────────────────────────────────┤
│ SENSITIVE_BEHAVIORAL │ Dating preference swipes, match state, blocks,  │
│                      │ safety reports. Never exposed outside staff RBAC│
└──────────────────────┴─────────────────────────────────────────────────┘
```

---

## 2. Prohibited Content & Automated Scrubbing

`EventGovernanceService` automatically inspects all event `properties` and `context` against a strict blacklist before storage:

### 1. Credentials & Authentication Tokens

- Any field named `password`, `hash`, `secret`, `refreshToken`, `accessToken`, `jwt`, `bearer`, `otp`, `authCode` is strictly forbidden.
- Regular expressions reject raw JWT patterns (`ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`) and Bearer tokens.

### 2. Financial Identifiers

- Credit card PANs (Luhn-compliant 13-19 digit sequences) and CVV/CVC codes are rejected.
- Only tokenized payment IDs (`paymentMethodId`, `subscriptionId`, currency, amount) may be recorded.

### 3. Raw Communications & Messages

- **Strict Rule**: Raw text of chat messages, audio blobs, or user-to-user drafts MUST NEVER enter the analytics pipeline.
- Only coarse metadata is recorded:
  - `message.sent`: `{ conversationId, lengthBucket: 'SHORT' | 'MEDIUM' | 'LONG', hasAttachment: boolean }`.

### 4. High-Precision Geo-Coordinates

- Exact GPS lat/long pairs are prohibited in client analytics.
- Only coarse geo-hashes (precision $\le 5$, approximately $\ge 5\text{ km}$ radius) or administrative region strings (`countryCode`, `city`) are allowed.

---

## 3. Right-to-be-Forgotten & GDPR / CCPA Deletion

When a user exercises their right to account deletion or data erasure:

1. **User De-identification**: `actor_user_id` foreign keys in `analytics_events` are nullified or re-assigned to a tombstone identifier (`00000000-0000-0000-0000-000000000000`).
2. **Aggregates Preserved**: Precomputed rows in `analytics_daily_metrics` contain no personal identifiers and remain intact for historical accounting, fraud detection, and platform growth metrics.
3. **Quarantine Purge**: Any quarantined records referencing the target user ID are scrubbed during daily worker maintenance.
