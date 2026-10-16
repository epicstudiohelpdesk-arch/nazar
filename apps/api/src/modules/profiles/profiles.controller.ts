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
  Res,
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
import type { Request, Response } from 'express';
import {
  ErrorCode,
  type PrivateProfileResponse,
  type PublicProfileResponse,
  type PreferencesResponse,
  type UpdatePreferencesPayload,
  type InterestItem,
  type UpdateInterestsPayload,
  type ProfilePromptItem,
  type ProfileAudioPromptResponse,
  type PromptDefinitionItem,
  type UpdatePromptsPayload,
  type MediaUploadRequestPayload,
  type MediaUploadResponse,
  type MediaItemResponse,
  type ReorderMediaPayload,
  type ProfileStateChangeResponse,
  type UpdateProfilePayload,
  type SmartPhotosStatsResponseDto,
  type PassportLocationResponseDto,
  type ShareableProfileCardDto,
} from '@platform/api-contracts';
import {
  updateProfileSchema,
  updatePreferencesSchema,
  updateInterestsSchema,
  updatePromptsSchema,
  createAudioPromptSchema,
  type CreateAudioPromptInput,
  mediaUploadSchema,
  reorderMediaSchema,
  toggleSmartPhotosSchema,
  type ToggleSmartPhotosInput,
  setPassportLocationSchema,
  type SetPassportLocationInput,
} from '@platform/validation';
import { AppValidationPipe } from '../../common/pipes/app-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { ProfileService } from './services/profile.service.js';
import { MediaService } from './services/media.service.js';
import { SmartPhotosService } from './services/smart-photos.service.js';
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
    @Inject(SmartPhotosService)
    private readonly smartPhotosService: SmartPhotosService,
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
  // Audio Prompts Endpoints (Feature 1.2)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['audio-prompts', 'me/audio-prompts'])
  @ApiOperation({ summary: 'Get audio prompts for authenticated user profile' })
  async getMyAudioPrompts(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<ProfileAudioPromptResponse[]> {
    return this.profileService.getProfileAudioPrompts(user.userId);
  }

  @ApiBearerAuth()
  @Post(['audio-prompts', 'me/audio-prompts'])
  @ApiOperation({ summary: 'Add or update an audio prompt for profile' })
  async createMyAudioPrompt(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(createAudioPromptSchema)) body: CreateAudioPromptInput,
    @Req() req: Request
  ): Promise<ProfileAudioPromptResponse> {
    return this.profileService.createProfileAudioPrompt(user.userId, body, req.ip);
  }

  @ApiBearerAuth()
  @Delete(['audio-prompts/:id', 'me/audio-prompts/:id'])
  @ApiOperation({ summary: 'Delete an audio prompt from profile' })
  async deleteMyAudioPrompt(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    await this.profileService.deleteProfileAudioPrompt(user.userId, id, req.ip);
    return { message: 'Audio prompt deleted successfully' };
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
  // Smart Photos Multi-Armed Bandit Endpoints (Feature 3.2)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['smart-photos', 'me/smart-photos'])
  @ApiOperation({ summary: 'Get smart photos multi-armed bandit statistics' })
  async getSmartPhotosStats(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<SmartPhotosStatsResponseDto> {
    return this.smartPhotosService.getStats(user.userId);
  }

  @ApiBearerAuth()
  @Post(['smart-photos', 'me/smart-photos'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle smart photos multi-armed bandit optimization' })
  async toggleSmartPhotos(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(toggleSmartPhotosSchema)) body: ToggleSmartPhotosInput
  ): Promise<{ enabled: boolean }> {
    return this.smartPhotosService.toggleSmartPhotos(user.userId, body.enabled);
  }

  // ----------------------------------------------------
  // Passport & Travel Mode Endpoints (Feature 3.3)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get(['passport', 'me/passport'])
  @ApiOperation({ summary: 'Get current user passport travel destination' })
  async getPassportLocation(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<PassportLocationResponseDto> {
    return this.profileService.getPassportLocation(user.userId);
  }

  @ApiBearerAuth()
  @Post(['passport', 'me/passport'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or toggle virtual passport travel location' })
  async setPassportLocation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(setPassportLocationSchema)) body: SetPassportLocationInput,
    @Req() req: Request
  ): Promise<PassportLocationResponseDto> {
    return this.profileService.setPassportLocation(user.userId, body, req.ip);
  }

  // ----------------------------------------------------
  // Shareable Profile Card Endpoints (Feature 3.5)
  // ----------------------------------------------------

  @Public()
  @Get(':profileId/card')
  @ApiOperation({ summary: 'Get shareable card representation of profile' })
  async getShareableCard(@Param('profileId') profileId: string): Promise<ShareableProfileCardDto> {
    return this.profileService.getShareableProfileCard(profileId);
  }

  @Public()
  @Get(':profileId/share')
  @ApiOperation({ summary: 'HTML preview card with OpenGraph metadata' })
  async getSharePreviewHtml(
    @Param('profileId') profileId: string,
    @Res() res: Response
  ): Promise<void> {
    const card = await this.profileService.getShareableProfileCard(profileId);
    const title = `${card.displayName}, ${card.age}${card.city ? ` in ${card.city}` : ''} on Nazar`;
    const description = card.featuredPrompt
      ? `"${card.featuredPrompt.prompt}" — "${card.featuredPrompt.answer}"`
      : `Connect with ${card.displayName} on Nazar dating app.`;
    const image = card.primaryPhotoUrl || 'https://nazar.app/assets/og-preview.png';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${card.shareUrl}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${card.deepLink}" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #0b0f19; color: #ffffff;">
  <div style="text-align: center; padding: 24px;">
    <h2>${title}</h2>
    <p>${description}</p>
    <a href="${card.deepLink}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #6366f1; color: #fff; border-radius: 999px; text-decoration: none; font-weight: 600;">Open in Nazar App</a>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
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
