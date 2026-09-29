# Discovery Engine, Candidate Retrieval & Deterministic Ranking

## Overview

The Discovery Engine powers the social candidate retrieval pipeline for Nazar. It transforms authenticated users, completed dating profiles, dating preferences, and geographic coordinates into a secure, deterministic, paginated stream of eligible candidate profiles.

The engine is built on server-authoritative principles, PostGIS spatial queries, explainable multi-factor deterministic scoring, cryptographic HMAC-SHA256 cursor pagination, and zero-leakage privacy controls.

---

## 1. Architectural Principles

1. **Server Authoritative**: All eligibility, reciprocal matching, distance filtering, and profile ranking decisions are computed exclusively by the backend. The mobile client is completely untrusted.
2. **Deterministic & Explainable**: Profiles are ordered using transparent, reproducible weighted multi-factor scoring with deterministic tie-breaking (`profileId ASC`), guaranteeing consistent pagination without drifting or candidate reshuffling.
3. **Privacy by Design**:
   - Zero disclosure of exact candidate geographic coordinates (`latitude`, `longitude`).
   - Zero disclosure of candidate date of birth (`dateOfBirth`); only derived `age` is returned.
   - Zero disclosure of candidate internal ranking score, weights, or private preference settings.
   - Distance is presented exclusively in coarse humanized distance buckets (`< 1 km`, `1-5 km`, `5-10 km`, `10-25 km`, `25-50 km`, `50+ km`).
4. **Resilient Pagination**: Opaque, HMAC-SHA256 cryptographically signed cursors encode the candidate score, candidate ID, and timestamp salt, preventing client-side forgery, skips, or duplicate profiles.
5. **Database-Efficient**: PostGIS spatial indexing (`GIST(location)`), composite btree indexes on `(visibility, gender)` and `(dateOfBirth)`, and batch hydration minimize N+1 queries.

---

## 2. Discovery Pipeline Architecture

```text
HTTP GET /v1/discovery?cursor=...&limit=...
               │
               ▼
   [DiscoveryController]
               │
               ▼
   [DiscoveryService]
   ├── 1. Validate Viewer Profile & Preferences
   │      - Require ACTIVE visibility
   │      - Require location coordinates (geography point)
   │      - Require completed preferences
   ├── 2. Retrieve Candidate Exclusions
   │      - ICandidateExclusionService (self-exclusion + future blocks/passes/likes)
   ├── 3. Execute PostGIS Candidate Retrieval
   │      - PostGIS ST_DWithin reciprocal distance check
   │      - Reciprocal age filter (viewer & candidate)
   │      - Reciprocal gender filter (viewer & candidate)
   │      - Mandatory ACTIVE visibility & 100% completeness
   │      - Exclude blocked/passed IDs
   ├── 4. Deterministic Multi-Factor Ranking
   │      - Preference compatibility (W1 = 0.35)
   │      - Profile completeness (W2 = 0.25)
   │      - Profile freshness (W3 = 0.20)
   │      - Distance proximity (W4 = 0.20)
   │      - Deterministic diversity micro-hash (< 0.001)
   │      - Tie-breaker: profileId ASC
   ├── 5. Apply Seek-Method Pagination (Cursor)
   │      - Filter candidates where (score, id) < (cursorScore, cursorId)
   │      - Slice limit + 1 to detect hasMore
   ├── 6. Hydrate Public Profile Components (Batched)
   │      - Curated interests
   │      - Prompts & responses
   │      - READY media with CDN URLs (primary first)
   └── 7. Privacy Sanitization & Distance Bucketing
          - Coarse distance bucket assigned
          - Strip internal scores, coordinates, DOB
          - Generate HMAC-SHA256 signed nextCursor
```

---

## 3. Candidate Eligibility Rules

A candidate profile $C$ is eligible for viewer $V$ if and only if **all** of the following conditions are satisfied:

