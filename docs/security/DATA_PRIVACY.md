# Nazar Data Privacy & Compliance Specification

## 1. Sensitive Data Inventory & Mapping

| Field / Attribute                |    Classification    | Storage Location              |      Retention Boundary      | Minimization & Masking Control                                                         |
| :------------------------------- | :------------------: | :---------------------------- | :--------------------------: | :------------------------------------------------------------------------------------- |
| **Precise GPS Location**         |      SENSITIVE       | PostGIS geography column      | Ephemeral / Active discovery | Never exposed via API; rounded to distance km / geohash. Prohibited in analytics.      |
| **Phone Number**                 |    RESTRICTED PII    | `user_identities`             |      Account lifecycle       | E.164 normalized; never shared with other users. Masked in admin searches.             |
| **Email Address**                |    RESTRICTED PII    | `user_identities`             |      Account lifecycle       | Lowercase normalized; never shared with matches.                                       |
| **Date of Birth / Age**          |    RESTRICTED PII    | `profiles.date_of_birth`      |      Account lifecycle       | Only calculated age integer exposed to discovery candidates.                           |
| **Chat Messages**                |      SENSITIVE       | `messages`                    |       180 Days active        | Raw text never entered into analytics or logs. Only metadata (`lengthBucket`) tracked. |
| **Dating Swipes (Likes/Passes)** | SENSITIVE BEHAVIORAL | `interactions`                |   Indefinite (anonymized)    | Private to the actor; never exposed publicly.                                          |
| **Moderation Evidence**          | SENSITIVE BEHAVIORAL | `reports`, `moderation_cases` |         1 Year audit         | Strictly restricted to staff with `moderation.read` permission.                        |
| **Credit Card PAN / CVV**        |      FORBIDDEN       | **Never Stored**              |             N/A              | Tokenized by Apple App Store / Google Play Billing. Server stores token ID only.       |

---

## 2. Data Minimization Principles

1. **Discovery Privacy**:
   - Matches and discovery cards only receive public display profile attributes (`displayName`, `age`, `bio`, `prompts`, `interests`, `photos`).
   - Private attributes (exact location, phone number, email, real birthdate) are omitted.
2. **Log Redaction**:
   - Structured JSON logs redact passwords, auth codes, credit card PANs, and JWTs via `AppLoggerService`.
3. **Analytics Minimization**:
   - Raw chat messages, audio blobs, and exact coordinates are strictly prohibited from entering `analytics_events`.
   - Analytics events are retained for 90 days, then pruned by `workers/analytics`.

---

## 3. GDPR & CCPA Compliance Workflows

### Right to Access (Data Export)

- Users can request a complete export of their profile, photos, interactions, and matches via authenticated account settings.

### Right to be Forgotten (Account Deletion)

- When a user deletes their account (`DELETE /v1/profiles/me`):
  1. Profile is soft-deleted (`deleted_at = NOW()`).
  2. All active sessions in `sessions` are immediately revoked.
  3. Registered push tokens in `devices` are invalidated.
  4. User's discovery presence is removed from spatial PostGIS search index.
  5. Precomputed aggregates in `analytics_daily_metrics` remain anonymous and decoupled from personal identity.
