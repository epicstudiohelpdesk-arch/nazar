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
  type BlockContactsResponseDto,
  type BlockedContactsListResponseDto,
} from '@platform/api-contracts';
import {
  blockUserParamSchema,
  blockUserBodySchema,
  getBlockedUsersQuerySchema,
  blockContactsSchema,
  type BlockContactsInput,
  unblockContactParamSchema,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
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

  // ----------------------------------------------------
  // Blocked Contacts Endpoints (Feature 2.1)
  // ----------------------------------------------------

  @Post('blocked-contacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Block contacts by SHA-256 phone hash (Privacy-preserving address book blocking)',
    description:
      'Stores client-hashed phone numbers to exclude contacts from candidate discovery without raw phone disclosure.',
  })
  @ApiResponse({ status: 200, description: 'Contacts blocked successfully' })
  async blockContacts(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(blockContactsSchema)) body: BlockContactsInput
  ): Promise<BlockContactsResponseDto> {
    return this.blockingService.blockContacts(user.userId, body.contacts);
  }

  @Get('blocked-contacts')
  @ApiOperation({ summary: 'List all blocked contacts for current user' })
  @ApiResponse({ status: 200, description: 'Blocked contacts retrieved successfully' })
  async listBlockedContacts(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<BlockedContactsListResponseDto> {
    return this.blockingService.listBlockedContacts(user.userId);
  }

  @Delete('blocked-contacts/:phoneHash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock a contact by phone hash' })
  @ApiParam({ name: 'phoneHash', type: String, description: 'SHA-256 phone hash' })
  @ApiResponse({ status: 200, description: 'Contact unblocked successfully' })
  async unblockContact(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('phoneHash') phoneHash: string
  ): Promise<{ success: boolean }> {
    const parseResult = unblockContactParamSchema.safeParse({ phoneHash });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid phone hash',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.blockingService.unblockContact(user.userId, parseResult.data.phoneHash);
  }
}