| Rule                      | Condition                                                    | Enforcement Layer                                            |
| :------------------------ | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **Self Exclusion**        | $C.userId \neq V.userId$                                     | Candidate Repository SQL + Exclusion Service                 |
| **Visibility**            | $C.visibility = 'ACTIVE'$                                    | PostGIS SQL Query (`idx_profiles_visibility_gender`)         |
| **Completeness**          | $C.missingRequired = []$                                     | PostGIS SQL Query (`jsonb_array_length(...) = 0`)            |
| **Viewer Distance**       | $ST\_Distance(V.loc, C.loc) \le V.maxDistanceKm \times 1000$ | PostGIS `ST_DWithin` on geography (meters)                   |
| **Candidate Distance**    | $ST\_Distance(V.loc, C.loc) \le C.maxDistanceKm \times 1000$ | PostGIS `ST_DWithin` on geography (meters)                   |
| **Viewer Age Bound**      | $C.age \ge V.minAge \land C.age \le V.maxAge$                | PostGIS SQL Query on `p.date_of_birth`                       |
| **Candidate Age Bound**   | $V.age \ge C.minAge \land V.age \le C.maxAge$                | PostGIS SQL Query on candidate preferences                   |
| **Viewer Gender Pref**    | $C.gender \in V.genderPreferences$                           | PostGIS SQL Query (`p.gender = ANY(...)`)                    |
| **Candidate Gender Pref** | $V.gender \in C.genderPreferences$                           | PostGIS SQL Query (`pp.gender_preferences @> [V.gender]`)    |
| **Relationship Intent**   | Compatible intents or unrestricted                           | Scoring engine compatibility factor                          |
| **Media Requirement**     | At least one media item with status `READY`                  | PostGIS SQL Query (`EXISTS(SELECT 1 FROM profile_media...)`) |

---

## 4. Deterministic Candidate Ranker

Candidate ordering is governed by a deterministic, explainable multi-factor scoring formula:

$$Score = W_1 \cdot S_{\text{intent}} + W_2 \cdot S_{\text{completeness}} + W_3 \cdot S_{\text{freshness}} + W_4 \cdot S_{\text{distance}} + \delta_{\text{diversity}}$$

### Factor Definitions & Weights

1. **Relationship Intent Compatibility ($W_1 = 0.35$)**:
   - Exact intent match: $1.0$
   - Either party `NOT_SURE`: $0.7$
   - Casual vs Short Term: $0.5$
   - Incompatible (e.g., Casual vs Long Term): $0.2$
2. **Profile Completeness ($W_2 = 0.25$)**:
   - $\frac{\text{percentage}}{100.0}$, normalized between $0.0$ and $1.0$.
3. **Freshness ($W_3 = 0.20$)**:
   - Exponential decay: $\exp\left(-\frac{\text{hoursSinceUpdate}}{168.0}\right)$ (half-life of 7 days).
4. **Distance Proximity ($W_4 = 0.20$)**:
   - Linear decay over viewer radius: $\max\left(0, 1.0 - \frac{\text{distanceKm}}{V.maxDistanceKm}\right)$.
5. **Deterministic Diversity Micro-Adjustment ($\delta\_{\text{diversity}} < 0.001$)**:
   - Pseudo-random offset derived deterministically from SHA-256 hash of `viewerId:candidateId`.
   - Prevents identical-score ties while remaining 100% reproducible for the viewer across queries.
6. **Secondary Tie-Breaker**:
   - In case of identical scores, candidates are ordered strictly by `candidate.profileId ASC`.

---

## 5. Cursor Pagination & Security

The discovery cursor implements a cryptographically secured, opaque seek-method token.

### Payload Schema

```json
{
  "v": 1,
  "s": 0.9423,
  "id": "019460a8-b63e-7000-85f2-2b620b784a9e",
  "sig": "a866b3277b08eb3f"
}
```

- `v`: Cursor protocol version (`1`).
- `s`: Floating-point candidate score of the cursor boundary.
- `id`: Unique candidate profile UUIDv7.
- `sig`: HMAC-SHA256 signature truncated to 16 hex characters (`HMAC-SHA256(secret, "v1:0.9423:019460a8-...")`).

### Security Properties

- **Tamper Detection**: If a client alters the score, profile ID, or signature, `DiscoveryCursorService` throws `DISCOVERY_INVALID_CURSOR` (HTTP 400).
- **Zero Skips / Zero Duplicates**: Uses composite seek comparison `(score < cursorScore) OR (score == cursorScore AND id > cursorId)`.
- **Stateless Verification**: The server verifies the HMAC signature using `APP_SECRET` without requiring session database lookups.

---

## 6. Database Schema & PostGIS Optimization

### PostGIS Geography Coordinates

Profiles store location as PostGIS 4326 geography points:

```sql
ALTER TABLE profiles ADD COLUMN location geography(Point, 4326);
```

### Strategic Indexes

