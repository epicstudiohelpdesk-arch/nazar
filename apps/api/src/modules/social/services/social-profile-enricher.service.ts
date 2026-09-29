import { Injectable, Inject } from '@nestjs/common';
import { inArray, and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { profiles } from '../../../infrastructure/database/drizzle/schema/profiles.js';
import { profileMedia } from '../../../infrastructure/database/drizzle/schema/profile-media.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';
import type { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import type { SocialAuthorDto } from '@platform/api-contracts';

@Injectable()
export class SocialProfileEnricherService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService
  ) {}

  /**
   * Batch hydrate author/user profile information for social entities.
   * Single query joins profiles and primary profile media, eliminating N+1 queries.
   */
  async getAuthorMap(userIds: readonly string[]): Promise<Map<string, SocialAuthorDto>> {
    const authorMap = new Map<string, SocialAuthorDto>();
    const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);

    if (uniqueIds.length === 0) {
      return authorMap;
    }

    const rows = await this.databaseService.client
      .select({
        userId: profiles.userId,
        displayName: profiles.displayName,
        bio: profiles.bio,
        mediaKey: profileMedia.objectKey,
      })
      .from(profiles)
      .leftJoin(
        profileMedia,
        and(
          eq(profileMedia.profileId, profiles.id),
          eq(profileMedia.isPrimary, true),
          eq(profileMedia.status, 'READY')
        )
      )
      .where(inArray(profiles.userId, uniqueIds));

    for (const row of rows) {
      authorMap.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName || 'Nazar User',
        avatarUrl: row.mediaKey ? this.storageService.getPublicUrl(row.mediaKey) : null,
        bio: row.bio || null,
      });
    }

    // Fallback for any user ID without an explicit profile row
    for (const uid of uniqueIds) {
      if (!authorMap.has(uid)) {
        authorMap.set(uid, {
          userId: uid,
          displayName: 'Nazar User',
          avatarUrl: null,
          bio: null,
        });
      }
    }

    return authorMap;
  }

  async getAuthor(userId: string): Promise<SocialAuthorDto> {
    const map = await this.getAuthorMap([userId]);
    return (
      map.get(userId) || {
        userId,
        displayName: 'Nazar User',
        avatarUrl: null,
        bio: null,
      }
    );
  }
}
