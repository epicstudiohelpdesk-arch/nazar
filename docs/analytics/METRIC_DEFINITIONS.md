# Nazar Canonical Metric Definitions

## 1. Active User Metrics

### Daily Active Users (DAU)

- **Definition**: The count of distinct authenticated `actorUserId`s that triggered at least one active telemetry event within the UTC calendar day.
- **Active Events**: `auth.session.started`, `discovery.feed.viewed`, `interaction.like.created`, `interaction.pass.created`, `message.sent`, `social.post.created`, `social.reaction.created`.
- **SQL Logic**:
  ```sql
  SELECT COUNT(DISTINCT actor_user_id)
  FROM analytics_events
  WHERE occurred_at >= :startOfDay AND occurred_at < :endOfDay
    AND actor_user_id IS NOT NULL;
  ```

### Weekly Active Users (WAU)

- **Definition**: Distinct active `actorUserId`s observed over a trailing 7-day window.

### Monthly Active Users (MAU)

- **Definition**: Distinct active `actorUserId`s observed over a trailing 30-day window.

---

## 2. Acquisition & Onboarding Metrics

### New Signups

- **Definition**: Count of `auth.signup.completed` events recorded within the target window.

### Profile Completion Rate

- **Definition**: Ratio of distinct users completing onboarding (`profile.completed`) to distinct users who signed up (`auth.signup.completed`) within the same cohort period.
  $$\text{Completion Rate} = \frac{\text{Users with profile.completed}}{\text{Users with auth.signup.completed}} \times 100\%$$

---

## 3. Discovery & Interaction Metrics

### Likes Sent

- **Definition**: Total count of `interaction.like.created` events.
- **Dimensions**: Breakdown by `source` (`DISCOVERY`, `RECOMMENDATION`, `PROFILE_EXPLORE`).

### Passes Sent

- **Definition**: Total count of `interaction.pass.created` events.

### Match Rate

- **Definition**: Ratio of matches created to total likes dispatched.
  $$\text{Match Rate} = \frac{\text{Matches Created}}{\text{Likes Dispatched}} \times 100\%$$

---

## 4. Communication & Engagement Metrics

### Messages Sent

- **Definition**: Total count of `message.sent` events.
- **Dimensions**: Breakdown by `lengthBucket` (`SHORT`, `MEDIUM`, `LONG`) and `hasAttachment`.

### Conversation Start Rate

- **Definition**: Percentage of newly formed matches that progress to at least one message exchange within 24 hours.

---

## 5. Monetization & Subscription Metrics

### Monthly Recurring Revenue (MRR)

- **Definition**: Sum of normalized monthly subscription values across all active subscriptions in `analytics_daily_metrics`.

### Paywall Conversion Rate

- **Definition**: Ratio of `subscription.activated` events to distinct `subscription.checkout.started` events.

### Churn Rate

- **Definition**: Ratio of `subscription.cancelled` events to total active subscriptions at the start of the period.

---

## 6. Safety & Moderation Metrics

### Report Volume

- **Definition**: Total count of `moderation.report.created` events grouped by report category.

### Actioned Moderation Rate

- **Definition**: Percentage of reports that resulted in a formal sanction (`moderation.action.applied` or account suspension).
