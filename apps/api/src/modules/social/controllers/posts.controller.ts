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
  type PostDto,
  type PostFeedResponseDto,
  type PostCommentDto,
  type CommentListResponseDto,
  type PostReactionType,
} from '@platform/api-contracts';
import {
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
  getPostFeedQuerySchema,
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
  getCommentsQuerySchema,
  addReactionSchema,
  removeReactionParamSchema,
} from '@platform/validation';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { PostsService } from '../services/posts.service.js';

@ApiTags('Social Posts & Comments')
@Controller('v1/social')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(
    @Inject(PostsService)
    private readonly postsService: PostsService
  ) {}

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a social post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  async createPost(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: unknown
  ): Promise<PostDto> {
    const parseResult = createPostSchema.safeParse(body);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid post payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.createPost(user.userId, parseResult.data);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get deterministic social feed' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'communityId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Feed retrieved successfully' })
  async getFeed(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('communityId') communityId?: string
  ): Promise<PostFeedResponseDto> {
    const parseResult = getPostFeedQuerySchema.safeParse({ limit, cursor, communityId });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid feed query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.getFeed(user.userId, parseResult.data);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  async getPost(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<PostDto> {
    const parseResult = postIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid post ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.getPost(parseResult.data.id, user.userId);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  async updatePost(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown
  ): Promise<PostDto> {
    const paramResult = postIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid post ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = updatePostSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid update payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.updatePost(paramResult.data.id, user.userId, bodyResult.data);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  async deletePost(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    const parseResult = postIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid post ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.deletePost(parseResult.data.id, user.userId);
  }

  // ----------------------------------------------------
  // Comments
  // ----------------------------------------------------

  @Post('posts/:postId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiParam({ name: 'postId', type: String })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  async addComment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('postId') postId: string,
    @Body() body: unknown
  ): Promise<PostCommentDto> {
    const paramResult = postIdParamSchema.safeParse({ id: postId });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid post ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = createCommentSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid comment payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.addComment(paramResult.data.id, user.userId, bodyResult.data);
  }

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'List comments for a post' })
  @ApiParam({ name: 'postId', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async getComments(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('postId') postId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<CommentListResponseDto> {
    const paramResult = postIdParamSchema.safeParse({ id: postId });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid post ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const queryResult = getCommentsQuerySchema.safeParse({ limit, cursor });
    if (!queryResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: queryResult.error.errors[0]?.message || 'Invalid comments query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.getComments(paramResult.data.id, user.userId, queryResult.data);
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'commentId', type: String })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  async updateComment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('commentId') commentId: string,
    @Body() body: unknown
  ): Promise<PostCommentDto> {
    const paramResult = commentIdParamSchema.safeParse({ id: commentId });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid comment ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = updateCommentSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid comment update payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.updateComment(paramResult.data.id, user.userId, bodyResult.data);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'commentId', type: String })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  async deleteComment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('commentId') commentId: string
  ): Promise<{ success: boolean }> {
    const paramResult = commentIdParamSchema.safeParse({ id: commentId });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid comment ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.deleteComment(paramResult.data.id, user.userId);
  }

  // ----------------------------------------------------
  // Reactions
  // ----------------------------------------------------

  @Post('posts/:postId/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add reaction to a post' })
  @ApiParam({ name: 'postId', type: String })
  @ApiResponse({ status: 200, description: 'Reaction added successfully' })
  async addReaction(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('postId') postId: string,
    @Body() body: unknown
  ): Promise<{ success: boolean; reactionType: PostReactionType }> {
    const paramResult = postIdParamSchema.safeParse({ id: postId });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid post ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = addReactionSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid reaction payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.addReaction(paramResult.data.id, user.userId, bodyResult.data);
  }

  @Delete('posts/:postId/reactions/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove reaction from a post' })
  @ApiParam({ name: 'postId', type: String })
  @ApiParam({ name: 'type', type: String })
  @ApiResponse({ status: 200, description: 'Reaction removed successfully' })
  async removeReaction(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('postId') postId: string,
    @Param('type') reactionType: string
  ): Promise<{ success: boolean }> {
    const parseResult = removeReactionParamSchema.safeParse({ id: postId, type: reactionType });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid post reaction parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.postsService.removeReaction(
      parseResult.data.id,
      user.userId,
      parseResult.data.type as PostReactionType
    );
  }
}
