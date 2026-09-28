import { Controller, Get, Query, UseGuards, Req, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import type { DiscoveryResponseDto } from '@platform/api-contracts';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { DiscoveryService } from './services/discovery.service.js';

@ApiTags('Social Discovery & Recommendations')
@Controller('v1/discovery')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DiscoveryController {
  constructor(
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve paginated discovery candidate profiles',
    description:
      'Returns a deterministic stream of eligible candidate profiles matching reciprocal preferences, completeness, visibility, and geospatial radius.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of candidate profiles to return (1-50, default 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Opaque, signed pagination cursor from previous response',
  })
  @ApiResponse({
    status: 200,
    description: 'Candidate profiles successfully retrieved with pagination cursor',
  })
  @ApiResponse({
    status: 400,
    description: 'Profile not ready, invalid cursor, or invalid limit parameter',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access - valid Bearer token required',
  })
  async getDiscoveryFeed(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Req() req?: Request
  ): Promise<DiscoveryResponseDto> {
    const parsedLimit = limit !== undefined && limit !== '' ? Number(limit) : undefined;
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.toString();

    return this.discoveryService.getDiscoveryFeed(user.userId, {
      limit: parsedLimit,
      cursor,
      ipAddress,
    });
  }
}
