import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type {
  InteractionResponseDto,
  UndoResponseDto,
  InteractionHistoryResponseDto,
  LikesYouResponseDto,
} from '@platform/api-contracts';
import { likeInteractionBodySchema, type LikeInteractionInput } from '@platform/validation';
import { AppValidationPipe } from '../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { InteractionsService } from './services/interactions.service.js';

@ApiTags('Interactions (Likes & Passes)')
@Controller('v1/interactions')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InteractionsController {
  constructor(
    @Inject(InteractionsService)
    private readonly interactionsService: InteractionsService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve interaction history for the authenticated user',
    description:
      'Returns a list of interactions (LIKE/PASS) performed by the current authenticated user in reverse chronological order.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of interactions to return (1-100, default 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Interaction history retrieved successfully',
  })
  async getHistory(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string
  ): Promise<InteractionHistoryResponseDto> {
    const parsedLimit = limit !== undefined && limit !== '' ? Number(limit) : undefined;
    return this.interactionsService.getHistory(user.userId, parsedLimit);
  }

  @Get('likes-you')
  @ApiOperation({
    summary: 'Retrieve inbound likes grid ("Likes You")',
    description:
      'Returns users who liked the current user. Entitled subscribers (SEE_LIKES or PREMIUM) receive full unblurred profiles; free users receive blurred teasers with total count.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of inbound likes to return (default 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Inbound likes retrieved successfully',
  })
  async getLikesYou(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string
  ): Promise<LikesYouResponseDto> {
    const parsedLimit = limit !== undefined && limit !== '' ? Number(limit) : undefined;
    return this.interactionsService.getLikesYou(user.userId, parsedLimit);
  }

  @Post(':targetUserId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Express a LIKE toward an eligible target candidate',
    description:
      'Creates a directional LIKE interaction. If a reciprocal LIKE already exists, automatically forms a mutual match and returns matched: true.',
  })
  @ApiParam({
    name: 'targetUserId',
    type: String,
    description: 'UUIDv7 of the target user to like',
  })
  @ApiResponse({
    status: 200,
    description: 'LIKE interaction registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Self-interaction or target is not discoverable',
  })
  @ApiResponse({
    status: 404,
    description: 'Target profile not found',
  })
  async like(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('targetUserId') targetUserId: string,
    @Body(new AppValidationPipe(likeInteractionBodySchema.optional()))
    body?: LikeInteractionInput
  ): Promise<InteractionResponseDto> {
    return this.interactionsService.like(user.userId, targetUserId, body);
  }

  @Post(':targetUserId/pass')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Express a PASS toward a candidate',
    description:
      'Creates a directional PASS interaction. Excludes candidate from active discovery feed.',
  })
  @ApiParam({
    name: 'targetUserId',
    type: String,
    description: 'UUIDv7 of the target user to pass',
  })
  @ApiResponse({
    status: 200,
    description: 'PASS interaction registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Self-interaction or invalid transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Target profile not found',
  })
  async pass(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('targetUserId') targetUserId: string
  ): Promise<InteractionResponseDto> {
    return this.interactionsService.pass(user.userId, targetUserId);
  }

  @Post('undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undo the most recent interaction',
    description:
      'Reverts the most recent PASS or non-matched LIKE interaction performed by the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Interaction undone successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'No recent interaction to undo or like resulted in an active match',
  })
  async undo(@CurrentUser() user: AuthenticatedPrincipal): Promise<UndoResponseDto> {
    return this.interactionsService.undo(user.userId);
  }
}
