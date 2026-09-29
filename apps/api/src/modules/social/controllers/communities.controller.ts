import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ErrorCode,
  type CommunityDto,
  type CommunityListResponseDto,
  type CommunityMemberListResponseDto,
  type CommunityMembershipStatus,
  type CommunityRole,
  type PostFeedResponseDto,
} from '@platform/api-contracts';
import {
  createCommunitySchema,
  updateCommunitySchema,
  communityIdParamSchema,
  communityMemberParamSchema,
  getCommunitiesQuerySchema,
  getCommunityMembersQuerySchema,
  getPostFeedQuerySchema,
} from '@platform/validation';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CommunitiesService } from '../services/communities.service.js';
import { PostsService } from '../services/posts.service.js';

@ApiTags('Communities & Membership')
@Controller('v1/communities')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CommunitiesController {
  constructor(
    @Inject(CommunitiesService)
    private readonly communitiesService: CommunitiesService,
    @Inject(PostsService)
    private readonly postsService: PostsService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new community' })
  @ApiResponse({ status: 201, description: 'Community created successfully' })
  async createCommunity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: unknown
  ): Promise<CommunityDto> {
    const parseResult = createCommunitySchema.safeParse(body);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid community payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.createCommunity(user.userId, parseResult.data);
  }

  @Get()
  @ApiOperation({ summary: 'List communities the user has joined' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'User communities retrieved' })
  async getUserCommunities(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<CommunityListResponseDto> {
    const parseResult = getCommunitiesQuerySchema.safeParse({ limit, cursor });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.getUserCommunities(user.userId, parseResult.data);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Discover public communities' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Discoverable communities retrieved' })
  async discoverCommunities(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<CommunityListResponseDto> {
    const parseResult = getCommunitiesQuerySchema.safeParse({ limit, cursor });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.discoverCommunities(parseResult.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get community by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Community retrieved successfully' })
  async getCommunity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<CommunityDto> {
    const parseResult = communityIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid community ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.getCommunity(parseResult.data.id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update community configuration' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Community updated successfully' })
  async updateCommunity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown
  ): Promise<CommunityDto> {
    const paramResult = communityIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid community ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = updateCommunitySchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid update payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.updateCommunity(
      paramResult.data.id,
      user.userId,
      bodyResult.data
    );
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a community' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Joined community or request pending' })
  async joinCommunity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<{ status: CommunityMembershipStatus; role: CommunityRole }> {
    const parseResult = communityIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid community ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.joinCommunity(parseResult.data.id, user.userId);
  }

  @Delete(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a community' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Left community successfully' })
  async leaveCommunity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    const parseResult = communityIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid community ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.leaveCommunity(parseResult.data.id, user.userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List members of a community' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Community members retrieved' })
  async listMembers(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<CommunityMemberListResponseDto> {
    const paramResult = communityIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid community ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const queryResult = getCommunityMembersQuerySchema.safeParse({ limit, cursor });
    if (!queryResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: queryResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.listMembers(paramResult.data.id, user.userId, queryResult.data);
  }

  @Post(':id/members/:userId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve pending membership in private community' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, description: 'Membership approved' })
  async approveMembership(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') communityId: string,
    @Param('userId') targetUserId: string
  ): Promise<{ success: boolean; status: CommunityMembershipStatus }> {
    const parseResult = communityMemberParamSchema.safeParse({
      id: communityId,
      userId: targetUserId,
    });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.approveMembership(
      parseResult.data.id,
      user.userId,
      parseResult.data.userId
    );
  }

  @Post(':id/members/:userId/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a member from a community' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, description: 'Member banned successfully' })
  async banMember(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') communityId: string,
    @Param('userId') targetUserId: string
  ): Promise<{ success: boolean }> {
    const parseResult = communityMemberParamSchema.safeParse({
      id: communityId,
      userId: targetUserId,
    });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.communitiesService.banMember(
      parseResult.data.id,
      user.userId,
      parseResult.data.userId
    );
  }

  @Get(':id/feed')
  @ApiOperation({ summary: 'Get community post feed' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Community feed retrieved successfully' })
  async getCommunityFeed(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<PostFeedResponseDto> {
    const paramResult = communityIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid community ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const queryResult = getPostFeedQuerySchema.safeParse({
      limit,
      cursor,
      communityId: paramResult.data.id,
    });
    if (!queryResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: queryResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.getFeed(user.userId, queryResult.data);
  }
}
