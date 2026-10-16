import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import {
  ErrorCode,
  type SmartPhotosStatsResponseDto,
  type SmartPhotoStatItemDto,
} from '@platform/api-contracts';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../repositories/profile.repository.js';
import { MEDIA_REPOSITORY_TOKEN, type IMediaRepository } from '../repositories/media.repository.js';
import { PhotoBanditRepository } from '../repositories/photo-bandit.repository.js';

@Injectable()
export class SmartPhotosService {
  private readonly logger = new Logger(SmartPhotosService.name);

  constructor(
    @Inject(PhotoBanditRepository)
    private readonly banditRepo: PhotoBanditRepository,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(MEDIA_REPOSITORY_TOKEN)
    private readonly mediaRepo: IMediaRepository,
    @Inject(S3StorageService)
    private readonly storageService: S3StorageService
  ) {}

  async toggleSmartPhotos(userId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    await this.profileRepo.update(profile.id, { smartPhotos: enabled });
    this.logger.log(`User ${userId} toggled Smart Photos to ${enabled}`);
    return { enabled };
  }

  async getStats(userId: string): Promise<SmartPhotosStatsResponseDto> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    const [mediaItems, banditStats] = await Promise.all([
      this.mediaRepo.findByProfileId(profile.id),
      this.banditRepo.findStatsByUserId(userId),
    ]);

    const activePhotos = mediaItems.filter((m) => m.status === 'READY' && m.mediaType === 'IMAGE');

    const statsMap = new Map(banditStats.map((s) => [s.mediaId, s]));

    const photoStats: SmartPhotoStatItemDto[] = activePhotos.map((photo) => {
      const stat = statsMap.get(photo.id);
      const impressions = stat?.impressions ?? 0;
      const likes = stat?.likes ?? 0;
      const conversionRate = impressions > 0 ? Number((likes / impressions).toFixed(4)) : 0;
      const ucbScore = stat?.score ?? 0;

      return {
        mediaId: photo.id,
        photoUrl: this.storageService.getPublicUrl(photo.objectKey),
        impressions,
        likes,
        conversionRate,
        ucbScore,
        isPrimary: photo.isPrimary,
      };
    });

    return {
      enabled: profile.smartPhotos ?? false,
      photos: photoStats,
    };
  }

  async recordImpression(userId: string, mediaId: string): Promise<void> {
    await this.banditRepo.recordImpression(userId, mediaId);
  }

  async recordCandidateImpression(userId: string, mediaId: string): Promise<void> {
    try {
      await this.recordImpression(userId, mediaId);
    } catch (err) {
      this.logger.warn(`Failed to record impression for user ${userId}, media ${mediaId}: ${err}`);
    }
  }

  async recordLike(userId: string, mediaId: string): Promise<void> {
    await this.banditRepo.recordLike(userId, mediaId);
    await this.evaluateAndOptimizePhotos(userId);
  }

  async recordCandidateLike(userId: string, mediaId?: string): Promise<void> {
    try {
      let targetMediaId = mediaId;
      if (!targetMediaId) {
        const profile = await this.profileRepo.findByUserId(userId);
        if (profile) {
          const media = await this.mediaRepo.findByProfileId(profile.id);
          const primary = media.find((m) => m.isPrimary && m.status === 'READY') || media[0];
          targetMediaId = primary?.id;
        }
      }
      if (targetMediaId) {
        await this.recordLike(userId, targetMediaId);
      }
    } catch (err) {
      this.logger.warn(`Failed to record candidate like for user ${userId}: ${err}`);
    }
  }

  /**
   * Upper Confidence Bound (UCB1) Multi-Armed Bandit calculation
   */
  async evaluateAndOptimizePhotos(userId: string): Promise<void> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile || !profile.smartPhotos) {
      return; // Smart photos is not enabled
    }

    const [mediaItems, banditStats] = await Promise.all([
      this.mediaRepo.findByProfileId(profile.id),
      this.banditRepo.findStatsByUserId(userId),
    ]);

    const activePhotos = mediaItems.filter((m) => m.status === 'READY' && m.mediaType === 'IMAGE');

    if (activePhotos.length < 2) {
      return; // Need at least 2 photos to optimize
    }

    const statsMap = new Map(banditStats.map((s) => [s.mediaId, s]));
    let totalImpressions = 0;

    for (const photo of activePhotos) {
      const stat = statsMap.get(photo.id);
      totalImpressions += stat?.impressions ?? 0;
    }

    const c = 1.414; // Exploration parameter sqrt(2)
    const scores: { mediaId: string; score: number; isPrimary: boolean }[] = [];

    for (const photo of activePhotos) {
      const stat = statsMap.get(photo.id);
      const ni = stat?.impressions ?? 0;
      const si = stat?.likes ?? 0;

      let ucbScore: number;
      if (ni === 0) {
        // High optimism in the face of uncertainty: unvisited photo gets high bonus
        ucbScore = 5.0;
      } else {
        const exploitation = si / ni;
        const exploration = c * Math.sqrt(Math.log(totalImpressions + 1) / ni);
        ucbScore = Number((exploitation + exploration).toFixed(4));
      }

      await this.banditRepo.updateScore(photo.id, ucbScore);
      scores.push({ mediaId: photo.id, score: ucbScore, isPrimary: photo.isPrimary });
    }

    // Sort by UCB score descending
    scores.sort((a, b) => b.score - a.score);

    const bestPhoto = scores[0];
    if (bestPhoto && !bestPhoto.isPrimary) {
      this.logger.log(
        `[Smart Photos] Promoting mediaId=${bestPhoto.mediaId} to primary for user=${userId} with UCB=${bestPhoto.score}`
      );
      await this.mediaRepo.setPrimary(profile.id, bestPhoto.mediaId);
    }
  }
}
