import {
  Controller,
  Post,
  Delete,
  Get,
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
  type BlockUserResponseDto,
  type UnblockUserResponseDto,
  type BlockedUserListResponseDto,
} from '@platform/api-contracts';
import {
  blockUserParamSchema,
  blockUserBodySchema,
  getBlockedUsersQuerySchema,
} from '@platform/validation';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { BlockingService } from '../services/blocking.service.js';

@ApiTags('Trust & Safety')
@Controller('v1/users')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BlockingController {
  constructor(
    @Inject(BlockingService)
    private readonly blockingService: BlockingService
  ) {}

  @Post(':userId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Block a user',
    description:
      'Creates a directional block, closes any active conversation, unmatches existing matches, and excludes user from discovery.',
  })
  @ApiParam({ name: 'userId', type: String, description: 'Target user UUID to block' })
  @ApiResponse({ status: 200, description: 'User blocked successfully' })
  async blockUser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('userId') targetUserId: string,
    @Body() body?: unknown
  ): Promise<BlockUserResponseDto> {
    const parseResult = blockUserParamSchema.safeParse({ userId: targetUserId });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid target user ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    let reason: string | undefined;
    if (body && typeof body === 'object') {
      const bodyResult = blockUserBodySchema.safeParse(body);
      if (bodyResult.success) {
        reason = bodyResult.data.reason;
      }
    }

    return this.blockingService.blockUser(user.userId, parseResult.data.userId, reason);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unblock a user',
    description: 'Removes an active block relationship against a previously blocked user.',
  })
  @ApiParam({ name: 'userId', type: String, description: 'Target user UUID to unblock' })
  @ApiResponse({ status: 200, description: 'User unblocked successfully' })
  async unblockUser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('userId') targetUserId: string
  ): Promise<UnblockUserResponseDto> {
    const parseResult = blockUserParamSchema.safeParse({ userId: targetUserId });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid target user ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.blockingService.unblockUser(user.userId, parseResult.data.userId);
  }

  @Get('blocks')
  @ApiOperation({
    summary: 'List blocked users',
    description: 'Returns cursor-paginated list of users blocked by the authenticated user.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit (1-50, default 20)',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Pagination cursor' })
  @ApiResponse({ status: 200, description: 'Blocked users retrieved successfully' })
  async listBlockedUsers(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<BlockedUserListResponseDto> {
    const parseResult = getBlockedUsersQuerySchema.safeParse({ limit, cursor });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.blockingService.listBlockedUsers(user.userId, parseResult.data);
  }
}
