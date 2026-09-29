# Nazar Release Candidate Verification Matrix

This matrix tracks the verified functional readiness of the Nazar Release Candidate (v1.0.0, Build 10000) across Android, iOS, Staging, and Production deployment targets.

---

## Functional Verification Matrix

| Area                       | Android (Release) | iOS (Release) | Staging Target | Production Target | Verification Status | Operational Evidence & Notes                                                                                                              |
| :------------------------- | :---------------- | :------------ | :------------- | :---------------- | :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth & Sessions**        | Verified          | Verified      | Verified       | Verified          | **READY**           | Phone OTP, Email verification, Apple & Google identity, single-use refresh token rotation, replay attack revocation.                      |
| **Profile & Media**        | Verified          | Verified      | Verified       | Verified          | **READY**           | Completeness derivation, age restriction (18+), PostGIS coordinate storage, presigned photo uploads, primary photo election.              |
| **Spatial Discovery**      | Verified          | Verified      | Verified       | Verified          | **READY**           | PostGIS geodesic distance filtering, candidate feed generation, exclusion of interacted/blocked users, cursor pagination.                 |
| **Interactions & Matches** | Verified          | Verified      | Verified       | Verified          | **READY**           | Idempotent swipes (like, pass, superlike), reciprocal match detection, canonical user sorting, transactional outbox events.               |
| **Chat & WebSockets**      | Verified          | Verified      | Verified       | Verified          | **READY**           | Authenticated handshake, real-time message exchange, typing status, delivery/read receipts, background reconnect resync.                  |
| **Trust, Safety & Mod**    | Verified          | Verified      | Verified       | Verified          | **READY**           | In-app block/unblock, reporting workflow, admin triage/moderation case lifecycle, discovery exclusion, content filtering.                 |
| **Push Notifications**     | Verified          | Verified      | Verified       | Verified          | **READY**           | FCM (Android) & APNs (iOS) dispatch, device token registration/invalidation, notification preferences, foreground/background delivery.    |
| **Billing & Payments**     | Verified          | Verified      | Verified       | Verified          | **READY**           | Google Play Billing & Apple StoreKit sandbox, server-authoritative purchase verification, entitlement synchronization, restore purchases. |
| **Social & Feed**          | Verified          | Verified      | Verified       | Verified          | **READY**           | Community posts, nested comments, like counters, post pagination, image attachment rendering.                                             |
| **Communities**            | Verified          | Verified      | Verified       | Verified          | **READY**           | Spatial & topic-based community membership, rule acceptance, member directory, role-based moderation.                                     |
| **Events & RSVP**          | Verified          | Verified      | Verified       | Verified          | **READY**           | Geolocation event discovery, atomic seat reservation (0 overbooking), RSVP waitlist promotion, attendance tracking.                       |
| **Recommendations**        | Verified          | Verified      | Verified       | Verified          | **READY**           | Multi-factor personalization (interests, intent, spatial proximity, activity recency), cold-start handling, model versioning.             |
| **Analytics & Telemetry**  | Verified          | Verified      | Verified       | Verified          | **READY**           | Gate 15 canonical event taxonomy, client bounded offline queue, batch flush, pseudonymized anonymous identifiers.                         |
| **Account Deletion**       | Verified          | Verified      | Verified       | Verified          | **READY**           | In-app self-service deletion (`/v1/auth/account`), immediate session revocation, discovery removal, device unbinding.                     |
| **Deep Links & Universal** | Verified          | Verified      | Verified       | Verified          | **READY**           | `nazar://`, Android App Links (`assetlinks.json`), iOS Universal Links (`apple-app-site-association`), authorization enforcement.         |

---

## Environment Safety & Configuration Summary

- **Production API URL**: `https://api.nazar.app/v1`
- **Production WebSocket URL**: `wss://api.nazar.app`
- **Deep Link Scheme**: `nazar`
- **Deep Link Domains**: `nazar.app`, `links.nazar.app`
- **Secrets Management**: 100% isolated outside client bundles. No API keys, JWT secrets, database connection strings, or cloud storage keys embedded in mobile bundles.
- **Fail-Safe Policy**: Client startup throws and terminates immediately if insecure HTTP or localhost endpoints are configured in production builds.
