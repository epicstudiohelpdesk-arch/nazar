# Admin & Operations Runbook (Gate 14)

## 1. Overview

This runbook outlines operational procedures, incident response playbooks, and routine maintenance tasks for operators managing the Nazar platform via the Admin Console.

---

## 2. Initial Setup & Staff Provisioning

### Default Bootstrap Credentials

During initial database migration and application startup, `AdminModule.onModuleInit()` ensures that canonical roles and the default super-administrator account exist:

- **Email**: `admin@nazar.internal`
- **Initial Password**: Configured via `ADMIN_BOOTSTRAP_PASSWORD` env var (or default `SuperAdmin123!` in local development).
- **Assigned Role**: `super_admin`

> **CRITICAL**: In staging and production environments, the initial password must be changed immediately upon first login.

### Provisioning a New Staff Member

1. Log in to the Admin Console using a `super_admin` account.
2. Navigate to **Staff Management** (`/admin/staff`).
3. Click **Add Staff Member** and enter:
   - Full Name
   - Corporate Email (`@nazar.internal`)
   - Initial Temporary Password
   - Assigned Role (e.g. `moderator`, `trust_and_safety`, `support_agent`)
4. Confirm user creation. An audit log entry (`ADMIN_STAFF_CREATED`) is automatically created.

---

## 3. Incident Response Playbooks

### Playbook 1: Suspected Account Compromise (Account Takeover)

**Trigger**: User reports unauthorized profile edits, unrecognized matches, or stolen device.
**Procedure**:

1. Navigate to **Users** and search for the user by email, phone, or UUID.
2. Verify user identity against recorded account details.
3. Click **Revoke All Sessions**.
   - Input mandatory reason: `"User reported stolen device / suspected account takeover"`.
   - All active tokens are immediately invalidated across all devices.
4. Optionally, click **Suspend Account** (select `Temporary`, 24 hours) if immediate re-entry must be blocked until identity proof is verified.
5. Direct the user to complete password/identity recovery via secure SMS/email challenge.

---

### Playbook 2: Critical Safety & CSAM / Severe Violence Triage

**Trigger**: Moderation queue flags severe violation, violent threat, or illegal content.
**Procedure**:

1. Open **Moderation Queue** (`/admin/moderation`). Filter by `Severity: Critical`.
2. Inspect flagged case and associated media evidence.
3. Click **Take Action** -> **Ban User & Remove Content**.
   - Input mandatory reason: `"Confirmed critical safety policy violation (Case #[ID])"`.
4. The system executes:
   - Immediate permanent account suspension.
   - Immediate takedown and de-indexing of flagged media, posts, and comments.
   - Revocation of all active sessions.
5. Notify the **Trust & Safety Lead** and **Compliance Officer** for mandatory regulatory preservation and legal reporting.

---

### Playbook 3: Rogue Community or Compromised Event

**Trigger**: A community or event is created containing hate speech, illegal gatherings, or spam raids.
**Procedure**:

1. Navigate to **Diagnostics & Operations** -> **Communities & Events**.
2. Locate the entity by ID or name.
3. For Communities:
   - Click **Suspend Community**. Input reason: `"Community suspended pending investigation into coordinated hate speech"`.
   - The community is immediately delisted from discovery and all new posts are blocked.
4. For Events:
   - Click **Cancel Event**. Input reason: `"Event violates platform gathering policies"`.
   - All pending RSVPs are cleared and registered attendees receive an automated cancellation notice.

---

### Playbook 4: Outbox Worker Backpressure & Dead-Letter Job Recovery

**Trigger**: Notifications delayed, or queue lag alert triggers in monitoring dashboard.
**Procedure**:

1. Navigate to **Diagnostics** (`/admin/diagnostics`).
2. Inspect the **Outbox Processing Metrics**:
   - Check `Pending Jobs`, `Failed Jobs`, and `Processing Lag`.
3. If specific jobs have exceeded max attempts (`attempts >= 5`):
   - Review the `lastErrorMessage` in the job detail drawer.
   - If downstream issue (e.g. temporary FCM provider outage) is resolved, click **Retry Job**.
   - Input mandatory reason: `"Provider recovered, manual retry of dead-letter job"`.
4. Monitor retry execution until pending count drops back to normal operational thresholds.

---

## 4. Routine Maintenance

### Auditing Administrative Activity

Every week, a Compliance Officer or Super Admin should review `/admin/audit`:

1. Filter by actions: `USER_SUSPEND`, `USER_RESTORE`, `MODERATION_DECIDE`.
2. Verify that all actions have concrete, detailed reasons recorded.
3. Flag any anomalous bulk lookups or unapproved session revocations for internal review.

### Session Pruning

Expired rows in `admin_sessions` can be pruned periodically using a scheduled database cron:

```sql
DELETE FROM admin_sessions WHERE expires_at < NOW() - INTERVAL '30 days';
```

_(Audit logs in `admin_audit_logs` must NEVER be pruned or deleted)._
