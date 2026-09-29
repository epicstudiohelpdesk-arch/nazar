# PRODUCTION LAUNCH SUPPORT RUNBOOK · GATE 20

**Product**: Nazar Platform  
**Target Audience**: Customer Support, Tier-1/Tier-2 Support Engineers, and On-Call Operations  
**Release**: `1.0.0` (Android: `10000`, iOS: `10000`, Commit: `e23eb3bef656c4e01f2dd76e59e75887373c4210`)  
**Security Classification**: CONFIDENTIAL — INTERNAL OPERATIONAL USE ONLY

---

## 1. ABSOLUTE SECURITY GUARDRAIL FOR SUPPORT STAFF

> [!CAUTION]
> **ZERO CREDENTIAL EXPOSURE POLICY**  
> Under NO CIRCUMSTANCES should customer support representatives or tier-1 engineers ask for, accept, view, log, or store:
>
> - Raw passwords or PINs
> - 6-digit SMS OTP verification codes
> - JWT Access Tokens or Refresh Tokens
> - Private Encryption Keys or Passkey credentials
> - Full Credit Card numbers or CVCs
>
> All account operations must be handled via authenticated Admin Console actions or verified self-service flows. Violations will be audited under `admin_audit_logs`.

---

## 2. Standard Triage Checklist

When a user ticket is received:

1. **Identify User Pseudonym**: Obtain User ID or registered phone number.
2. **Platform & Build Info**: Verify App Version (e.g. `1.0.0`), OS Version (e.g. `iOS 17.5`, `Android 14`), and Device Model.
3. **Admin Console Check**: Inspect user record in Admin Console (`/admin/users/:id`). Confirm user status: `ACTIVE`, `SUSPENDED`, `QUARANTINED`, or `DELETED`.
4. **Recent Security Events**: Check if the account was flagged by rate-limiting or anti-fraud rules.

---

## 3. Incident & Issue Resolution Workflows

### 3.1. Login Failure

_Symptoms_: User cannot authenticate via Phone OTP, Google/Apple OAuth, or Passkeys.  
_Troubleshooting Steps_:

1. Look up user by phone or email in Admin Console.
2. Check `users.status`. If `SUSPENDED` or `DELETED`, inform user according to policy.
3. If user is using Passkeys on an unsupported device or browser, instruct them to choose "Use SMS Code Instead".
4. Check if Apple Private Relay email has changed or if the user originally signed up with a different phone number.

### 3.2. OTP Delivery Failure or Rate Limiting

_Symptoms_: "Too many attempts" or user does not receive the 6-digit SMS code.  
_Troubleshooting Steps_:

1. Check `otp_challenges` table for recent requests from the phone number:
   - Max 3 requests per 10 minutes.
   - Max 5 failed verification attempts per code.
2. If rate-limited due to repeated wrong codes, inform the user to wait 15 minutes for the cool-down window to expire.
3. If SMS is not arriving across multiple users on a specific carrier, check SMS Gateway status dashboard (Twilio/AWS SNS) for carrier outages.

### 3.3. Account Deletion (Self-Service & GDPR/CCPA Requests)

_Procedure_:

1. **Self-Service**: Direct user to open Nazar -> Settings -> Account Settings -> "Delete Account". Confirming this action automatically purges their sessions, hides their profile, and schedules data deletion.
2. **Manual Request via Support**:
   - Verify ownership via registered phone confirmation.
   - In Admin Console, trigger "Schedule Permanent Account Deletion" (`DELETE /v1/admin/users/:id`).
   - Confirm completion to user within 30 days per GDPR Article 17.

### 3.4. Payment Issue & Failed Purchases

_Symptoms_: User was charged by Apple or Google Play but did not receive Nazar Gold/Platinum entitlements.  
_Troubleshooting Steps_:

1. Direct the user to tap "Restore Purchases" in Nazar -> Settings -> Billing.
2. If the entitlement is still not granted, ask for the Apple App Store / Google Play Store Order ID (e.g. `GPA.3312-...` or `M1234...`).
3. Cross-reference Order ID in `payment_transactions` table to check if webhook delivery failed.
4. If valid store receipt exists, Tier-2 support can manually reconcile entitlement in Admin Console.

### 3.5. Subscription Restoration

_Procedure_:

1. User reinstalling app or moving to a new phone needs to restore active subscription.
2. Ensure user is logged into the same Apple ID or Google Play Account used for the original purchase.
3. Navigate to `Settings -> Billing -> Restore Purchases`.
4. Client sends App Store receipt to `POST /v1/billing/purchases/restore`. Server validates receipt with Apple/Google and updates user's `entitlements` table.

