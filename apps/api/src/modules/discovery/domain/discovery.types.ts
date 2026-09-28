import type {
  Gender,
  RelationshipIntent,
  ProfileCompleteness,
  LocationCoordinates,
} from '@platform/api-contracts';

export interface DiscoveryViewerContext {
  readonly userId: string;
  readonly profileId: string;
  readonly age: number;
  readonly gender: Gender;
  readonly location: LocationCoordinates | null;
  readonly minAge: number;
  readonly maxAge: number;
  readonly genderPreferences: readonly Gender[];
  readonly maxDistanceKm: number;
  readonly relationshipIntent: RelationshipIntent;
}

export interface CandidateRecord {
  readonly profileId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly dateOfBirth: string; // YYYY-MM-DD
  readonly age: number;
  readonly gender: Gender;
  readonly bio?: string | null;
  readonly occupation?: string | null;
  readonly education?: string | null;
  readonly city?: string | null;
  readonly countryCode?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly visibility: string;
  readonly completionStatus: ProfileCompleteness;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly candidateMinAge: number;
  readonly candidateMaxAge: number;
  readonly candidateGenderPreferences: readonly Gender[];
  readonly candidateMaxDistanceKm: number;
  readonly candidateRelationshipIntent: RelationshipIntent;
  readonly distanceMeters?: number | null;
}

export interface CandidateRankingFeatures {
  readonly preferenceCompatibilityScore: number; // 0.0 - 1.0
  readonly profileCompletenessScore: number; // 0.0 - 1.0
  readonly freshnessScore: number; // 0.0 - 1.0
  readonly distanceScore: number; // 0.0 - 1.0
  readonly diversityAdjustment: number; // 0.0 - 1.0
  readonly finalScore: number; // 0.0 - 1.0
}

export interface RankedCandidate {
  readonly candidate: CandidateRecord;
  readonly features: CandidateRankingFeatures;
  readonly score: number;
  readonly tieBreaker: string; // profileId
}

export interface DiscoveryCursorPayload {
  readonly v: 1;
  readonly score: number;
  readonly id: string;
}
