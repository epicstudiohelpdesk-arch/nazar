import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ErrorCode,
  type PostDto,
  type PostFeedResponseDto,
  type PostCommentDto,
  type CommentListResponseDto,
  type PostReactionType,
  type PostVisibility,
} from '@platform/api-contracts';
import {
  POSTS_REPOSITORY_TOKEN,
  type IPostsRepository,
} from '../repositories/posts.repository.interface.js';
import {
  COMMENTS_REPOSITORY_TOKEN,
  type ICommentsRepository,
} from '../repositories/comments.repository.interface.js';
import {
  REACTIONS_REPOSITORY_TOKEN,
  type IReactionsRepository,
} from '../repositories/reactions.repository.interface.js';
import {
  COMMUNITIES_REPOSITORY_TOKEN,
  type ICommunitiesRepository,
} from '../repositories/communities.repository.interface.js';
import {
  USER_BLOCKS_REPOSITORY_TOKEN,
  type IUserBlocksRepository,
} from '../../safety/repositories/user-blocks.repository.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../safety/repositories/user-restrictions.repository.interface.js';
import { SocialProfileEnricherService } from './social-profile-enricher.service.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { profileMedia } from '../../../infrastructure/database/drizzle/schema/profile-media.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';
import type { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import { generateUuidV7 } from '@platform/domain';
import { inArray, and, eq } from 'drizzle-orm';
import type {
  CreatePostInput,
  UpdatePostInput,
  GetPostFeedQueryInput,
  CreateCommentInput,
  UpdateCommentInput,
  GetCommentsQueryInput,
  AddReactionInput,
} from '@platform/validation';

export interface CursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(raw) as CursorPayload;
  } catch {
    return null;
  }
}

@Injectable()
export class PostsService {
  constructor(
    @Inject(POSTS_REPOSITORY_TOKEN)
    private readonly postsRepo: IPostsRepository,
    @Inject(COMMENTS_REPOSITORY_TOKEN)
    private readonly commentsRepo: ICommentsRepository,
    @Inject(REACTIONS_REPOSITORY_TOKEN)
    private readonly reactionsRepo: IReactionsRepository,
    @Inject(COMMUNITIES_REPOSITORY_TOKEN)
    private readonly communitiesRepo: ICommunitiesRepository,
    @Inject(USER_BLOCKS_REPOSITORY_TOKEN)
    private readonly userBlocksRepo: IUserBlocksRepository,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(SocialProfileEnricherService)
    private readonly profileEnricher: SocialProfileEnricherService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService
  ) {}

