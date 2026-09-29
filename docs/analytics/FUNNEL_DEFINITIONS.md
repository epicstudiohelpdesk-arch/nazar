# Nazar Funnel Definitions

## 1. Funnel Calculation Model

A funnel computes sequential step progression for distinct users across an ordered sequence of events within a fixed evaluation window (default: 7 days).

- **Conversion Rate (Step 1)**: Always $100\%$ by definition.
- **Conversion Rate (Step $N$)**:
  $$\text{Conversion Rate}_N = \frac{\text{Unique Users completing Step } N}{\text{Unique Users completing Step 1}} \times 100\%$$
- **Step-to-Step Drop-off**:
  $$\text{Drop-off}_N = \left(1 - \frac{\text{Unique Users completing Step } N}{\text{Unique Users completing Step } N - 1}\right) \times 100\%$$

---

## 2. Standard Platform Funnels

### 1. User Onboarding Funnel (`signup_funnel`)

Tracks newly acquired users through initial activation:

1. `auth.session.started` (App launch)
2. `auth.signup.completed` (Registration completed)
3. `profile.created` (Basic demographic fields saved)
4. `profile.completed` (Photos and mandatory prompts uploaded)

### 2. Discovery to Interaction Funnel (`discovery_to_like_funnel`)

Tracks feed engagement:

1. `discovery.feed.viewed` (Discovery screen opened)
2. `discovery.card.viewed` (Card rendered in viewport)
3. `interaction.like.created` (Profile liked)

### 3. Match to Chat Funnel (`match_to_chat_funnel`)

Tracks interaction progression to active conversation:

1. `match.created` (Mutual match established)
2. `conversation.opened` (Chat view initialized)
3. `message.sent` (First message transmitted)

### 4. Paywall Conversion Funnel (`paywall_conversion_funnel`)

Tracks monetization efficiency:

1. `subscription.checkout.started` (Paywall sheet presented)
2. `subscription.activated` (Payment confirmed and subscription provisioned)

---

## 3. Querying Funnels via API

Funnels can be retrieved dynamically via the Admin Analytics API:

```http
GET /v1/admin/analytics/funnels/signup_funnel?startDate=2026-09-01&endDate=2026-09-29
Authorization: Bearer <AdminToken>
```

**Response Format**:

```json
{
  "success": true,
  "data": {
    "funnelId": "signup_funnel",
    "name": "User Onboarding Funnel",
    "steps": [
      {
        "stepIndex": 1,
        "eventName": "auth.session.started",
        "stepName": "Session Started",
        "uniqueUsers": 12500,
        "conversionRate": 100.0,
        "dropOffRate": 0.0
      },
      {
        "stepIndex": 2,
        "eventName": "auth.signup.completed",
        "stepName": "Signup Completed",
        "uniqueUsers": 7800,
        "conversionRate": 62.4,
        "dropOffRate": 37.6
      },
      {
        "stepIndex": 3,
        "eventName": "profile.created",
        "stepName": "Profile Created",
        "uniqueUsers": 6400,
        "conversionRate": 51.2,
        "dropOffRate": 17.9
      },
      {
        "stepIndex": 4,
        "eventName": "profile.completed",
        "stepName": "Profile Completed",
        "uniqueUsers": 4900,
        "conversionRate": 39.2,
        "dropOffRate": 23.4
      }
    ]
  }
}
```
