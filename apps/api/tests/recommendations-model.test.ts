import { describe, it, expect } from 'vitest';
import { DeterministicRecommendationModelV1 } from '../src/modules/recommendations/models/deterministic-recommendation-model-v1.js';
import type {
  RecommendationContext,
  CandidateWithFeatures,
} from '../src/modules/recommendations/models/recommendation-model.interface.js';
import { DEFAULT_RECOMMENDATION_CONFIG } from '../src/modules/recommendations/models/recommendation-model.interface.js';
import type {
  CandidateRecord,
  DiscoveryViewerContext,
} from '../src/modules/discovery/domain/discovery.types.js';

describe('DeterministicRecommendationModelV1 Unit Tests', () => {
  const model = new DeterministicRecommendationModelV1();
  const referenceTime = new Date('2026-09-29T12:00:00Z');

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
    bio: 'Software engineer passionate about coffee and hiking.',
    occupation: 'Engineer',
    education: 'Tech University',
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
    updatedAt: new Date('2026-09-29T10:00:00Z'), // 2 hours ago
    candidateMinAge: 24,
    candidateMaxAge: 32,
    candidateGenderPreferences: ['MAN'],
    candidateMaxDistanceKm: 40,
    candidateRelationshipIntent: 'LONG_TERM',
    distanceMeters: 2000,
    ...overrides,
  });

  const createContext = (
    overrides: Partial<RecommendationContext> = {}
  ): RecommendationContext => ({
    viewerUserId: viewerContext.userId,
    viewerContext,
    viewerFeatures: {
      interests: ['coffee', 'hiking', 'tech'],
      matchRate: 0.5,
      replyRate: 0.8,
      recentExposureCount: 0,
    },
    mode: 'PERSONALIZED_DISCOVERY',
    requestId: 'req-test-123',
    recommendationVersion: 'v1',
    featureVersion: 'v1',
    referenceTime,
    config: DEFAULT_RECOMMENDATION_CONFIG,
    ...overrides,
  });

  it('scores candidates deterministically and ranks highest score first', () => {
    const candidateA = createCandidate({
      profileId: '018f673a-aaaa-7000-8000-000000000001',
      userId: '018f673a-aaaa-7000-8000-000000000002',
      displayName: 'High Match Candidate',
      updatedAt: new Date('2026-09-29T11:00:00Z'), // 1 hour ago
      distanceMeters: 1000,
    });

    const candidateB = createCandidate({
      profileId: '018f673a-bbbb-7000-8000-000000000001',
      userId: '018f673a-bbbb-7000-8000-000000000002',
      displayName: 'Low Match Candidate',
      updatedAt: new Date('2026-09-20T11:00:00Z'), // 9 days ago
      distanceMeters: 28000,
    });

    const items: CandidateWithFeatures[] = [
      {
        candidate: candidateA,
        features: {
          interests: ['coffee', 'hiking', 'tech'],
          photosCount: 4,
          promptsCount: 3,
          profileCompleteness: 100,
          matchRate: 0.7,
          replyRate: 0.9,
          recentExposureCount: 0,
        },
        recentExposuresCount: 0,
        sharedCommunitiesCount: 2,
        sharedEventsCount: 1,
      },
      {
        candidate: candidateB,
        features: {
          interests: ['movies'],
          photosCount: 1,
          promptsCount: 0,
          profileCompleteness: 40,
          matchRate: 0.1,
          replyRate: 0.2,
          recentExposureCount: 0,
        },
        recentExposuresCount: 0,
        sharedCommunitiesCount: 0,
        sharedEventsCount: 0,
      },
    ];

    const context = createContext();
    const ranked = model.score(context, items);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.candidate.profileId).toBe(candidateA.profileId);
    expect(ranked[1]!.candidate.profileId).toBe(candidateB.profileId);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('penalizes repeatedly exposed candidates and boosts fresh candidates', () => {
    const candidateFresh = createCandidate({
      profileId: '018f673a-1111-7000-8000-000000000001',
      displayName: 'Fresh Candidate',
    });

    const candidateExposed = createCandidate({
      profileId: '018f673a-2222-7000-8000-000000000001',
      displayName: 'Exposed Candidate',
    });

    const items: CandidateWithFeatures[] = [
      {
        candidate: candidateFresh,
        features: { interests: ['coffee'], matchRate: 0.4, replyRate: 0.6, recentExposureCount: 0 },
        recentExposuresCount: 0,
        sharedCommunitiesCount: 0,
        sharedEventsCount: 0,
      },
      {
        candidate: candidateExposed,
        features: { interests: ['coffee'], matchRate: 0.4, replyRate: 0.6, recentExposureCount: 5 },
        recentExposuresCount: 5, // high exposure
        sharedCommunitiesCount: 0,
        sharedEventsCount: 0,
      },
    ];

    const context = createContext();
    const ranked = model.score(context, items);

    expect(ranked[0]!.candidate.profileId).toBe(candidateFresh.profileId);
    expect(ranked[1]!.candidate.profileId).toBe(candidateExposed.profileId);
    expect(ranked[1]!.breakdown.exposurePenalty).toBeGreaterThan(0);
    expect(ranked[0]!.breakdown.exposurePenalty).toBe(0);
  });

  it('breaks ties deterministically using profileId lexicographical order', () => {
    const candidateA = createCandidate({
      profileId: '018f673a-aaaa-7000-8000-000000000001',
      userId: '018f673a-aaaa-7000-8000-000000000002',
    });
    const candidateB = createCandidate({
      profileId: '018f673a-bbbb-7000-8000-000000000001',
      userId: '018f673a-bbbb-7000-8000-000000000002',
    });

    // Both identical features and metrics
    const items: CandidateWithFeatures[] = [
      {
        candidate: candidateB,
        features: { interests: ['coffee'], matchRate: 0.5, replyRate: 0.5, recentExposureCount: 0 },
        recentExposuresCount: 0,
        sharedCommunitiesCount: 0,
        sharedEventsCount: 0,
      },
      {
        candidate: candidateA,
        features: { interests: ['coffee'], matchRate: 0.5, replyRate: 0.5, recentExposureCount: 0 },
        recentExposuresCount: 0,
        sharedCommunitiesCount: 0,
        sharedEventsCount: 0,
      },
    ];

    const context = createContext({
      config: {
        ...DEFAULT_RECOMMENDATION_CONFIG,
        explorationRate: 0, // disable jitter for strict tie
      },
    });

    const ranked = model.score(context, items);

    expect(ranked[0]!.score).toBe(ranked[1]!.score);
    // Profile A lexicographically precedes Profile B
    expect(ranked[0]!.candidate.profileId).toBe(candidateA.profileId);
    expect(ranked[1]!.candidate.profileId).toBe(candidateB.profileId);
  });
});
