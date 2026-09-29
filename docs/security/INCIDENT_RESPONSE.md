# Nazar Security Incident Response Plan

## 1. Incident Classification

| Severity Level    | Definition                                                                 | Examples                                                                      |    Response Target    |
| :---------------- | :------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------: |
| **P1 - CRITICAL** | Active compromise of production data, credentials, or core infrastructure. | Refresh token replay storm, database breach, unauthorized Super Admin access. | Immediate (< 15 mins) |
| **P2 - HIGH**     | Potential vulnerability exploited or localized data exposure.              | BOLA/IDOR vulnerability in private endpoint, high quarantine rejection spike. |       < 2 hours       |
| **P3 - MEDIUM**   | Security control degradation without direct data breach.                   | Elevated rate-limiting violations, misconfigured CORS header in staging.      |       < 8 hours       |
| **P4 - LOW**      | Minor deviation from security standards.                                   | Outdated non-critical dependency, documentation discrepancy.                  |      Next sprint      |

---

## 2. Detection Signals & Telemetry

- **Security Alerts**: Monitored via `security_events` table for `CRITICAL` severity events (e.g. `SESSION_REPLAY_DETECTED`, `BRUTE_FORCE_DETECTED`).
- **Throttler Spikes**: Sustained `429 Too Many Requests` spikes across specific IPs or device IDs.
- **Analytics Quarantine**: Sudden spike in `analytics_event_quarantine` volume (> 5% of total events) indicating injection attempts.
- **Unauthorized Admin Actions**: Repeated `403 Forbidden` responses on `/v1/admin/*` routes.

---

## 3. Incident Containment Procedures

### Scenario A: Compromised Consumer Account

1. Execute `POST /v1/admin/users/:userId/revoke-sessions` to terminate all active sessions immediately.
2. If account takeover is suspected, execute `POST /v1/admin/users/:userId/suspend` to block further access.
3. Review `audit_logs` and `security_events` for unauthorized actions performed during the compromise window.

### Scenario B: Compromised Staff / Admin Account

1. Deactivate the staff account in `admin_users` (`is_active = false`).
2. Revoke all active sessions for the admin in `admin_sessions`.
3. Inspect `admin_audit_logs` where `actor_admin_id = :id` to audit all mutations performed.
4. Revert unauthorized mutations (unsuspending users, revoking unapproved entitlements).

### Scenario C: Refresh Token Replay Storm

1. The platform automatically revokes any session where a rotated refresh token is presented (`AuthService.refreshSession`).
2. If widespread credential theft is suspected from a malicious mobile release or MITM attack, execute global session revocation for affected app versions.
