# Nazar Mobile · Subscription & Premium Architecture

## 1. Overview & Mission

Frontend Phase F9 delivers the complete production-grade **Subscription + Premium UX** for Nazar, seamlessly integrating the backend Gate 11 payment, subscription, and entitlement infrastructure with the React Native mobile application.

```text
Discovery / Filters / Matches Surface
                 │
           Feature Gate
                 │
      Authoritative Entitlements
        ┌────────┴────────┐
        ▼                 ▼
   [Entitled]       [Unentitled]
   Access Granted   Paywall / Plan Selection (/billing)
                          │
                    Store Purchase (Apple / Google)
                          │
                    Backend Server Verification
                    (POST /v1/billing/purchases/verify)
                          │
                    Authoritative Entitlement Grant
                          │
                    TanStack Query Cache Reconciliation
```

### Core Architecture Principles

1. **Server Authority**: The backend is solely authoritative for product identifiers, prices, currencies, transaction verification, entitlement grants, expirations, and cancellation states. The frontend never determines premium status from local receipt presence, client timers, or optimistic flags.
2. **Zero Price/Plan Fabrication**: The client only displays products returned directly by `GET /v1/billing/products` seeded from Gate 11. No synthetic currencies, fictional discounts, or unverified tiers are ever introduced.
3. **Graceful Degradation & Transparency**: Users in payment grace periods or with cancelled auto-renewal receive clear, non-punitive system guidance and deep links directly to their native OS subscription management settings.
4. **Zero PII & Token Leakage**: Raw store transaction receipts, purchase tokens, and JWS signed payloads are strictly excluded from client-side analytics and logs.

---

## 2. Backend Contracts & Catalog Integration

Inspection of `@platform/api-contracts` (Gate 11 payments module):

### Production Catalog Specifications

| Product Code      | Type                | Duration | Price (INR) | Minor Units | Granted Entitlement Codes                                                                             |
| :---------------- | :------------------ | :------- | :---------- | :---------- | :---------------------------------------------------------------------------------------------------- |
| `PREMIUM_MONTHLY` | Subscription        | 30 Days  | ₹199        | `19900`     | `PREMIUM`, `SEE_LIKES`, `UNLIMITED_LIKES`, `ADVANCED_DISCOVERY`, `UNLIMITED_REWINDS`                  |
| `PREMIUM_ANNUAL`  | Subscription        | 365 Days | ₹1,499      | `149900`    | `PREMIUM`, `SEE_LIKES`, `UNLIMITED_LIKES`, `ADVANCED_DISCOVERY`, `PROFILE_BOOST`, `UNLIMITED_REWINDS` |
| `BOOST_ONE_TIME`  | One-Time Consumable | 1 Day    | ₹49         | `4900`      | `PROFILE_BOOST`                                                                                       |

### API Endpoints Matrix

| Purpose                   | Method & Path                        | Request / Query DTO          | Response DTO                        | Mobile Implementation                                           |
| :------------------------ | :----------------------------------- | :--------------------------- | :---------------------------------- | :-------------------------------------------------------------- |
| **Catalog Listing**       | `GET /v1/billing/products`           | None                         | `ProductListResponseDto`            | Cached in `useProducts()` with 15-min staleTime                 |
| **Purchase Verification** | `POST /v1/billing/purchases/verify`  | `VerifyPurchaseRequestDto`   | `PurchaseVerificationResultDto`     | `usePurchaseMutation()` invalidates `['billing']` root          |
| **Restore Purchases**     | `POST /v1/billing/purchases/restore` | `RestorePurchasesRequestDto` | `RestorePurchasesResultDto`         | `useRestorePurchasesMutation()` synchronizes multi-device state |
| **Entitlements Query**    | `GET /v1/billing/entitlements`       | None                         | `EntitlementsListResponseDto`       | Centralized `useEntitlements()` hook                            |
| **User Subscriptions**    | `GET /v1/billing/subscriptions`      | None                         | `SubscriptionListResponseDto`       | `useSubscriptions()` filters active, cancelled, & grace states  |
| **Transaction History**   | `GET /v1/billing/transactions`       | `limit`, `cursor`            | `PaymentTransactionListResponseDto` | Infinite paginated list on `/billing/history`                   |

---

## 3. Entitlement & Lifecycle State Machine

The client represents authoritative server lifecycle states without inferring speculative intermediate states:

```text
              ┌───────────────┐
              │  Free / None  │
              └───────┬───────┘
                      │ purchase / restore
                      ▼
              ┌───────────────┐
         ┌───►│    ACTIVE     │◄─────────────────┐
         │    └───────┬───────┘                  │
renewed  │            │ payment failed           │ payment fixed
         │            ▼                          │
         │    ┌───────────────┐                  │
         └────┤ GRACE_PERIOD  ├──────────────────┘
              └───────┬───────┘
                      │ grace expired
                      ▼
              ┌───────────────┐
              │    EXPIRED    │
              └───────────────┘
                      ▲
                      │ period ends
              ┌───────┴───────┐
              │   CANCELLED   │ (autoRenewEnabled = false, active until periodEnd)
              └───────────────┘
```

