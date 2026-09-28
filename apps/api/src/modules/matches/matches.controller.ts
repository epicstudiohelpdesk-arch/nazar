import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import type {
  MatchListResponseDto,
  MatchDetailDto,
  UnmatchResponseDto,
  UnmatchRequestDto,
} from '@platform/api-contracts';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { MatchesService } from './services/matches.service.js';

@ApiTags('Matches')
@Controller('v1/matches')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MatchesController {
  constructor(
    @Inject(MatchesService)
    private readonly matchesService: MatchesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve paginated active matches',
    description:
      'Returns a list of active mutual matches for the authenticated user, ordered by matched timestamp with cursor-based pagination.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of matches to return (1-50, default 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor token for pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Matches retrieved successfully',
  })
  async getMatches(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<MatchListResponseDto> {
    const parsedLimit = limit !== undefined && limit !== '' ? Number(limit) : undefined;
    return this.matchesService.getMatches(user.userId, {
      limit: parsedLimit,
      cursor,
    });
  }

  @Get(':matchId')
  @ApiOperation({
    summary: 'Retrieve match details by ID',
    description:
      'Returns comprehensive public profile details for the other user in the match. Forbidden if the requesting user is not a member of the match.',
  })
  @ApiParam({
    name: 'matchId',
    type: String,
    description: 'UUIDv7 of the match',
  })
  @ApiResponse({
    status: 200,
    description: 'Match details retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - requesting user is not a member of the match',
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  async getMatchDetail(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('matchId') matchId: string
  ): Promise<MatchDetailDto> {
    return this.matchesService.getMatchDetail(user.userId, matchId);
  }

  @Delete(':matchId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unmatch a user',
    description:
      'Transitions match status to UNMATCHED. Historical records are preserved for safety and audit purposes.',
  })
  @ApiParam({
    name: 'matchId',
    type: String,
    description: 'UUIDv7 of the match to dissolve',
  })
  @ApiResponse({
    status: 200,
    description: 'Match successfully dissolved',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - requesting user is not a member of the match',
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  async unmatch(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('matchId') matchId: string,
    @Body() body?: UnmatchRequestDto
  ): Promise<UnmatchResponseDto> {
    return this.matchesService.unmatch(user.userId, matchId, body?.reason);
  }
}
