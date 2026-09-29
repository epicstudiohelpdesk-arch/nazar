import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  type NotificationListResponseDto,
  type UnreadNotificationCountDto,
  type MarkNotificationReadResponseDto,
  type MarkAllNotificationsReadResponseDto,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesDto,
} from '@platform/api-contracts';
import {
  listNotificationsQuerySchema,
  updateNotificationPreferencesSchema,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { NotificationsService } from '../services/notifications.service.js';
import { NotificationPreferencesService } from '../services/notification-preferences.service.js';

@ApiTags('Notifications & Preferences')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(NotificationPreferencesService)
    private readonly preferencesService: NotificationPreferencesService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List notifications with cursor pagination' })
  @SwaggerResponse({ status: 200, description: 'Paginated notifications list' })
  async listNotifications(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new AppValidationPipe(listNotificationsQuerySchema)) query: { cursor?: string; limit: number }
  ): Promise<{ success: true; data: NotificationListResponseDto }> {
    const data = await this.notificationsService.listNotifications(
      user.userId,
      query.limit,
      query.cursor
    );
    return { success: true, data };
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get total unread notification count' })
  @SwaggerResponse({ status: 200, description: 'Unread notification count' })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<{ success: true; data: UnreadNotificationCountDto }> {
    const data = await this.notificationsService.getUnreadCount(user.userId);
    return { success: true, data };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @SwaggerResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') notificationId: string
  ): Promise<{ success: true; data: MarkNotificationReadResponseDto }> {
    const data = await this.notificationsService.markAsRead(user.userId, notificationId);
    return { success: true, data };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  @SwaggerResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<{ success: true; data: MarkAllNotificationsReadResponseDto }> {
    const data = await this.notificationsService.markAllAsRead(user.userId);
    return { success: true, data };
  }

  @Get('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification preferences' })
  @SwaggerResponse({ status: 200, description: 'Notification preferences' })
  async getPreferences(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<{ success: true; data: NotificationPreferencesDto }> {
    const data = await this.preferencesService.getPreferences(user.userId);
    return { success: true, data };
  }

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification preferences' })
  @SwaggerResponse({ status: 200, description: 'Updated notification preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(updateNotificationPreferencesSchema)) dto: UpdateNotificationPreferencesDto
  ): Promise<{ success: true; data: NotificationPreferencesDto }> {
    const data = await this.preferencesService.updatePreferences(user.userId, dto);
    return { success: true, data };
  }
}