- **Spatial Index**:
  ```sql
  CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
  ```
- **Visibility & Gender Composite Index**:
  ```sql
  CREATE INDEX idx_profiles_visibility_gender ON profiles(visibility, gender);
  ```
- **Date of Birth Index**:
  ```sql
  CREATE INDEX idx_profiles_date_of_birth ON profiles(date_of_birth);
  ```
- **Candidate User Foreign Keys**:
  ```sql
  CREATE INDEX idx_profile_preferences_user_id ON profile_preferences(user_id);
  ```

### Optimized Candidate SQL

```sql
SELECT
  p.id AS profile_id,
  p.user_id,
  p.display_name,
  p.date_of_birth,
  p.gender,
  p.bio,
  p.occupation,
  p.education,
  p.city,
  p.country_code,
  p.visibility,
  p.completion_status,
  p.created_at,
  p.updated_at,
  pp.min_age AS candidate_min_age,
  pp.max_age AS candidate_max_age,
  pp.gender_preferences AS candidate_gender_preferences,
  pp.max_distance_km AS candidate_max_distance_km,
  pp.relationship_intent AS candidate_relationship_intent,
  ROUND(ST_Distance(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)) AS distance_meters
FROM profiles p
INNER JOIN profile_preferences pp ON pp.user_id = p.user_id
WHERE p.user_id != $3
  AND p.visibility = 'ACTIVE'
  AND (p.completion_status->>'missingRequired' IS NULL OR jsonb_array_length((p.completion_status->'missingRequired')::jsonb) = 0)
  AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
  AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, pp.max_distance_km * 1000)
  AND p.date_of_birth <= $5 AND p.date_of_birth >= $6
  AND $7 >= pp.min_age AND $7 <= pp.max_age
  AND p.gender = ANY($8::varchar[])
  AND pp.gender_preferences @> $9::jsonb
  AND EXISTS (
    SELECT 1 FROM profile_media pm
    WHERE pm.profile_id = p.id AND pm.status = 'READY'
  )
LIMIT 500;
```

---

## 7. Privacy & Distance Bucketing

To prevent geometric trilateration and preserve user safety, distance is coarse-bucketed into six discrete presentation tiers:

```typescript
export function getDistanceBucket(meters: number): DistanceBucket {
  const km = meters / 1000;
  if (km < 1) return '< 1 km';
  if (km <= 5) return '1-5 km';
  if (km <= 10) return '5-10 km';
  if (km <= 25) return '10-25 km';
  if (km <= 50) return '25-50 km';
  return '50+ km';
}
```

The public candidate payload returned to mobile clients contains:

- `profile`: Display name, derived age, gender, bio, occupation, education, city, country code, media, interests, prompts.
- `distanceBucket`: Coarse human-readable distance tier.
- `matchedRelationshipIntent`: Compatibility indicator.

All private fields (`latitude`, `longitude`, `dateOfBirth`, `score`, `preferences`, `objectKey`) are strictly excluded.

---

## 8. Mobile Client Implementation

The mobile discovery interface provides a fluid discovery experience:

- **`DiscoveryScreen`**:
  - Implements `useInfiniteQuery` via TanStack Query with key `['discovery', 'feed']`.
  - Supports pull-to-refresh (`RefreshControl`) and cursor-based infinite scrolling (`onEndReached`).
  - Graceful empty, loading, and error states.
- **`DiscoveryCard`**:
  - Full-screen candidate presentation card.
  - Primary hero image with readiness fallback and secondary photo gallery thumbnail row.
  - Clean name, age badge, distance pill (`< 1 km`, `1-5 km`), and occupation display.
  - Interactive prompts accordion and interest tag clouds.
  - Strict compliance with `@platform/ui` design system and WCAG contrast.
- **Strict Gate Boundary**: No likes, passes, or match gestures are present in Gate 06.

---

## 9. Future Integration (Gate 07 & Gate 13)

The architecture is prepared for subsequent gates:

- **Gate 07 (Interactions & Matches)**:
  - `ICandidateExclusionService` interface provides a clean plug-in point for `InteractionsModule` to exclude profiles already liked, passed, or blocked by the viewer.
- **Gate 13 (Recommendation Engine & Machine Learning)**:
  - `ICandidateRanker` interface allows switching from `DeterministicCandidateRanker` to collaborative filtering, vector embeddings, and real-time ML scoring models without altering database retrieval or controller logic.
