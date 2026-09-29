# Nazar Event Taxonomy Reference

## 1. Naming Convention

All platform analytics events follow the strict hierarchical dot-notation:

$$\text{<domain>.<entity>.<action>}$$

- **domain**: Major functional platform domain (`auth`, `profile`, `discovery`, `interaction`, `match`, `conversation`, `message`, `social`, `community`, `event`, `subscription`, `entitlement`, `notification`, `recommendation`, `moderation`, `admin`).
- **entity**: Primary subject within the domain (`session`, `card`, `like`, `pass`, `post`, `comment`, `rsvp`, `plan`, `rule`).
- **action**: Past-tense lifecycle verb describing the event (`started`, `viewed`, `completed`, `created`, `updated`, `cancelled`).

---

## 2. Event Registry & Producer Authority Matrix

| Event Name                         | Version | Allowed Producers  |     Privacy Class      | Description                               |
| :--------------------------------- | :-----: | :----------------: | :--------------------: | :---------------------------------------- |
| **Authentication & Onboarding**    |         |                    |                        |                                           |
| `auth.session.started`             |    1    | `CLIENT`, `SERVER` |     `PSEUDONYMOUS`     | Client session launch / cold start        |
| `auth.login.completed`             |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Successful user authentication            |
| `auth.signup.completed`            |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | New user account creation                 |
| `auth.logout.completed`            |    1    | `CLIENT`, `SERVER` |     `PSEUDONYMOUS`     | Explicit user logout                      |
| **Profile**                        |         |                    |                        |                                           |
| `profile.created`                  |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Profile entity initialized                |
| `profile.updated`                  |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Profile attributes modified               |
| `profile.completed`                |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Onboarding steps completed                |
| `profile.photo.uploaded`           |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Profile photo added                       |
| **Discovery & Recommendations**    |         |                    |                        |                                           |
| `discovery.feed.viewed`            |    1    | `CLIENT`, `SERVER` |     `PSEUDONYMOUS`     | Swiping feed fetched/displayed            |
| `discovery.card.viewed`            |    1    |      `CLIENT`      |     `PSEUDONYMOUS`     | Discovery card displayed on screen        |
| `discovery.filter.applied`         |    1    |      `CLIENT`      |     `PSEUDONYMOUS`     | Discovery filters adjusted                |
| `recommendation.feed.requested`    |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Candidate generator queried               |
| `recommendation.feed.served`       |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Recommendation candidate list served      |
| `recommendation.candidate.exposed` |    1    | `CLIENT`, `SERVER` |     `PSEUDONYMOUS`     | Recommendation card shown to actor        |
| **Interactions & Matches**         |         |                    |                        |                                           |
| `interaction.like.created`         |    1    | `CLIENT`, `SERVER` | `SENSITIVE_BEHAVIORAL` | Like/right swipe dispatched               |
| `interaction.pass.created`         |    1    | `CLIENT`, `SERVER` | `SENSITIVE_BEHAVIORAL` | Pass/left swipe dispatched                |
| `match.created`                    |    1    |      `SERVER`      | `SENSITIVE_BEHAVIORAL` | Mutual match formed (Server only)         |
| `match.unmatched`                  |    1    |      `SERVER`      | `SENSITIVE_BEHAVIORAL` | Match dissolved (Server only)             |
| **Conversations & Messaging**      |         |                    |                        |                                           |
| `conversation.opened`              |    1    |      `CLIENT`      |     `PSEUDONYMOUS`     | Chat screen navigated to                  |
| `message.sent`                     |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Message sent (metadata only, no raw text) |
| `message.delivered`                |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Message received by recipient device      |
| `message.read`                     |    1    | `CLIENT`, `SERVER` |     `PSEUDONYMOUS`     | Message marked read                       |
| **Social, Communities & Events**   |         |                    |                        |                                           |
| `social.post.created`              |    1    |      `SERVER`      |        `PUBLIC`        | Social post published                     |
| `social.post.viewed`               |    1    |      `CLIENT`      |        `PUBLIC`        | Social post rendered in feed              |
| `social.comment.created`           |    1    |      `SERVER`      |        `PUBLIC`        | Comment posted                            |
| `social.reaction.created`          |    1    | `CLIENT`, `SERVER` |        `PUBLIC`        | Reaction added to post/comment            |
| `community.joined`                 |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Joined a community space                  |
| `community.left`                   |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Left a community space                    |
| `event.viewed`                     |    1    |      `CLIENT`      |        `PUBLIC`        | Event detail page viewed                  |
| `event.rsvp.created`               |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | RSVP registered for an event              |
| **Monetization & Entitlements**    |         |                    |                        |                                           |
| `subscription.checkout.started`    |    1    | `CLIENT`, `SERVER` |    `RESTRICTED_PII`    | Paywall opened / checkout initiated       |
| `subscription.activated`           |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Subscription purchased (Server only)      |
| `subscription.renewed`             |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Recurring billing renewal (Server only)   |
| `subscription.cancelled`           |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Subscription cancelled (Server only)      |
| `entitlement.granted`              |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Feature access assigned (Server only)     |
| `entitlement.revoked`              |    1    |      `SERVER`      |    `RESTRICTED_PII`    | Feature access revoked (Server only)      |
| **Notifications**                  |         |                    |                        |                                           |
| `notification.sent`                |    1    |      `SERVER`      |     `PSEUDONYMOUS`     | Push/in-app notification dispatched       |
| `notification.clicked`             |    1    |      `CLIENT`      |     `PSEUDONYMOUS`     | User tapped push notification             |
| **Trust, Safety & Moderation**     |         |                    |                        |                                           |
| `moderation.report.created`        |    1    |      `SERVER`      | `SENSITIVE_BEHAVIORAL` | Safety report submitted                   |
| `moderation.action.applied`        |    1    |      `SERVER`      | `SENSITIVE_BEHAVIORAL` | Safety sanctions applied (Server only)    |
| `moderation.user.blocked`          |    1    |      `SERVER`      | `SENSITIVE_BEHAVIORAL` | User block established                    |
| **Admin Operations**               |         |                    |                        |                                           |
| `admin.action.executed`            |    1    |      `SERVER`      | `SENSITIVE_BEHAVIORAL` | Staff administrative mutation             |

---

## 3. Producer Enforcement Rules

1. **Client Authority Ceiling**:
   - Clients may only emit observational events describing user intent or local device state (e.g., `discovery.card.viewed`, `conversation.opened`, `notification.clicked`).
   - Clients may NOT emit events that finalize transactional commitments (`match.created`, `subscription.activated`, `moderation.action.applied`).
2. **Rejection & Quarantine**:
   - Any client dispatching a server-only event is quarantined under code `UNAUTHORIZED_PRODUCER` and excluded from all reporting and aggregation.
