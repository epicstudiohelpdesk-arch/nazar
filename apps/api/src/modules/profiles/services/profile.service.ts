import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  ProfileEventType,
  type ProfileCompleteness,
  type CreateProfilePayload,
  type UpdateProfilePayload,
  type PreferencesResponse,
  type UpdatePreferencesPayload,
  type InterestItem,
  type ProfilePromptItem,
  type PromptAnswerInput,
  type ProfileAudioPromptResponse,
  type CreateAudioPromptRequest,
  type PrivateProfileResponse,
  type PublicProfileResponse,
  type MediaItemResponse,
  type ProfileStateChangeResponse,
  type SetPassportLocationRequestDto,
  type PassportLocationResponseDto,
  type ShareableProfileCardDto,
} from '@platform/api-contracts';
import { calculateAge, calculateProfileCompleteness } from '@platform/validation';
import { eq, and, isNull, gt, asc } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  outboxEvents,
  auditLogs,
  events,
  eventRsvps,
  type ProfileRow,
  type ProfilePreferencesRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../repositories/profile.repository.js';
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
import { MEDIA_REPOSITORY_TOKEN, type IMediaRepository } from '../repositories/media.repository.js';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(PREFERENCES_REPOSITORY_TOKEN)
    private readonly preferencesRepo: IPreferencesRepository,
    @Inject(INTEREST_REPOSITORY_TOKEN)
    private readonly interestRepo: IInterestRepository,
    @Inject(PROMPT_REPOSITORY_TOKEN)
    private readonly promptRepo: IPromptRepository,
    @Inject(MEDIA_REPOSITORY_TOKEN)
    private readonly mediaRepo: IMediaRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService
  ) {}

  // ----------------------------------------------------
  // Profile CRUD & Retrieval
  // ----------------------------------------------------

  async getPrivateProfile(userId: string): Promise<PrivateProfileResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Dating profile not found for this account',
      });
    }

    return this.buildPrivateProfileResponse(profile);
  }

  async createOrUpdateProfile(
    userId: string,
    payload: CreateProfilePayload | UpdateProfilePayload,
    ipAddress?: string
  ): Promise<PrivateProfileResponse> {
    const existing = await this.profileRepo.findByUserId(userId);

    if (!existing) {
      // Creation requires displayName, dateOfBirth, gender
      if (!payload.displayName || !payload.dateOfBirth || !payload.gender) {
        throw new BadRequestException({
          code: ErrorCode.PROFILE_FIELD_INVALID,
          message: 'Display name, date of birth, and gender are required to initialize a profile',
        });
      }

      const profileId = generateUuidV7();
      const initialCompleteness = calculateProfileCompleteness({
        displayName: payload.displayName,
        dateOfBirth: payload.dateOfBirth,
        gender: payload.gender,
        hasPrimaryPhoto: false,
        hasPreferences: false,
        bio: payload.bio,
        interestsCount: 0,
        occupation: payload.occupation,
        education: payload.education,
        promptsCount: 0,
        readyPhotosCount: 0,
      });

      const created = await this.databaseService.withTransaction(async (tx) => {
        const row = await this.profileRepo.create(
          {
            id: profileId,
            userId,
            displayName: payload.displayName!,
            dateOfBirth: payload.dateOfBirth!,
            gender: payload.gender!,
            bio: payload.bio,
            occupation: payload.occupation,
            education: payload.education,
            city: payload.city,
            countryCode: payload.countryCode,
            latitude: payload.location?.latitude,
            longitude: payload.location?.longitude,
            relationshipIntent: payload.relationshipIntent || 'LONG_TERM',
            familyPlans: payload.familyPlans || null,
            incognitoMode: payload.incognitoMode ?? false,
            smartPhotos: payload.smartPhotos ?? true,
            travelMode: payload.travelMode ?? false,
            travelLatitude: payload.travelLatitude ?? null,
            travelLongitude: payload.travelLongitude ?? null,
            travelCity: payload.travelCity ?? null,
            travelCountry: payload.travelCountry ?? null,
            visibility: 'DRAFT',
            completionStatus: initialCompleteness,
          },
          tx
        );

        if (payload.location) {
          await this.profileRepo.updateLocation(
            profileId,
            payload.location.latitude,
            payload.location.longitude,
            tx
          );
        }

        // Outbox event
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: ProfileEventType.PROFILE_CREATED,
          aggregateType: 'profile',
          aggregateId: profileId,
          payload: { userId, profileId },
          status: 'PENDING',
        });

        // Audit log
        await tx.insert(auditLogs).values({
          id: generateUuidV7(),
          action: 'PROFILE_CREATED',
          resourceType: 'profile',
          resourceId: profileId,
          actorUserId: userId,
          ipAddress,
          metadata: { visibility: 'DRAFT' },
        });

        return row;
      });

      return this.buildPrivateProfileResponse(created);
    }

    // Update existing profile
    const updated = await this.databaseService.withTransaction(async (tx) => {
      const updateData: Partial<ProfileRow> = {};
      if (payload.displayName !== undefined) updateData.displayName = payload.displayName;
      if (payload.dateOfBirth !== undefined) updateData.dateOfBirth = payload.dateOfBirth;
      if (payload.gender !== undefined) updateData.gender = payload.gender;
      if (payload.bio !== undefined) updateData.bio = payload.bio;
      if (payload.occupation !== undefined) updateData.occupation = payload.occupation;
      if (payload.education !== undefined) updateData.education = payload.education;
      if (payload.city !== undefined) updateData.city = payload.city;
      if (payload.countryCode !== undefined) updateData.countryCode = payload.countryCode;
      if (payload.relationshipIntent !== undefined)
        updateData.relationshipIntent = payload.relationshipIntent;
      if (payload.familyPlans !== undefined) updateData.familyPlans = payload.familyPlans;
      if (payload.incognitoMode !== undefined && payload.incognitoMode !== null)
        updateData.incognitoMode = payload.incognitoMode;
      if (payload.smartPhotos !== undefined && payload.smartPhotos !== null)
        updateData.smartPhotos = payload.smartPhotos;
      if (payload.travelMode !== undefined && payload.travelMode !== null)
        updateData.travelMode = payload.travelMode;
      if (payload.travelLatitude !== undefined) updateData.travelLatitude = payload.travelLatitude;
      if (payload.travelLongitude !== undefined)
        updateData.travelLongitude = payload.travelLongitude;
      if (payload.travelCity !== undefined) updateData.travelCity = payload.travelCity;
      if (payload.travelCountry !== undefined) updateData.travelCountry = payload.travelCountry;

      let row = await this.profileRepo.update(existing.id, updateData, tx);

      if (payload.location !== undefined) {
        if (payload.location) {
          await this.profileRepo.updateLocation(
            existing.id,
            payload.location.latitude,
            payload.location.longitude,
            tx
          );
        } else {
          await this.profileRepo.update(existing.id, { latitude: null, longitude: null }, tx);
        }
        row = (await this.profileRepo.findById(existing.id, tx))!;
      }

      // Recalculate completeness
      await this.recalculateCompletenessInternal(row, tx);
      const refreshed = (await this.profileRepo.findById(existing.id, tx))!;

      // Outbox event
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_UPDATED,
        aggregateType: 'profile',
        aggregateId: existing.id,
        payload: { userId, profileId: existing.id },
        status: 'PENDING',
      });

      // Audit log
      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PROFILE_UPDATED',
        resourceType: 'profile',
        resourceId: existing.id,
        actorUserId: userId,
        ipAddress,
        metadata: { updatedFields: Object.keys(updateData) },
      });

      return refreshed;
    });

    return this.buildPrivateProfileResponse(updated);
  }

  // ----------------------------------------------------
  // Profile Lifecycle & State Machine
  // ----------------------------------------------------

  async activateProfile(userId: string, ipAddress?: string): Promise<ProfileStateChangeResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    if (profile.visibility === 'ACTIVE') {
      return {
        id: profile.id,
        visibility: 'ACTIVE',
        message: 'Profile is already active',
      };
    }

    // Verify completeness before activation
    const completeness = await this.recalculateCompletenessInternal(profile);
    if (completeness.missingRequired.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_INCOMPLETE,
        message: `Profile cannot be activated. Missing required fields: ${completeness.missingRequired.join(', ')}`,
        details: completeness.missingRequired.map((field) => ({
          field,
          message: `${field} is required before activating profile`,
        })),
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.profileRepo.updateVisibility(profile.id, 'ACTIVE', tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_ACTIVATED,
        aggregateType: 'profile',
        aggregateId: profile.id,
        payload: { userId, profileId: profile.id },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PROFILE_ACTIVATED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { fromState: profile.visibility, toState: 'ACTIVE' },
      });
    });

    return {
      id: profile.id,
      visibility: 'ACTIVE',
      message: 'Profile successfully activated and visible in discovery',
    };
  }

  async pauseProfile(userId: string, ipAddress?: string): Promise<ProfileStateChangeResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    if (profile.visibility === 'DRAFT') {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_STATE_INVALID,
        message: 'Cannot pause an unactivated draft profile. Activate the profile first.',
      });
    }

    if (profile.visibility === 'PAUSED') {
      return {
        id: profile.id,
        visibility: 'PAUSED',
        message: 'Profile is already paused',
      };
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.profileRepo.updateVisibility(profile.id, 'PAUSED', tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_PAUSED,
        aggregateType: 'profile',
        aggregateId: profile.id,
        payload: { userId, profileId: profile.id },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PROFILE_PAUSED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { fromState: profile.visibility, toState: 'PAUSED' },
      });
    });

    return {
      id: profile.id,
      visibility: 'PAUSED',
      message: 'Profile paused. You will not appear in discovery until resumed.',
    };
  }

  async hideProfile(userId: string, ipAddress?: string): Promise<ProfileStateChangeResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found',
      });
    }

    if (profile.visibility === 'DRAFT') {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_STATE_INVALID,
        message: 'Cannot hide an unactivated draft profile.',
      });
    }

    if (profile.visibility === 'HIDDEN') {
      return {
        id: profile.id,
        visibility: 'HIDDEN',
        message: 'Profile is already hidden',
      };
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.profileRepo.updateVisibility(profile.id, 'HIDDEN', tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_HIDDEN,
        aggregateType: 'profile',
        aggregateId: profile.id,
        payload: { userId, profileId: profile.id },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PROFILE_HIDDEN',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { fromState: profile.visibility, toState: 'HIDDEN' },
      });
    });

    return {
      id: profile.id,
      visibility: 'HIDDEN',
      message: 'Profile hidden from all social discovery feeds.',
    };
  }

  // ----------------------------------------------------
  // Preferences Management
  // ----------------------------------------------------

  async getPreferences(userId: string): Promise<PreferencesResponse> {
    const prefs = await this.preferencesRepo.findByUserId(userId);
    if (!prefs) {
      // Default preferences
      return {
        id: '',
        userId,
        minAge: 18,
        maxAge: 99,
        genderPreferences: ['WOMAN', 'MAN', 'NON_BINARY', 'OTHER'],
        maxDistanceKm: 50,
        relationshipIntent: 'LONG_TERM',
        updatedAt: new Date().toISOString(),
      };
    }

    return this.mapPreferencesResponse(prefs);
  }

  async updatePreferences(
    userId: string,
    payload: UpdatePreferencesPayload,
    ipAddress?: string
  ): Promise<PreferencesResponse> {
    const updated = await this.databaseService.withTransaction(async (tx) => {
      const prefs = await this.preferencesRepo.upsert(userId, payload as any, tx);

      // Trigger profile completeness update if profile exists
      const profile = await this.profileRepo.findByUserId(userId, tx);
      if (profile) {
        await this.recalculateCompletenessInternal(profile, tx);
      }

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: ProfileEventType.PROFILE_PREFERENCES_UPDATED,
        aggregateType: 'profile_preferences',
        aggregateId: prefs.id,
        payload: { userId },
        status: 'PENDING',
      });

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PREFERENCES_UPDATED',
        resourceType: 'profile_preferences',
        resourceId: prefs.id,
        actorUserId: userId,
        ipAddress,
        metadata: { updatedFields: Object.keys(payload) },
      });

      return prefs;
    });

    return this.mapPreferencesResponse(updated);
  }

  // ----------------------------------------------------
  // Interests Management
  // ----------------------------------------------------

  async getProfileInterests(userId: string): Promise<InterestItem[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return [];
    const rows = await this.interestRepo.findByProfileId(profile.id);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
    }));
  }

  async updateProfileInterests(
    userId: string,
    interestIds: readonly string[],
    ipAddress?: string
  ): Promise<InterestItem[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found. Create a profile before selecting interests.',
      });
    }

    // Validate that all specified interest IDs exist
    if (interestIds.length > 0) {
      const existing = await this.interestRepo.findByIds([...interestIds]);
      if (existing.length !== interestIds.length) {
        throw new NotFoundException({
          code: ErrorCode.INTEREST_NOT_FOUND,
          message: 'One or more selected interest IDs do not exist in the taxonomy',
        });
      }
    }

    const updated = await this.databaseService.withTransaction(async (tx) => {
      const items = await this.interestRepo.replaceProfileInterests(
        profile.id,
        [...interestIds],
        tx
      );
      await this.recalculateCompletenessInternal(profile, tx);

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'INTERESTS_UPDATED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { count: interestIds.length },
      });

      return items;
    });

    return updated.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
    }));
  }

  // ----------------------------------------------------
  // Prompts Management
  // ----------------------------------------------------

  async getProfilePrompts(userId: string): Promise<ProfilePromptItem[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return [];
    return this.promptRepo.findByProfileId(profile.id);
  }

  async updateProfilePrompts(
    userId: string,
    prompts: readonly PromptAnswerInput[],
    ipAddress?: string
  ): Promise<ProfilePromptItem[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found. Create a profile before answering prompts.',
      });
    }

    if (prompts.length > 0) {
      const defIds = prompts.map((p) => p.promptDefinitionId);
      const existingDefs = await this.promptRepo.findDefinitionByIds(defIds);
      if (existingDefs.length !== defIds.length) {
        throw new NotFoundException({
          code: ErrorCode.PROMPT_NOT_FOUND,
          message: 'One or more prompt definitions do not exist',
        });
      }
    }

    const updated = await this.databaseService.withTransaction(async (tx) => {
      const items = await this.promptRepo.replaceProfilePrompts(profile.id, prompts, tx);
      await this.recalculateCompletenessInternal(profile, tx);

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PROMPTS_UPDATED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { count: prompts.length },
      });

      return items;
    });

    return updated;
  }

  // ----------------------------------------------------
  // Audio Prompts Management (Feature 1.2)
  // ----------------------------------------------------

  async getProfileAudioPrompts(userId: string): Promise<ProfileAudioPromptResponse[]> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return [];
    return this.promptRepo.findAudioPromptsByProfileId(profile.id);
  }

  async createProfileAudioPrompt(
    userId: string,
    input: CreateAudioPromptRequest,
    ipAddress?: string
  ): Promise<ProfileAudioPromptResponse> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found. Create a profile before recording audio prompts.',
      });
    }

    const defs = await this.promptRepo.findDefinitionByIds([input.promptDefinitionId]);
    if (defs.length === 0) {
      throw new NotFoundException({
        code: ErrorCode.PROMPT_NOT_FOUND,
        message: 'Prompt definition does not exist',
      });
    }

    return this.databaseService.withTransaction(async (tx) => {
      const created = await this.promptRepo.createAudioPrompt(profile.id, input, tx);

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'AUDIO_PROMPT_CREATED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { audioPromptId: created.id, promptDefinitionId: input.promptDefinitionId },
      });

      return created;
    });
  }

  async deleteProfileAudioPrompt(
    userId: string,
    audioPromptId: string,
    ipAddress?: string
  ): Promise<void> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found.',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      const deleted = await this.promptRepo.deleteAudioPrompt(profile.id, audioPromptId, tx);
      if (!deleted) {
        throw new NotFoundException({
          code: ErrorCode.PROMPT_NOT_FOUND,
          message: 'Audio prompt not found or does not belong to you',
        });
      }

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'AUDIO_PROMPT_DELETED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: { audioPromptId },
      });
    });
  }

  // ----------------------------------------------------
  // Passport & Travel Mode (Feature 3.3)
  // ----------------------------------------------------

  async setPassportLocation(
    userId: string,
    input: SetPassportLocationRequestDto,
    ipAddress?: string
  ): Promise<PassportLocationResponseDto> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found. Create a profile before configuring Passport.',
      });
    }

    const updateData: Partial<ProfileRow> = {
      travelMode: input.enabled,
      travelLatitude: input.enabled ? (input.latitude ?? null) : null,
      travelLongitude: input.enabled ? (input.longitude ?? null) : null,
      travelCity: input.enabled ? (input.city ?? null) : null,
      travelCountry: input.enabled ? (input.country ?? null) : null,
    };

    await this.databaseService.withTransaction(async (tx) => {
      await this.profileRepo.update(profile.id, updateData, tx);

      await tx.insert(auditLogs).values({
        id: generateUuidV7(),
        action: 'PASSPORT_LOCATION_UPDATED',
        resourceType: 'profile',
        resourceId: profile.id,
        actorUserId: userId,
        ipAddress,
        metadata: {
          enabled: input.enabled,
          travelCity: input.city,
          travelCountry: input.country,
        },
      });
    });

    return {
      enabled: input.enabled,
      latitude: input.enabled ? (input.latitude ?? null) : null,
      longitude: input.enabled ? (input.longitude ?? null) : null,
      city: input.enabled ? (input.city ?? null) : null,
      country: input.enabled ? (input.country ?? null) : null,
    };
  }

  async getPassportLocation(userId: string): Promise<PassportLocationResponseDto> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found.',
      });
    }

    return {
      enabled: profile.travelMode ?? false,
      latitude: profile.travelLatitude ?? null,
      longitude: profile.travelLongitude ?? null,
      city: profile.travelCity ?? null,
      country: profile.travelCountry ?? null,
    };
  }

  // ----------------------------------------------------
  // Public Profile Presentation (Sanitized)
  // ----------------------------------------------------

  async getPublicProfile(profileId: string): Promise<PublicProfileResponse> {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile || profile.visibility !== 'ACTIVE') {
      throw new NotFoundException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Profile not found or not currently active',
      });
    }

    const [interests, prompts, audioPrompts, media] = await Promise.all([
      this.interestRepo.findByProfileId(profile.id),
      this.promptRepo.findByProfileId(profile.id),
      this.promptRepo.findAudioPromptsByProfileId(profile.id),
      this.mediaRepo.findByProfileId(profile.id),
    ]);

    const readyMedia = media
      .filter((m) => m.status === 'READY')
      .map((m) => ({
        id: m.id,
        url: this.storageService.getPublicUrl(m.objectKey),
        position: m.position,
        isPrimary: m.isPrimary,
      }));

    const age = calculateAge(profile.dateOfBirth);

    const [plusOneRow] = await this.databaseService.client
      .select({
        eventId: events.id,
        eventTitle: events.title,
        eventDate: events.startAt,
        note: eventRsvps.plusOneNote,
      })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(
        and(
          eq(eventRsvps.userId, profile.userId),
          eq(eventRsvps.status, 'GOING'),
          eq(eventRsvps.lookingForPlusOne, true),
          eq(events.status, 'PUBLISHED'),
          isNull(events.deletedAt),
          gt(events.endAt, new Date())
        )
      )
      .orderBy(asc(events.startAt))
      .limit(1);

    const eventPlusOne = plusOneRow
      ? {
          eventId: plusOneRow.eventId,
          eventTitle: plusOneRow.eventTitle,
          eventDate: plusOneRow.eventDate.toISOString(),
          note: plusOneRow.note,
        }
      : null;

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      age,
      gender: profile.gender as any,
      bio: profile.bio,
      occupation: profile.occupation,
      education: profile.education,
      city: profile.city,
      countryCode: profile.countryCode,
      interests: interests.map((i) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        category: i.category,
      })),
      prompts: prompts.map((p) => ({
        id: p.id,
        prompt: p.prompt,
        answer: p.answer,
      })),
      audioPrompts,
      relationshipIntent: (profile.relationshipIntent as any) || null,
      familyPlans: (profile.familyPlans as any) || null,
      isVerified: profile.isVerified ?? false,
      verifiedAt: profile.verifiedAt?.toISOString() || null,
      incognitoMode: profile.incognitoMode ?? false,
      smartPhotos: profile.smartPhotos ?? true,
      travelMode: profile.travelMode ?? false,
      travelCity: profile.travelCity || null,
      travelCountry: profile.travelCountry || null,
      media: readyMedia,
      eventPlusOne,
    };
  }

  // ----------------------------------------------------
  // Shareable Profile Card (Feature 3.5)
  // ----------------------------------------------------

  async getShareableProfileCard(profileId: string): Promise<ShareableProfileCardDto> {
    const pub = await this.getPublicProfile(profileId);
    const primaryPhoto = pub.media.find((m) => m.isPrimary) || pub.media[0];
    const topPrompt = pub.prompts[0];

    const shareUrl = `https://nazar.app/p/${pub.id}`;
    const deepLink = `nazar://profile/${pub.id}`;

    return {
      profileId: pub.id,
      userId: pub.userId,
      displayName: pub.displayName,
      age: pub.age,
      occupation: pub.occupation,
      city: pub.city,
      countryCode: pub.countryCode,
      isVerified: pub.isVerified ?? false,
      primaryPhotoUrl: primaryPhoto?.url || null,
      featuredPrompt: topPrompt ? { prompt: topPrompt.prompt, answer: topPrompt.answer } : null,
      eventPlusOne: pub.eventPlusOne ?? null,
      shareUrl,
      deepLink,
    };
  }

  // ----------------------------------------------------
  // Helpers
  // ----------------------------------------------------

  private async buildPrivateProfileResponse(profile: ProfileRow): Promise<PrivateProfileResponse> {
    const [preferences, interests, prompts, audioPrompts, media] = await Promise.all([
      this.preferencesRepo.findByUserId(profile.userId),
      this.interestRepo.findByProfileId(profile.id),
      this.promptRepo.findByProfileId(profile.id),
      this.promptRepo.findAudioPromptsByProfileId(profile.id),
      this.mediaRepo.findByProfileId(profile.id),
    ]);

    const mappedMedia: MediaItemResponse[] = media.map((m) => ({
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
    }));

    const age = calculateAge(profile.dateOfBirth);

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      dateOfBirth: String(profile.dateOfBirth),
      age,
      gender: profile.gender as any,
      bio: profile.bio,
      occupation: profile.occupation,
      education: profile.education,
      city: profile.city,
      countryCode: profile.countryCode,
      location:
        profile.latitude && profile.longitude
          ? { latitude: profile.latitude, longitude: profile.longitude }
          : null,
      visibility: profile.visibility as any,
      completionStatus: profile.completionStatus,
      relationshipIntent: (profile.relationshipIntent as any) || null,
      familyPlans: (profile.familyPlans as any) || null,
      isVerified: profile.isVerified ?? false,
      verifiedAt: profile.verifiedAt?.toISOString() || null,
      incognitoMode: profile.incognitoMode ?? false,
      smartPhotos: profile.smartPhotos ?? true,
      travelMode: profile.travelMode ?? false,
      travelLatitude: profile.travelLatitude ?? null,
      travelLongitude: profile.travelLongitude ?? null,
      travelCity: profile.travelCity || null,
      travelCountry: profile.travelCountry || null,
      preferences: preferences ? this.mapPreferencesResponse(preferences) : null,
      interests: interests.map((i) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        category: i.category,
      })),
      prompts,
      audioPrompts,
      media: mappedMedia,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapPreferencesResponse(p: ProfilePreferencesRow): PreferencesResponse {
    return {
      id: p.id,
      userId: p.userId,
      minAge: p.minAge,
      maxAge: p.maxAge,
      ageIsDealbreaker: p.ageIsDealbreaker,
      genderPreferences: p.genderPreferences as any,
      maxDistanceKm: p.maxDistanceKm,
      distanceIsDealbreaker: p.distanceIsDealbreaker,
      relationshipIntent: p.relationshipIntent as any,
      intentIsDealbreaker: p.intentIsDealbreaker,
      familyPlans: (p.familyPlans as any) || null,
      familyPlansIsDealbreaker: p.familyPlansIsDealbreaker,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private async recalculateCompletenessInternal(
    profile: ProfileRow,
    tx?: any
  ): Promise<ProfileCompleteness> {
    const [preferences, media, interests, prompts] = await Promise.all([
      this.preferencesRepo.findByUserId(profile.userId, tx),
      this.mediaRepo.findByProfileId(profile.id, tx),
      this.interestRepo.findByProfileId(profile.id, tx),
      this.promptRepo.findByProfileId(profile.id, tx),
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

    await this.profileRepo.updateCompletionStatus(profile.id, completeness, tx);
    return completeness;
  }
}
