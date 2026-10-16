import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  type VerificationChallengeResponseDto,
  type SubmitVerificationResponseDto,
  type VerificationStatusResponseDto,
} from '@platform/api-contracts';
import { submitVerificationSchema, type SubmitVerificationInput } from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { VerificationService } from '../services/verification.service.js';

@ApiTags('Trust & Safety')
@Controller('v1/safety/verification')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(
    @Inject(VerificationService)
    private readonly verificationService: VerificationService
  ) {}

  @Get('challenge')
  @ApiOperation({
    summary: 'Request selfie verification challenge pose',
    description:
      'Returns a dynamic pose requirement (e.g. smile, peace sign) and signed challenge token to prove real-time liveness.',
  })
  @ApiResponse({ status: 200, description: 'Challenge created successfully' })
  getChallenge(@CurrentUser() user: AuthenticatedPrincipal): VerificationChallengeResponseDto {
    return this.verificationService.generateChallenge(user.userId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit KYC selfie verification photo',
    description:
      'Validates dynamic gesture challenge and sets isVerified = true on the authenticated user profile.',
  })
  @ApiResponse({ status: 200, description: 'Verification confirmed' })
  async verifyPhoto(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(submitVerificationSchema)) body: SubmitVerificationInput
  ): Promise<SubmitVerificationResponseDto> {
    return this.verificationService.verifyPhoto(user.userId, body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current user verification status' })
  @ApiResponse({ status: 200, description: 'Status retrieved' })
  async getStatus(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<VerificationStatusResponseDto> {
    return this.verificationService.getVerificationStatus(user.userId);
  }
}