### 3.6. Missing Push Notifications

_Symptoms_: User is not receiving alerts for new matches or incoming chat messages.  
_Troubleshooting Steps_:

1. Verify system notification permissions in device OS settings (Settings -> Nazar -> Notifications -> Allow Notifications).
2. Verify in-app preferences via `GET /v1/notifications/preferences`. Ensure `matches: true` and `messages: true`.
3. Check `devices` table in Admin Console to confirm a valid FCM or APNs device token is registered for the user's active session.
4. If device token is marked invalid (`INVALID_REGISTRATION`), instruct the user to log out and log back in to generate a fresh token.

### 3.7. Message Delivery Failure

_Symptoms_: Message shows "Failed to send" with exclamation icon.  
_Troubleshooting Steps_:

1. Verify device internet connection and WebSocket status (green dot in debug / active socket ping).
2. Check if the conversation was closed due to the other user blocking or deleting their account.
3. Check if the message content triggered the automated content filter (e.g., prohibited phishing links or hate speech).

### 3.8. Safety Report Submission

_Symptoms_: User wishes to report another user for harassment, inappropriate photos, or scamming.  
_Troubleshooting Steps_:

1. Instruct user to tap the "..." menu on the offending user's profile or chat, then tap "Report User".
2. Select appropriate category: `HARASSMENT`, `INAPPROPRIATE_CONTENT`, `SPAM`, `FAKE_PROFILE`, `UNDERAGE`.
3. Reports immediately enter the moderation queue (`moderation_cases`).
4. High-priority reports (e.g. underage or severe harassment) auto-escalate to Tier-2 Safety Lead within 1 hour.

### 3.9. Blocked Account Triage

_Symptoms_: User blocked someone by mistake or asks why a match disappeared.  
_Troubleshooting Steps_:

1. If a user blocks another user, both users are immediately hidden from each other's discovery, matches, and chats.
2. Unblocking: The blocking user can navigate to Settings -> Privacy -> Blocked Users, and tap "Unblock".
3. Note: Unblocking does NOT automatically restore previously dissolved matches or chat history (safety by design).

### 3.10. Suspicious Account / Impersonation

_Symptoms_: User reports that someone is using their photos or running an automated bot.  
_Troubleshooting Steps_:

1. Flag account in Admin Console for photo verification.
2. Place account in `QUARANTINED` status pending identity verification.
3. User must complete in-app selfie liveness verification before account can be un-quarantined.

### 3.11. Media Upload Failure

_Symptoms_: Profile photo upload fails or gets stuck in "Processing".  
_Troubleshooting Steps_:

1. Confirm photo format is supported: JPEG, PNG, or WebP. Maximum file size: 15 MB.
2. Confirm user has granted Camera / Photo Library permission in device settings.
3. Check `profile_media` table. If status is `REJECTED`, the automated image moderation worker flagged the photo for policy violation (nudity or violence).

### 3.12. App Crash

_Symptoms_: App closes unexpectedly upon launch or specific screen navigation.  
_Troubleshooting Steps_:

1. Request: Device model, exact OS version, and steps to reproduce.
2. Search Sentry dashboard using release tag `nazar-mobile@1.0.0+10000`.
3. Filter by `user_id` or timestamp to locate stack trace.
4. If crash is reproducible, escalate to Mobile On-Call Engineer with ticket severity SEV-2 or SEV-3.

### 3.13. Store Installation & Update Issue

_Symptoms_: User cannot download app from Google Play or App Store.  
_Troubleshooting Steps_:

1. Confirm minimum OS requirements: iOS 15.1+ (iPhone) or Android 7.0+ (API level 24+).
2. Confirm country/region availability: Nazar is currently launched in authorized launch regions.
3. Instruct user to clear Google Play Store / App Store cache and verify adequate device storage space.

---

## 4. Escalation Path & On-Call Roster

| Escalation Level             | Responsible Team                | Contact / Channel          |        SLA         |
| :--------------------------- | :------------------------------ | :------------------------- | :----------------: |
| **Tier 1 Support**           | Customer Care Team              | `#support-ops`             |      4 hours       |
| **Tier 2 Technical Support** | Platform Support Engineers      | `#eng-support`             |       1 hour       |
| **Safety & Trust**           | Trust & Safety Officer          | `#safety-escalations`      |     30 minutes     |
| **Engineering On-Call**      | Infrastructure / Mobile On-Call | PagerDuty: `nazar-primary` | 15 minutes (SEV-1) |
