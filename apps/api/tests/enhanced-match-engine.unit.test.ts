import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionsService } from '../src/modules/interactions/services/interactions.service.js';
import type { IInteractionsRepository } from '../src/modules/interactions/repositories/interactions.repository.interface.js';
import type { IMatchesRepository } from '../src/modules/matches/repositories/matches.repository.interface.js';
import type { IProfileRepository } from '../src/modules/profiles/repositories/profile.repository.js';
import type { IInterestRepository } from '../src/modules/profiles/repositories/interest.repository.js';
import type { SafetyEnforcementService } from '../src/modules/safety/services/safety-enforcement.service.js';
import type {
  DatabaseService,
  DrizzleDatabase,
} from '../src/infrastructure/database/database.service.js';

describe('Enhanced Match Engine Unit Tests', () => {
  let interactionsService: InteractionsService;
  let mockInteractionsRepo: Partial<IInteractionsRepository>;
  let mockMatchesRepo: Partial<IMatchesRepository>;
  let mockProfileRepo: Partial<IProfileRepository>;
  let mockInterestRepo: Partial<IInterestRepository>;
  let mockSafetyEnforcement: Partial<SafetyEnforcementService>;
  let mockDatabaseService: Partial<DatabaseService>;

  const actorUserId = '018f0000-0000-7000-8000-000000000001';
  const targetUserId = '018f0000-0000-7000-8000-000000000002';
  const targetProfileId = '018f0000-0000-7000-8000-000000000003';
  const actorProfileId = '018f0000-0000-7000-8000-000000000004';

  beforeEach(() => {
    mockInteractionsRepo = {
      findInteraction: vi.fn(),
      upsertInteraction: vi.fn().mockResolvedValue({
        id: 'interaction-1',
        actorUserId,
        targetUserId,
        type: 'LIKE',
        createdAt: new Date(),
      }),
    };

    mockMatchesRepo = {
      countActiveMatchesForUser: vi.fn().mockResolvedValue(0),
      createOrActivateMatchTx: vi.fn().mockImplementation((_tx, _a, _b, options) => {
        return Promise.resolve({
          match: {
            id: 'match-123',
            userAId: actorUserId < targetUserId ? actorUserId : targetUserId,
            userBId: actorUserId < targetUserId ? targetUserId : actorUserId,
            status: options?.status ?? 'ACTIVE',
            expiresAt: options?.expiresAt ?? null,
            matchedAt: new Date(),
          },
          wasCreated: true,
        });
      }),
    };

    mockProfileRepo = {
      findByUserId: vi.fn().mockImplementation((userId: string) => {
        if (userId === targetUserId) {
          return Promise.resolve({
            id: targetProfileId,
            userId: targetUserId,
            visibility: 'ACTIVE',
          });
        }
        if (userId === actorUserId) {
          return Promise.resolve({
            id: actorProfileId,
            userId: actorUserId,
            visibility: 'ACTIVE',
          });
        }
        return Promise.resolve(null);
      }),
      findById: vi.fn().mockResolvedValue(null),
    };

    mockInterestRepo = {
      findByProfileId: vi.fn().mockImplementation((profileId: string) => {
        if (profileId === actorProfileId) {
          return Promise.resolve([
            {
              id: '1',
              name: 'Bouldering',
              slug: 'bouldering',
              category: 'SPORTS',
              status: 'ACTIVE',
              createdAt: new Date(),
            },
            {
              id: '2',
              name: 'Indie Rock',
              slug: 'indie-rock',
              category: 'MUSIC',
              status: 'ACTIVE',
              createdAt: new Date(),
            },
          ]);
        }
        if (profileId === targetProfileId) {
          return Promise.resolve([
            {
              id: '1',
              name: 'Bouldering',
              slug: 'bouldering',
              category: 'SPORTS',
              status: 'ACTIVE',
              createdAt: new Date(),
            },
            {
              id: '3',
              name: 'Coffee',
              slug: 'coffee',
              category: 'FOOD',
              status: 'ACTIVE',
              createdAt: new Date(),
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    mockSafetyEnforcement = {
      assertCanInteract: vi.fn().mockResolvedValue(undefined),
    };

    const mockTx = {
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as DrizzleDatabase;

    mockDatabaseService = {
      withTransaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };

    const mockEntitlementService = { hasEntitlement: vi.fn().mockResolvedValue(false) };
    const mockStorageService = {
      getPublicUrl: vi.fn().mockReturnValue('https://example.com/photo.jpg'),
    };
    const mockSmartPhotosService = { recordCandidateLike: vi.fn() };

    interactionsService = new InteractionsService(
      mockInteractionsRepo as IInteractionsRepository,
      mockMatchesRepo as IMatchesRepository,
      mockProfileRepo as IProfileRepository,
      mockInterestRepo as IInterestRepository,
      mockSafetyEnforcement as SafetyEnforcementService,
      mockDatabaseService as DatabaseService,
      mockEntitlementService as any,
      mockStorageService as any,
      mockSmartPhotosService as any
    );
  });

  it('forms an ACTIVE match with 48-hour expiration and shared icebreakers when reciprocal like occurs and capacity allows', async () => {
    // Reciprocal like exists
    vi.mocked(mockInteractionsRepo.findInteraction!).mockImplementation((actor, target) => {
      if (actor === targetUserId && target === actorUserId) {
        return Promise.resolve({
          id: 'int-reciprocal',
          actorUserId: targetUserId,
          targetUserId: actorUserId,
          type: 'LIKE',
          createdAt: new Date(),
        } as any);
      }
      return Promise.resolve(null);
    });

    const res = await interactionsService.like(actorUserId, targetUserId);

    expect(res.matched).toBe(true);
    expect(res.matchId).toBe('match-123');
    expect(res.matchStatus).toBe('ACTIVE');
    expect(typeof res.expiresAt).toBe('string');
    // Expiration should be roughly 48 hours from now
    const expiresAt = new Date(res.expiresAt!);
    const diffHours = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(Math.round(diffHours)).toBe(48);

    // Mutual interest detected
    expect(res.sharedInterests).toEqual(['Bouldering']);
    expect(res.suggestedIcebreakers).toEqual(['Ask them about their passion for Bouldering!']);
  });

  it('enforces the Focus Cap by transitioning match into QUEUED state when a user has reached 5 active matches', async () => {
    // Reciprocal like exists
    vi.mocked(mockInteractionsRepo.findInteraction!).mockResolvedValue({
      id: 'int-reciprocal',
      actorUserId: targetUserId,
      targetUserId: actorUserId,
      type: 'LIKE',
      createdAt: new Date(),
    } as any);

    // Actor already has 5 active matches
    vi.mocked(mockMatchesRepo.countActiveMatchesForUser!).mockImplementation((userId) => {
      if (userId === actorUserId) return Promise.resolve(5);
      return Promise.resolve(0);
    });

    const res = await interactionsService.like(actorUserId, targetUserId);

    expect(res.matched).toBe(true);
    expect(res.matchStatus).toBe('QUEUED');
    expect(res.expiresAt).toBeNull();
  });

  it('generates fallback icebreakers when users have no mutual registered interests', async () => {
    vi.mocked(mockInteractionsRepo.findInteraction!).mockResolvedValue({
      id: 'int-reciprocal',
      actorUserId: targetUserId,
      targetUserId: actorUserId,
      type: 'LIKE',
      createdAt: new Date(),
    } as any);

    // No overlapping interests
    vi.mocked(mockInterestRepo.findByProfileId!).mockImplementation((profileId: string) => {
      if (profileId === actorProfileId) {
        return Promise.resolve([
          {
            id: '1',
            name: 'Chess',
            slug: 'chess',
            category: 'GAMES',
            status: 'ACTIVE',
            createdAt: new Date(),
          },
        ]);
      }
      return Promise.resolve([
        {
          id: '2',
          name: 'Scuba Diving',
          slug: 'scuba',
          category: 'SPORTS',
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      ]);
    });

    const res = await interactionsService.like(actorUserId, targetUserId);

    expect(res.matched).toBe(true);
    expect(res.sharedInterests).toBeUndefined();
    expect(res.suggestedIcebreakers).toEqual([
      'Say hi and ask what their favorite weekend activity is!',
      'Compliment one of their prompt answers to break the ice.',
    ]);
  });
});
