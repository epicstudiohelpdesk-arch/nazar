import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  ProfileEventType,
  type MediaUploadRequestPayload,
  type MediaUploadResponse,
  type MediaItemResponse,
} from '@platform/api-contracts';
import { calculateProfileCompleteness } from '@platform/validation';
import { AppConfigService } from '../../../config/app-config.service.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  outboxEvents,
  auditLogs,
  type ProfileMediaRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../repositories/profile.repository.js';
import { MEDIA_REPOSITORY_TOKEN, type IMediaRepository } from '../repositories/media.repository.js';
import {
  PREFERENCES_REPOSITORY_TOKEN,
  type IPreferencesRepository,
} from '../repositories/preferences.repository.js';
import {
  INTEREST_REPOSITORY_TOKEN,
  type IInterestRepository,
} from '../repositories/interest.repository.js';
import {
  PROMPT_REPOSITORY_TOKEN,
  type IPromptRepository,
} from '../repositories/prompt.repository.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';

@Injectable()
export class MediaService {
  constructor(
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(MEDIA_REPOSITORY_TOKEN)
    private readonly mediaRepo: IMediaRepository,
    @Inject(PREFERENCES_REPOSITORY_TOKEN)
    private readonly preferencesRepo: IPreferencesRepository,
    @Inject(INTEREST_REPOSITORY_TOKEN)
    private readonly interestRepo: IInterestRepository,
    @Inject(PROMPT_REPOSITORY_TOKEN)
    private readonly promptRepo: IPromptRepository,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService,
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async requestUpload(
    userId: string,
    payload: MediaUploadRequestPayload,
    ipAddress?: string
  ): Promise<MediaUploadResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found. Create a profile before uploading media.',
      });
    }

    const currentCount = await this.mediaRepo.countActiveByProfileId(profile.id);
    if (currentCount >= this.configService.mediaMaxPhotos) {
      throw new BadRequestException({
        code: ErrorCode.MEDIA_LIMIT_REACHED,
        message: `Maximum of ${this.configService.mediaMaxPhotos} photos allowed per profile`,
      });
    }

    if (payload.sizeBytes > this.configService.mediaMaxBytes) {
      throw new BadRequestException({
        code: ErrorCode.MEDIA_TOO_LARGE,
        message: `File size exceeds maximum limit of ${this.configService.mediaMaxBytes / (1024 * 1024)}MB`,
      });
    }

    const mediaId = generateUuidV7();
    const objectKey = `profiles/${userId}/${mediaId}/original`;
    const bucket = this.configService.s3BucketName;
    const expirySeconds = this.configService.mediaUploadExpirySeconds;

    const presigned = await this.storageService.createPresignedUploadUrl(
      bucket,
      objectKey,
      payload.mimeType,
      expirySeconds
    );

    const isPrimary = currentCount === 0;

    await this.databaseService.withTransaction(async (tx) => {
      await this.mediaRepo.create(
        {
          id: mediaId,
          userId,
          profileId: profile.id,
          objectKey,
          mediaType: 'IMAGE',
          mimeType: payload.mimeType,
          status: 'PENDING',
          sizeBytes: payload.sizeBytes,
          position: currentCount,
          isPrimary,
          expiresAt: new Date(Date.now() + expirySeconds * 1000),
        },
        tx
      );

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_MEDIA_ADDED,
        aggregateType: 'profile_media',
        aggregateId: mediaId,
        payload: { userId, profileId: profile.id, mediaId, objectKey },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'MEDIA_UPLOAD_REQUESTED',
        resourceType: 'profile_media',
        resourceId: mediaId,
        actorUserId: userId,
        ipAddress,
        metadata: { mimeType: payload.mimeType, sizeBytes: payload.sizeBytes },
      });
    });

    return {
      mediaId,
      uploadUrl: presigned.uploadUrl,
      storageKey: objectKey,
      expiresAt: presigned.expiresAt,
    };
  }

  async completeUpload(
    userId: string,
    mediaId: string,
    ipAddress?: string
  ): Promise<MediaItemResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    const media = await this.mediaRepo.findById(mediaId);
    if (!media || media.status === 'DELETED') {
      throw new NotFoundException({
        code: ErrorCode.MEDIA_NOT_FOUND,
        message: 'Media record not found',
      });
    }

    if (media.userId !== userId || media.profileId !== profile.id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have permission to manage this media',
      });
    }

    if (media.expiresAt && media.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: ErrorCode.MEDIA_UPLOAD_EXPIRED,
        message: 'Media upload authorization has expired. Please request a new upload URL.',
      });
    }

    if (media.status === 'READY') {
      return this.mapMediaItemResponse(media);
    }

    const updated = await this.databaseService.withTransaction(async (tx) => {
      const row = await this.mediaRepo.updateStatus(mediaId, 'READY', tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_MEDIA_READY,
        aggregateType: 'profile_media',
        aggregateId: mediaId,
        payload: { userId, profileId: profile.id, mediaId },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'MEDIA_UPLOAD_COMPLETED',
        resourceType: 'profile_media',
        resourceId: mediaId,
        actorUserId: userId,
        ipAddress,
        metadata: { objectKey: media.objectKey },
      });

      // Recalculate profile completeness
      await this.recalculateCompletenessInternal(profile.id, userId, tx);

      return row;
    });

    return this.mapMediaItemResponse(updated);
  }

  async listMedia(userId: string): Promise<MediaItemResponse[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return [];

    const rows = await this.mediaRepo.findByProfileId(profile.id);
    return rows.map((r) => this.mapMediaItemResponse(r));
  }

  async reorderMedia(
    userId: string,
    mediaIds: readonly string[],
    ipAddress?: string
  ): Promise<MediaItemResponse[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    const existingMedia = await this.mediaRepo.findByProfileId(profile.id);
    const existingIds = new Set(existingMedia.map((m) => m.id));

    for (const id of mediaIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException({
          code: ErrorCode.MEDIA_NOT_FOUND,
          message: `Media ID ${id} does not belong to your profile`,
        });
      }
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.mediaRepo.reorder(profile.id, mediaIds, tx);

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'MEDIA_REORDERED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { count: mediaIds.length },
      });
    });

    const updated = await this.mediaRepo.findByProfileId(profile.id);
    return updated.map((r) => this.mapMediaItemResponse(r));
  }

  async setPrimary(
    userId: string,
    mediaId: string,
    ipAddress?: string
  ): Promise<MediaItemResponse[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    const media = await this.mediaRepo.findById(mediaId);
    if (!media || media.status === 'DELETED') {
      throw new NotFoundException({
        code: ErrorCode.MEDIA_NOT_FOUND,
        message: 'Media not found',
      });
    }

    if (media.userId !== userId || media.profileId !== profile.id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not own this media item',
      });
    }

    if (media.status !== 'READY') {
      throw new BadRequestException({
        code: ErrorCode.MEDIA_NOT_READY,
        message:
          'Cannot set primary photo until upload processing is complete (READY status required)',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.mediaRepo.setPrimary(profile.id, mediaId, tx);

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PRIMARY_PHOTO_UPDATED',
        resourceType: 'profile_media',
        resourceId: mediaId,
        actorUserId: userId,
        ipAddress,
        metadata: { primaryMediaId: mediaId },
      });

      await this.recalculateCompletenessInternal(profile.id, userId, tx);
    });

    const updated = await this.mediaRepo.findByProfileId(profile.id);
    return updated.map((r) => this.mapMediaItemResponse(r));
  }

  async deleteMedia(
    userId: string,
    mediaId: string,
    ipAddress?: string
  ): Promise<{ message: string }> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    const media = await this.mediaRepo.findById(mediaId);
    if (!media || media.status === 'DELETED') {
      throw new NotFoundException({
        code: ErrorCode.MEDIA_NOT_FOUND,
        message: 'Media not found',
      });
    }

    if (media.userId !== userId || media.profileId !== profile.id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not own this media item',
      });
    }

    const activePhotos = await this.mediaRepo.findByProfileId(profile.id);
    const readyPhotos = activePhotos.filter((m) => m.status === 'READY');

    // Rule: Cannot delete last required photo while profile is ACTIVE
    if (profile.visibility === 'ACTIVE' && readyPhotos.length <= 1 && media.status === 'READY') {
      throw new BadRequestException({
        code: ErrorCode.PRIMARY_MEDIA_REQUIRED,
        message:
          'Cannot delete the only photo while your profile is ACTIVE. Pause or hide your profile first, or upload another photo.',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.mediaRepo.delete(mediaId, tx);

      // If deleted photo was primary, elect another ready photo if one exists
      if (media.isPrimary) {
        const remainingReady = activePhotos.filter((m) => m.id !== mediaId && m.status === 'READY');
        if (remainingReady.length > 0 && remainingReady[0]) {
          await this.mediaRepo.setPrimary(profile.id, remainingReady[0].id, tx);
        }
      }

      await this.mediaRepo.normalizePositions(profile.id, tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_MEDIA_DELETED,
        aggregateType: 'profile_media',
        aggregateId: mediaId,
        payload: { userId, profileId: profile.id, mediaId, objectKey: media.objectKey },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'MEDIA_DELETED',
        resourceType: 'profile_media',
        resourceId: mediaId,
        actorUserId: userId,
        ipAddress,
        metadata: { objectKey: media.objectKey },
      });

      await this.recalculateCompletenessInternal(profile.id, userId, tx);
    });

    // Delete object asynchronously from storage
    try {
      await this.storageService.deleteObject(this.configService.s3BucketName, media.objectKey);
    } catch {
      // Non-fatal if object was already removed
    }

    return { message: 'Media successfully deleted' };
  }

  // ----------------------------------------------------
  // Helpers
  // ----------------------------------------------------

  private mapMediaItemResponse(m: ProfileMediaRow): MediaItemResponse {
    return {
      id: m.id,
      url: this.storageService.getPublicUrl(m.objectKey),
      mediaType: m.mediaType as any,
      mimeType: m.mimeType,
      status: m.status as any,
      position: m.position,
      isPrimary: m.isPrimary,
      width: m.width,
      height: m.height,
      sizeBytes: m.sizeBytes,
      createdAt: m.createdAt.toISOString(),
    };
  }

  private async recalculateCompletenessInternal(
    profileId: string,
    userId: string,
    tx?: any
  ): Promise<void> {
    const profile = await this.profileRepo.findById(profileId, tx);
    if (!profile) return;

    const [preferences, media, interests, prompts] = await Promise.all([
      this.preferencesRepo.findByUserId(userId, tx),
      this.mediaRepo.findByProfileId(profileId, tx),
      this.interestRepo.findByProfileId(profileId, tx),
      this.promptRepo.findByProfileId(profileId, tx),
    ]);

    const readyMedia = media.filter((m) => m.status === 'READY');
    const hasPrimaryPhoto = readyMedia.some((m) => m.isPrimary);

    const completeness = calculateProfileCompleteness({
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender as any,
      hasPrimaryPhoto,
      hasPreferences: !!preferences,
      bio: profile.bio,
      interestsCount: interests.length,
      occupation: profile.occupation,
      education: profile.education,
      promptsCount: prompts.length,
      readyPhotosCount: readyMedia.length,
    });

    await this.profileRepo.updateCompletionStatus(profileId, completeness, tx);
  }
}