- **Active Subscription**: Valid date window (`startsAt <= now < expiresAt`), `active: true`.
- **Cancelled Auto-Renew**: Subscription displays "ACTIVE (CANCELLED)" badge with exact expiration date; benefits remain fully available until `currentPeriodEnd`.
- **Payment Grace Period**: Banner informs the user that renewal processing failed and prompts updating their payment method in the native store without abruptly locking features.
- **Expired / Free**: Feature gates render paywall prompts or fallback cards.

---

## 4. Reusable Feature Gating (`<PremiumGate />`)

Feature gating is abstracted into a single, high-reliability component and accompanying hook:

```tsx
// Hook usage
const { isUnlocked, isLoading } = useFeatureGate('UNLIMITED_REWINDS');

// Declarative JSX gating
<PremiumGate
  feature="ADVANCED_DISCOVERY"
  lockedTitle="Relationship Intent Filters"
  lockedMessage="Filter your discovery deck by specific dating intentions and lifestyle preferences."
  onUnlockPress={() => router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/modal/filters')}
>
  <RelationshipIntentSelector />
</PremiumGate>;
```

### Integrated Touchpoints

1. **Discovery Deck (`apps/mobile/src/discovery/DiscoveryScreen.tsx`)**:
   - Undo/rewind action is protected by `UNLIMITED_REWINDS`.
   - When tapped without entitlement, fires `premium_feature_locked` event and displays an alert prompting navigation to `/billing`.
2. **Discovery Preferences (`apps/mobile/app/modal/filters.tsx`)**:
   - Fine-grained relationship intent filters are wrapped with `<PremiumGate feature="ADVANCED_DISCOVERY">`.
   - Unentitled members see an elevated lock card explaining the benefit with an "Unlock with Premium" action.
3. **Matches & Connections (`apps/mobile/src/matches/MatchesScreen.tsx`)**:
   - "See Who Liked You" section is wrapped with `<PremiumGate feature="SEE_LIKES">`.
   - Never exposes sensitive identity or photos of suitors before authoritative server verification.
4. **Settings Hub (`apps/mobile/app/settings/index.tsx`)**:
   - "Nazar Premium Subscription" row displays current membership tier and links directly to the management paywall.

---

## 5. Paywall & Store Management Routes

### `/billing` (`SubscriptionScreen`)

- **Active Subscription Badge**: Dynamically indicates `ACTIVE SUBSCRIBER`, `ACTIVE (CANCELLED)`, or `PAYMENT GRACE PERIOD`.
- **Store Management Deep Link**: Provides a 1-tap link to the native operating system subscription management interface via `billingManager.getManagementUrl(provider)`:
  - Apple App Store: `https://apps.apple.com/account/subscriptions`
  - Google Play: `https://play.google.com/store/account/subscriptions`
- **Included Benefits Showcase**: Interactive highlights of unlimited likes, see who liked you, advanced discovery filters, rewinds, and profile boost using Nazar design system tokens (`accentSoft`, `SurfaceCard`, `Heading`).
- **Product Selector**: Accessible radio list with automated discount badge highlighting annual plan savings (37% off monthly equivalent).
- **Restore Purchases**: Multi-device restoration button with feedback alerts.
- **Terms & Store Policy**: Compliant legal disclosures regarding auto-renewal, cancellation policies, and terms of service.

### `/billing/history` (`BillingHistoryScreen`)

- **Transaction Audit Trail**: Full list of user purchases, renewals, and refunds with status indicators (`SUCCEEDED`, `PENDING`, `FAILED`, `REFUNDED`).
- **Pagination**: Backed by `GET /v1/billing/transactions` using cursor pagination with pull-to-refresh.

---

## 6. Cache Synchronization & Account Session Cleansing

### App Resume Revalidation

`useBillingResumeSync()` listens to React Native `AppState` changes (`active`). When the user returns from the App Store or Google Play settings, it triggers a background refetch of `BILLING_QUERY_KEYS.root` to reconcile entitlements instantly.

### Session Boundary Security

Upon user logout or account deletion (`apps/mobile/app/settings/index.tsx`):

```typescript
clearBillingCaches(queryClient);
```

This purges all in-memory entitlements from `BillingManager` and removes all TanStack Query cache entries under `['billing']`, preventing any entitlement cross-contamination across user accounts.

---

## 7. Analytics & Anti-PII Safeguards

Standardized telemetry events defined in `apps/mobile/src/analytics/onboarding-analytics.ts`:

- `premium_paywall_viewed`
- `premium_feature_locked`
- `premium_product_selected`
- `purchase_started`
- `purchase_validated`
- `purchase_failed`
- `purchase_cancelled`
- `purchase_restored`
- `entitlement_activated`
- `subscription_management_opened`

`sanitizeAnalyticsProperties` guarantees that payment secrets (`receipt`, `receiptData`, `purchaseToken`, `signedPayload`) are completely stripped from telemetry payloads prior to transmission.
