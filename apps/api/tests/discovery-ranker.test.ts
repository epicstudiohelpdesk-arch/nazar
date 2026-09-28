import { describe, it, expect } from 'vitest';
import { DeterministicCandidateRanker } from '../src/modules/discovery/ranker/deterministic-candidate-ranker.js';
import type {
  CandidateRecord,
  DiscoveryViewerContext,
} from '../src/modules/discovery/domain/discovery.types.js';

describe('DeterministicCandidateRanker Unit Tests', () => {
  const fixedNow = new Date('2026-09-28T12:00:00Z');
  const mockClock = {
    now: () => fixedNow,
    nowMs: () => fixedNow.getTime(),
  };

  const ranker = new DeterministicCandidateRanker(mockClock);

  const viewerContext: DiscoveryViewerContext = {
    userId: '018f673a-0000-7000-8000-000000000001',
    profileId: '018f673a-0000-7000-8000-000000000002',
    age: 26,
    gender: 'MAN',
    location: { latitude: 22.5726, longitude: 88.3639 },
    minAge: 22,
    maxAge: 30,
    genderPreferences: ['WOMAN'],
    maxDistanceKm: 30,
    relationshipIntent: 'LONG_TERM',
  };

  const createCandidate = (overrides: Partial<CandidateRecord> = {}): CandidateRecord => ({
    profileId: '018f673a-1111-7000-8000-000000000001',
    userId: '018f673a-2222-7000-8000-000000000002',
    displayName: 'Priya',
    dateOfBirth: '2000-05-15',
    age: 26,
    gender: 'WOMAN',
    bio: 'Software engineer passionate about coffee and reading.',
    occupation: 'Engineer',
    education: 'Tech Institute',
    city: 'Kolkata',
    countryCode: 'IN',
    latitude: 22.58,
    longitude: 88.37,
    visibility: 'ACTIVE',
    completionStatus: {
      percentage: 100,
      missingRequired: [],
      recommended: [],
    },
    createdAt: new Date('2026-09-20T10:00:00Z'),
    updatedAt: new Date('2026-09-28T10:00:00Z'), // 2 hours ago -> high freshness
    candidateMinAge: 24,
    candidateMaxAge: 32,
    candidateGenderPreferences: ['MAN'],
    candidateMaxDistanceKm: 40,
    candidateRelationshipIntent: 'LONG_TERM',
    distanceMeters: 2500, // 2.5 km -> high proximity
    ...overrides,
  });

  it('should compute explainable features with strictly normalized bounds [0.0, 1.0]', () => {
    const candidate = createCandidate();
    const features = ranker.calculateFeatures(candidate, viewerContext, fixedNow);

    expect(features.preferenceCompatibilityScore).toBeGreaterThanOrEqual(0.0);
    expect(features.preferenceCompatibilityScore).toBeLessThanOrEqual(1.0);

    expect(features.profileCompletenessScore).toBeGreaterThanOrEqual(0.0);
    expect(features.profileCompletenessScore).toBeLessThanOrEqual(1.0);

    expect(features.freshnessScore).toBeGreaterThanOrEqual(0.0);
    expect(features.freshnessScore).toBeLessThanOrEqual(1.0);

    expect(features.distanceScore).toBeGreaterThanOrEqual(0.0);
    expect(features.distanceScore).toBeLessThanOrEqual(1.0);

    expect(features.finalScore).toBeGreaterThanOrEqual(0.0);
    expect(features.finalScore).toBeLessThanOrEqual(1.0);
  });

  it('should rank nearer candidate higher than distant candidate all else equal', () => {
    const nearCandidate = createCandidate({
      profileId: '018f673a-aaaa-7000-8000-000000000001',
      distanceMeters: 1000, // 1 km
    });

    const farCandidate = createCandidate({
      profileId: '018f673a-bbbb-7000-8000-000000000002',
      distanceMeters: 28000, // 28 km
    });

    const ranked = ranker.rank([farCandidate, nearCandidate], viewerContext);

    expect(ranked[0]!.candidate.profileId).toBe(nearCandidate.profileId);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('should deterministically break score ties using profileId ascending', () => {
    // Two candidates with identical scores
    const candidateA = createCandidate({
      profileId: '018f673a-0000-7000-8000-aaaaaaaaaaaa',
    });
    const candidateB = createCandidate({
      profileId: '018f673a-0000-7000-8000-bbbbbbbbbbbb',
    });

    const ranked1 = ranker.rank([candidateB, candidateA], viewerContext);
    const ranked2 = ranker.rank([candidateA, candidateB], viewerContext);

    expect(ranked1.map((r) => r.candidate.profileId)).toEqual(
      ranked2.map((r) => r.candidate.profileId)
    );
    expect(ranked1[0]!.candidate.profileId).toBe(candidateA.profileId);
  });

  it('should produce identical deterministic rankings on repeated invocations', () => {
    const c1 = createCandidate({
      profileId: '018f673a-1000-7000-8000-000000000001',
      age: 24,
      distanceMeters: 5000,
    });
    const c2 = createCandidate({
      profileId: '018f673a-2000-7000-8000-000000000002',
      age: 28,
      distanceMeters: 12000,
    });
    const c3 = createCandidate({
      profileId: '018f673a-3000-7000-8000-000000000003',
      age: 26,
      distanceMeters: 1000,
    });

    const run1 = ranker.rank([c1, c2, c3], viewerContext);
    const run2 = ranker.rank([c2, c3, c1], viewerContext);

    expect(run1.map((r) => r.candidate.profileId)).toEqual(run2.map((r) => r.candidate.profileId));
    expect(run1.map((r) => r.score)).toEqual(run2.map((r) => r.score));
  });
});
