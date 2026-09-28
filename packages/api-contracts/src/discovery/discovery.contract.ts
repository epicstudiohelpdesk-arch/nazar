import type { PublicProfileResponse } from '../profile/profile.contract.js';

export type DistanceBucket = '< 1 km' | '1-5 km' | '5-10 km' | '10-25 km' | '25-50 km' | '50+ km';

export interface DiscoveryItemDto {
  readonly profile: PublicProfileResponse;
  readonly distanceBucket?: DistanceBucket | null;
}

export interface DiscoveryPagination {
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface DiscoveryResponseDto {
  readonly items: readonly DiscoveryItemDto[];
  readonly pagination: DiscoveryPagination;
}

export interface DiscoveryQueryDto {
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Maps raw distance in meters to a privacy-preserving presentation distance bucket.
 * Exact coordinates or raw meter distances are never exposed to clients.
 */
export function getDistanceBucket(
  distanceMeters: number | null | undefined
): DistanceBucket | null {
  if (
    distanceMeters === null ||
    distanceMeters === undefined ||
    Number.isNaN(distanceMeters) ||
    distanceMeters < 0
  ) {
    return null;
  }

  const distanceKm = distanceMeters / 1000;
  if (distanceKm < 1) {
    return '< 1 km';
  }
  if (distanceKm <= 5) {
    return '1-5 km';
  }
  if (distanceKm <= 10) {
    return '5-10 km';
  }
  if (distanceKm <= 25) {
    return '10-25 km';
  }
  if (distanceKm <= 50) {
    return '25-50 km';
  }
  return '50+ km';
}
