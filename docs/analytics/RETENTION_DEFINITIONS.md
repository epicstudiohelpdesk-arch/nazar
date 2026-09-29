# Nazar Cohort & Retention Definitions

## 1. Retention Measurement Methodology

Retention evaluates user habituation and durability by grouping users into daily or weekly activation cohorts and tracking the proportion that return to perform meaningful platform actions on subsequent days.

### Activation Event

- Canonical activation: `auth.signup.completed` (New user joins Nazar).

### Return Event

- Canonical return: Any of:
  - `auth.session.started`
  - `discovery.feed.viewed`
  - `interaction.like.created`
  - `interaction.pass.created`
  - `message.sent`

---

## 2. Retention Matrix Structure

Retention is aggregated across standardized day offsets:

- **Day 0**: Activation day ($100\%$ return rate).
- **Day 1**: Returned 1 day ($24\text{ to }48\text{ hours}$) after activation.
- **Day 3**: Returned 3 days after activation.
- **Day 7**: Returned 7 days after activation.
- **Day 14**: Returned 14 days after activation.
- **Day 30**: Returned 30 days after activation.

$$\text{Retention Rate}(D_k) = \frac{\text{Distinct users active on Day } k \text{ from Cohort } C}{\text{Initial cohort size } |C|} \times 100\%$$

---

## 3. Querying Retention via Admin API

```http
GET /v1/admin/analytics/retention?limit=14
Authorization: Bearer <AdminToken>
```

**Response Format**:

```json
{
  "success": true,
  "data": {
    "activationEvent": "auth.signup.completed",
    "returnEvent": "auth.session.started",
    "cohorts": [
      {
        "cohortDate": "2026-09-01",
        "cohortSize": 450,
        "day1": 56.2,
        "day3": 42.1,
        "day7": 34.0,
        "day14": 26.8,
        "day30": 21.4
      },
      {
        "cohortDate": "2026-09-02",
        "cohortSize": 480,
        "day1": 58.0,
        "day3": 44.5,
        "day7": 36.1,
        "day14": 28.0,
        "day30": null
      }
    ]
  }
}
```