  private async assertCanParticipate(userId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.ACCOUNT_BANNED,
        message: 'Your account has been suspended or banned',
      });
    }
  }

  private async resolveMediaUrls(
    mediaIds: readonly string[] | null | undefined
  ): Promise<string[]> {
    if (!mediaIds || mediaIds.length === 0) return [];
    const rows = await this.databaseService.client
      .select({ objectKey: profileMedia.objectKey })
      .from(profileMedia)
      .where(and(inArray(profileMedia.id, [...mediaIds]), eq(profileMedia.status, 'READY')));
    return rows.map((r) => this.storageService.getPublicUrl(r.objectKey));
  }

  async createPost(authorId: string, input: CreatePostInput): Promise<PostDto> {
    await this.assertCanParticipate(authorId);

    let communityName: string | null = null;
    if (input.communityId) {
      const community = await this.communitiesRepo.findById(input.communityId);
      if (!community) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.COMMUNITY_NOT_FOUND,
          message: 'Target community not found',
        });
      }
      communityName = community.name;

      const membership = await this.communitiesRepo.getMembership(input.communityId, authorId);
      if (community.privacy === 'PRIVATE' && (!membership || membership.status !== 'ACTIVE')) {
        throw new ForbiddenException({
          statusCode: 403,
          code: ErrorCode.COMMUNITY_ACCESS_DENIED,
          message: 'Active membership required to post in private community',
        });
      }
      if (membership && membership.status === 'BANNED') {
        throw new ForbiddenException({
          statusCode: 403,
          code: ErrorCode.COMMUNITY_MEMBER_BANNED,
          message: 'You have been banned from this community',
        });
      }
    }

    // Media verification if attached
    if (input.mediaIds && input.mediaIds.length > 0) {
      const validMedia = await this.databaseService.client
        .select({ id: profileMedia.id })
        .from(profileMedia)
        .where(
          and(
            inArray(profileMedia.id, input.mediaIds),
            eq(profileMedia.userId, authorId),
            eq(profileMedia.status, 'READY')
          )
        );
      if (validMedia.length !== input.mediaIds.length) {
        throw new BadRequestException({
          statusCode: 400,
          code: ErrorCode.MEDIA_NOT_FOUND,
          message: 'One or more media items are invalid or not in READY status',
        });
      }
    }

    const postId = generateUuidV7();
    return this.databaseService.withTransaction(async (tx) => {
      const post = await this.postsRepo.createPost(
        {
          id: postId,
          authorId,
          communityId: input.communityId || null,
          content: input.content,
          mediaIds: input.mediaIds || null,
          visibility: input.visibility || 'PUBLIC',
          likeCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      // Outbox domain event
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'post.created',
        aggregateType: 'POST',
        aggregateId: post.id,
        payload: {
          postId: post.id,
          authorId: post.authorId,
          communityId: post.communityId,
          content: post.content,
          createdAt: post.createdAt.toISOString(),
        },
        status: 'PENDING',
      });

      const [author, mediaUrls] = await Promise.all([
        this.profileEnricher.getAuthor(authorId),
        this.resolveMediaUrls(post.mediaIds),
      ]);
      return {
        id: post.id,
        authorId: post.authorId,
        author,
        communityId: post.communityId,
        communityName,
        content: post.content,
        mediaUrls,
        visibility: post.visibility as PostVisibility,
        likeCount: 0,
        commentCount: 0,
        userReaction: null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      };
    });
  }

  async getPost(id: string, viewerUserId: string): Promise<PostDto> {
    const post = await this.postsRepo.findById(id);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found or deleted',
      });
    }

    // Safety: Gate 09 bidirectional block check
    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(viewerUserId, post.authorId);
    if (isBlocked) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    let communityName: string | null = null;
    if (post.communityId) {
      const community = await this.communitiesRepo.findById(post.communityId);
      if (community) {
        communityName = community.name;
        if (community.privacy === 'PRIVATE') {
          const membership = await this.communitiesRepo.getMembership(
            post.communityId,
            viewerUserId
          );
          if (!membership || membership.status !== 'ACTIVE') {
            throw new ForbiddenException({
              statusCode: 403,
              code: ErrorCode.COMMUNITY_ACCESS_DENIED,
              message: 'Community membership required to view private post',
            });
          }
        }
      }
    }

    const [author, reaction, mediaUrls] = await Promise.all([
      this.profileEnricher.getAuthor(post.authorId),
      this.reactionsRepo.getUserReaction(post.id, viewerUserId),
      this.resolveMediaUrls(post.mediaIds),
    ]);

    return {
      id: post.id,
      authorId: post.authorId,
      author,
      communityId: post.communityId,
      communityName,
      content: post.content,
      mediaUrls,
      visibility: post.visibility as PostVisibility,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      userReaction: (reaction?.reactionType as PostReactionType) || null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  async updatePost(id: string, authorId: string, input: UpdatePostInput): Promise<PostDto> {
    const post = await this.postsRepo.findById(id);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    if (post.authorId !== authorId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.POST_ACCESS_DENIED,
        message: 'You can only update your own posts',
      });
    }

    const updated = await this.postsRepo.updatePost(id, {
      content: input.content !== undefined ? input.content : post.content,
      visibility: input.visibility !== undefined ? input.visibility : post.visibility,
    });

    const [author, mediaUrls] = await Promise.all([
      this.profileEnricher.getAuthor(authorId),
      this.resolveMediaUrls(updated!.mediaIds),
    ]);
    return {
      id: updated!.id,
      authorId: updated!.authorId,
      author,
      communityId: updated!.communityId,
      communityName: null,
      content: updated!.content,
      mediaUrls,
      visibility: updated!.visibility as PostVisibility,
      likeCount: updated!.likeCount,
      commentCount: updated!.commentCount,
      userReaction: null,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  async deletePost(id: string, userId: string): Promise<{ success: boolean }> {
    const post = await this.postsRepo.findById(id);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    let isAuthorized = post.authorId === userId;
    if (!isAuthorized && post.communityId) {
      const membership = await this.communitiesRepo.getMembership(post.communityId, userId);
      if (membership && ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.POST_ACCESS_DENIED,
        message: 'You do not have permission to delete this post',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.postsRepo.softDeletePost(id, tx);
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'post.deleted',
        aggregateType: 'POST',
        aggregateId: id,
        payload: {
          postId: id,
          deletedByUserId: userId,
          deletedAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });
    });

    return { success: true };
  }

  async getFeed(viewerUserId: string, query: GetPostFeedQueryInput): Promise<PostFeedResponseDto> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      } else {
        throw new BadRequestException({
          statusCode: 400,
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid pagination cursor',
        });
      }
    }

    if (query.communityId) {
      const community = await this.communitiesRepo.findById(query.communityId);
      if (!community) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.COMMUNITY_NOT_FOUND,
          message: 'Community not found',
        });
      }
      if (community.privacy === 'PRIVATE') {
        const membership = await this.communitiesRepo.getMembership(
          query.communityId,
          viewerUserId
        );
        if (!membership || membership.status !== 'ACTIVE') {
          throw new ForbiddenException({
            statusCode: 403,
            code: ErrorCode.COMMUNITY_ACCESS_DENIED,
            message: 'Community membership required to view feed',
          });
        }
      }
    }

    // Safety: Bidirectional block filtering
    const blockedUserIds = await this.userBlocksRepo.getAllBlockedUserIdsForUser(viewerUserId);

    const rows = await this.postsRepo.findFeed({
      limit: limit + 1,
      cursor: parsedCursor,
      communityId: query.communityId,
      excludedAuthorIds: blockedUserIds,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Batch enrich authors
    const authorIds = pageRows.map((r) => r.authorId);
    const authorMap = await this.profileEnricher.getAuthorMap(authorIds);

    const items: PostDto[] = pageRows.map((p) => ({
      id: p.id,
      authorId: p.authorId,
      author: authorMap.get(p.authorId),
      communityId: p.communityId,
      communityName: null,
      content: p.content,
      mediaUrls: [],
      visibility: p.visibility as PostVisibility,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      userReaction: null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  // ----------------------------------------------------
  // Comments
  // ----------------------------------------------------

  async addComment(
    postId: string,
    authorId: string,
    input: CreateCommentInput
  ): Promise<PostCommentDto> {
    await this.assertCanParticipate(authorId);

    const post = await this.postsRepo.findById(postId);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    // Safety block check
    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(authorId, post.authorId);
    if (isBlocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.USER_BLOCKED,
        message: 'Cannot comment on this post due to safety settings',
      });
    }

    if (input.parentId) {
      const parent = await this.commentsRepo.findById(input.parentId);
      if (!parent || parent.postId !== postId) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.COMMENT_NOT_FOUND,
          message: 'Parent comment not found',
        });
      }
    }

    const commentId = generateUuidV7();
    return this.databaseService.withTransaction(async (tx) => {
      const comment = await this.commentsRepo.createComment(
        {
          id: commentId,
          postId,
          authorId,
          parentId: input.parentId || null,
          content: input.content,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      await this.postsRepo.incrementCommentCount(postId, 1, tx);

      // Outbox event: post.commented (for Gate 10 push notifications to post author)
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'post.commented',
        aggregateType: 'POST',
        aggregateId: postId,
        payload: {
          commentId: comment.id,
          postId,
          commentAuthorId: authorId,
          postAuthorId: post.authorId,
          content: input.content,
          createdAt: comment.createdAt.toISOString(),
        },
        status: 'PENDING',
      });

      const author = await this.profileEnricher.getAuthor(authorId);
      return {
        id: comment.id,
        postId: comment.postId,
        authorId: comment.authorId,
        author,
        parentId: comment.parentId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      };
    });
  }

  async getComments(
    postId: string,
    viewerUserId: string,
    query: GetCommentsQueryInput
  ): Promise<CommentListResponseDto> {
    const post = await this.postsRepo.findById(postId);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      }
    }

    const blockedUserIds = await this.userBlocksRepo.getAllBlockedUserIdsForUser(viewerUserId);

    const rows = await this.commentsRepo.findByPostId(postId, {
      limit: limit + 1,
      cursor: parsedCursor,
      excludedAuthorIds: blockedUserIds,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const authorIds = pageRows.map((r) => r.authorId);
    const authorMap = await this.profileEnricher.getAuthorMap(authorIds);

    const items: PostCommentDto[] = pageRows.map((c) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      author: authorMap.get(c.authorId),
      parentId: c.parentId,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async updateComment(
    commentId: string,
    userId: string,
    input: UpdateCommentInput
  ): Promise<PostCommentDto> {
    await this.assertCanParticipate(userId);

    const comment = await this.commentsRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMENT_NOT_FOUND,
        message: 'Comment not found',
      });
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMENT_ACCESS_DENIED,
        message: 'You can only update your own comments',
      });
    }

    const updated = await this.commentsRepo.updateComment(commentId, input.content);
    const author = await this.profileEnricher.getAuthor(userId);

    return {
      id: updated!.id,
      postId: updated!.postId,
      authorId: updated!.authorId,
      author,
      parentId: updated!.parentId,
      content: updated!.content,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  async deleteComment(commentId: string, userId: string): Promise<{ success: boolean }> {
    const comment = await this.commentsRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMENT_NOT_FOUND,
        message: 'Comment not found',
      });
    }

    const post = await this.postsRepo.findById(comment.postId);
    const isCommentAuthor = comment.authorId === userId;
    const isPostAuthor = post?.authorId === userId;
    let isCommunityModerator = false;

    if (post?.communityId) {
      const membership = await this.communitiesRepo.getMembership(post.communityId, userId);
      if (membership && ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
        isCommunityModerator = true;
      }
    }

    if (!isCommentAuthor && !isPostAuthor && !isCommunityModerator) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMENT_ACCESS_DENIED,
        message: 'You do not have permission to delete this comment',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.commentsRepo.softDeleteComment(commentId, tx);
      await this.postsRepo.incrementCommentCount(comment.postId, -1, tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'comment.deleted',
        aggregateType: 'COMMENT',
        aggregateId: commentId,
        payload: {
          commentId,
          postId: comment.postId,
          deletedByUserId: userId,
          deletedAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });
    });

    return { success: true };
  }

  // ----------------------------------------------------
  // Reactions
  // ----------------------------------------------------

  async addReaction(
    postId: string,
    userId: string,
    input: AddReactionInput
  ): Promise<{ success: boolean; reactionType: PostReactionType }> {
    await this.assertCanParticipate(userId);

    const post = await this.postsRepo.findById(postId);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    return this.databaseService.withTransaction(async (tx) => {
      const { reaction, wasCreated } = await this.reactionsRepo.upsertReaction(
        postId,
        userId,
        input.reactionType,
        tx
      );

      if (wasCreated) {
        await this.postsRepo.incrementLikeCount(postId, 1, tx);

        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'post.reacted',
          aggregateType: 'POST',
          aggregateId: postId,
          payload: {
            postId,
            userId,
            reactionType: input.reactionType,
            postAuthorId: post.authorId,
            createdAt: reaction.createdAt.toISOString(),
          },
          status: 'PENDING',
        });
      }

      return {
        success: true,
        reactionType: reaction.reactionType as PostReactionType,
      };
    });
  }

  async removeReaction(
    postId: string,
    userId: string,
    reactionType: PostReactionType
  ): Promise<{ success: boolean }> {
    const post = await this.postsRepo.findById(postId);
    if (!post) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.POST_NOT_FOUND,
        message: 'Post not found',
      });
    }

    return this.databaseService.withTransaction(async (tx) => {
      const deleted = await this.reactionsRepo.deleteReaction(postId, userId, reactionType, tx);
      if (deleted) {
        await this.postsRepo.incrementLikeCount(postId, -1, tx);
      }
      return { success: true };
    });
  }
}
