import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ErrorCode,
  type PrivateProfileResponse,
  type PublicProfileResponse,
  type PreferencesResponse,
  type UpdatePreferencesPayload,
  type InterestItem,
  type UpdateInterestsPayload,
  type ProfilePromptItem,
  type PromptDefinitionItem,
  type UpdatePromptsPayload,
  type MediaUploadRequestPayload,
  type MediaUploadResponse,
  type MediaItemResponse,
  type ReorderMediaPayload,
  type ProfileStateChangeResponse,
  type UpdateProfilePayload,
} from '@platform/api-contracts';
import {
  updateProfileSchema,
  updatePreferencesSchema,
  updateInterestsSchema,
  updatePromptsSchema,
  mediaUploadSchema,
  reorderMediaSchema,
} from '@platform/validation';
import { AppValidationPipe } from '../../common/pipes/app-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { ProfileService } from './services/profile.service.js';
import { MediaService } from './services/media.service.js';
import {
  PROMPT_REPOSITORY_TOKEN,
  type IPromptRepository,
} from './repositories/prompt.repository.js';

@ApiTags('Dating Profiles & Preferences')
@Controller(['v1/profiles', 'v1/profile'])
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(
    @Inject(ProfileService)
    private readonly profileService: ProfileService,
    @Inject(MediaService)
    private readonly mediaService: MediaService,
    @Inject(PROMPT_REPOSITORY_TOKEN)
    private readonly promptRepo: IPromptRepository
  ) {}

  // ----------------------------------------------------
  // Authenticated Owner Profile Endpoints
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['', 'me'])
  @ApiOperation({ summary: 'Get current user full private dating profile' })
  @SwaggerResponse({ status: 200, description: 'Authenticated user private profile' })
  async getMyProfile(@CurrentUser() user: AuthenticatedPrincipal): Promise<PrivateProfileResponse> {
    return this.profileService.getPrivateProfile(user.userId);
  }

  @ApiBearerAuth()
  @Put(['', 'me'])
  @ApiOperation({ summary: 'Create or replace dating profile fields' })
  @SwaggerResponse({ status: 200, description: 'Updated private profile' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updateProfileSchema)) body: UpdateProfilePayload,
    @Req() req: Request
  ): Promise<PrivateProfileResponse> {
    return this.profileService.createOrUpdateProfile(user.userId, body, req.ip);
  }

  @ApiBearerAuth()
  @Patch(['', 'me'])
  @ApiOperation({ summary: 'Partially update dating profile fields' })
  @SwaggerResponse({ status: 200, description: 'Updated private profile' })
  async patchMyProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updateProfileSchema)) body: UpdateProfilePayload,
    @Req() req: Request
  ): Promise<PrivateProfileResponse> {
    return this.profileService.createOrUpdateProfile(user.userId, body, req.ip);
  }

  // ----------------------------------------------------
  // Profile Lifecycle State Machine
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Post(['activate', 'me/activate'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate profile and enter social discovery feed' })
  async activate(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Req() req: Request
  ): Promise<ProfileStateChangeResponse> {
    return this.profileService.activateProfile(user.userId, req.ip);
  }

  @ApiBearerAuth()
  @Post(['pause', 'me/pause'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause profile temporarily from discovery' })
  async pause(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Req() req: Request
  ): Promise<ProfileStateChangeResponse> {
    return this.profileService.pauseProfile(user.userId, req.ip);
  }

  @ApiBearerAuth()
  @Post(['hide', 'me/hide'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide profile completely from discovery' })
  async hide(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Req() req: Request
  ): Promise<ProfileStateChangeResponse> {
    return this.profileService.hideProfile(user.userId, req.ip);
  }

  // ----------------------------------------------------
  // Preferences Endpoints
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['preferences', 'me/preferences'])
  @ApiOperation({ summary: 'Get dating discovery preferences' })
  async getPreferences(@CurrentUser() user: AuthenticatedPrincipal): Promise<PreferencesResponse> {
    return this.profileService.getPreferences(user.userId);
  }

  @ApiBearerAuth()
  @Put(['preferences', 'me/preferences'])
  @ApiOperation({ summary: 'Update dating discovery preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updatePreferencesSchema)) body: UpdatePreferencesPayload,
    @Req() req: Request
  ): Promise<PreferencesResponse> {
    return this.profileService.updatePreferences(user.userId, body, req.ip);
  }

  @ApiBearerAuth()
  @Patch(['preferences', 'me/preferences'])
  async patchPreferences(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updatePreferencesSchema)) body: UpdatePreferencesPayload,
    @Req() req: Request
  ): Promise<PreferencesResponse> {
    return this.profileService.updatePreferences(user.userId, body, req.ip);
  }

  // ----------------------------------------------------
  // Interests Endpoints
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['interests', 'me/interests'])
  @ApiOperation({ summary: 'Get selected interests for authenticated user profile' })
  async getMyInterests(@CurrentUser() user: AuthenticatedPrincipal): Promise<InterestItem[]> {
    return this.profileService.getProfileInterests(user.userId);
  }

  @ApiBearerAuth()
  @Put(['interests', 'me/interests'])
  @ApiOperation({ summary: 'Replace selected interests for authenticated user profile' })
  async updateMyInterests(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updateInterestsSchema)) body: UpdateInterestsPayload,
    @Req() req: Request
  ): Promise<InterestItem[]> {
    return this.profileService.updateProfileInterests(user.userId, body.interestIds, req.ip);
  }

  // ----------------------------------------------------
  // Prompts Endpoints
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['prompts', 'me/prompts'])
  @ApiOperation({ summary: 'Get answered prompts for authenticated user profile' })
  async getMyPrompts(@CurrentUser() user: AuthenticatedPrincipal): Promise<ProfilePromptItem[]> {
    return this.profileService.getProfilePrompts(user.userId);
  }

  @ApiBearerAuth()
  @Put(['prompts', 'me/prompts'])
  @ApiOperation({ summary: 'Replace answered prompts for authenticated user profile' })
  async updateMyPrompts(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updatePromptsSchema)) body: UpdatePromptsPayload,
    @Req() req: Request
  ): Promise<ProfilePromptItem[]> {
    return this.profileService.updateProfilePrompts(user.userId, body.prompts, req.ip);
  }

  @ApiBearerAuth()
  @Get('prompt-definitions')
  @ApiOperation({ summary: 'List all available curated prompt definitions' })
  async getPromptDefinitions(): Promise<PromptDefinitionItem[]> {
    const rows = await this.promptRepo.findAllDefinitions();
    return rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      category: r.category,
      sortOrder: r.sortOrder,
    }));
  }

  // ----------------------------------------------------
  // Media Endpoints
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Post(['media/upload', 'media/upload-url', 'me/media/upload', 'me/media/upload-url'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request signed upload URL for new profile photo' })
  async requestMediaUpload(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(mediaUploadSchema)) body: MediaUploadRequestPayload,
    @Req() req: Request
  ): Promise<MediaUploadResponse> {
    return this.mediaService.requestUpload(user.userId, body, req.ip);
  }

  @ApiBearerAuth()
  @Post(['media/:mediaId/complete', 'me/media/:mediaId/complete'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm media upload completed and mark READY' })
  async completeMediaUpload(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('mediaId') mediaId: string,
    @Req() req: Request
  ): Promise<MediaItemResponse> {
    return this.mediaService.completeUpload(user.userId, mediaId, req.ip);
  }

  @ApiBearerAuth()
  @Get(['media', 'me/media'])
  @ApiOperation({ summary: 'List all active photos for user profile' })
  async listMyMedia(@CurrentUser() user: AuthenticatedPrincipal): Promise<MediaItemResponse[]> {
    return this.mediaService.listMedia(user.userId);
  }

  @ApiBearerAuth()
  @Patch(['media/reorder', 'me/media/reorder'])
  @ApiOperation({ summary: 'Reorder profile photos' })
  async reorderMedia(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(reorderMediaSchema)) body: ReorderMediaPayload,
    @Req() req: Request
  ): Promise<MediaItemResponse[]> {
    return this.mediaService.reorderMedia(user.userId, body.mediaIds, req.ip);
  }

  @ApiBearerAuth()
  @Put(['media/reorder', 'me/media/reorder'])
  async putReorderMedia(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(reorderMediaSchema)) body: ReorderMediaPayload,
    @Req() req: Request
  ): Promise<MediaItemResponse[]> {
    return this.mediaService.reorderMedia(user.userId, body.mediaIds, req.ip);
  }

  @ApiBearerAuth()
  @Post(['media/:mediaId/primary', 'me/media/:mediaId/primary'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a specific photo as primary profile avatar' })
  async setPrimaryMedia(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('mediaId') mediaId: string,
    @Req() req: Request
  ): Promise<MediaItemResponse[]> {
    return this.mediaService.setPrimary(user.userId, mediaId, req.ip);
  }

  @ApiBearerAuth()
  @Delete(['media/:mediaId', 'me/media/:mediaId'])
  @ApiOperation({ summary: 'Delete a profile photo' })
  async deleteMedia(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('mediaId') mediaId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    return this.mediaService.deleteMedia(user.userId, mediaId, req.ip);
  }

  // ----------------------------------------------------
  // Public Profile Presentation Endpoint
  // ----------------------------------------------------

  @Public()
  @Get(':profileId')
  @ApiOperation({ summary: 'Get sanitized public dating profile representation' })
  @SwaggerResponse({ status: 200, description: 'Public sanitized profile' })
  async getPublicProfile(@Param('profileId') profileId: string): Promise<PublicProfileResponse> {
    if (profileId === 'me') {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_NOT_FOUND,
        message: 'Must authenticate to access /me',
      });
    }
    return this.profileService.getPublicProfile(profileId);
  }
}
