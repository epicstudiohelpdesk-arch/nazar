# Nazar Experimentation Foundation

## 1. Overview & Architectural Principles

The experimentation layer provides deterministic, stateless A/B testing and multi-variant feature allocation without runtime external network calls or database bottlenecks on hot paths.

Key characteristics:

1. **Deterministic Variant Hashing**: User variant assignment is computed by hashing the combination of `experimentKey` and `entityId` (`actorUserId` or `anonymousId`).
2. **Stable Allocation**: A user consistently receives the same variant for the duration of an experiment without requiring persistent storage checks.
3. **Auditability & Attribution**: Every experiment impression is tracked via an exposure event, enabling statistical conversion comparison.

---

## 2. Assignment Algorithm

The allocation uses a standardized hash-modulo scheme over 10,000 basis points ($0.01\%$ resolution):

```typescript
function assignVariant(experimentKey: string, entityId: string, variants: Variant[]): string {
  // Deterministic seed: e.g. "recs_v2_model:019438fa-..."
  const hash = sha256(`${experimentKey}:${entityId}`);
  const bucket = parseInt(hash.slice(0, 8), 16) % 10000;

  let cumulativeWeight = 0;
  for (const variant of variants) {
    cumulativeWeight += variant.weightBasisPoints; // e.g. 5000 for 50%
    if (bucket < cumulativeWeight) {
      return variant.key;
    }
  }
  return variants[0].key;
}
```

---

## 3. Exposure Tracking Pipeline

To evaluate experiment impact without selection bias:

1. When a user experiences a feature variant (e.g., viewing an experimental recommendation feed or paywall layout), the client or server records an exposure:
   ```http
   POST /v1/analytics/experiments/exposure
   {
     "experimentKey": "rec_algorithm_v2",
     "variantKey": "treatment_b",
     "metadata": { "uiContext": "feed_carousel" }
   }
   ```
2. The server logs the exposure event in `analytics_experiment_exposures`.
3. In subsequent conversion funnels or retention metrics, analysts group conversion rates by `variantKey` among exposed users.

---

## 4. Experiment Schema

Experiments are managed in `analytics_experiment_definitions`:

- `experiment_key`: Unique string identifier (e.g., `discovery_ranking_v2`).
- `status`: `DRAFT`, `RUNNING`, `PAUSED`, `CONCLUDED`.
- `variants`: JSON configuration detailing keys (`control`, `treatment_a`, `treatment_b`) and allocation weights.
- `rollout_percentage`: Overall population percentage included in the test ($0-100\%$).
