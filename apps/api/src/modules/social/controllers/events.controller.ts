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
  type EventDto,
  type EventListResponseDto,
  type EventAttendeeListResponseDto,
  type EventRsvpStatus,
} from '@platform/api-contracts';
import {
  createEventSchema,
  updateEventSchema,
  eventIdParamSchema,
  createRsvpSchema,
  getEventsQuerySchema,
  getAttendeesQuerySchema,
} from '@platform/validation';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { EventsService } from '../services/events.service.js';

@ApiTags('Events & RSVPs')
@Controller('v1/events')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(
    @Inject(EventsService)
    private readonly eventsService: EventsService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  async createEvent(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: unknown
  ): Promise<EventDto> {
    const parseResult = createEventSchema.safeParse(body);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid event payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.createEvent(user.userId, parseResult.data);
  }

  @Get()
  @ApiOperation({ summary: 'Discover upcoming events' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'communityId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['ONLINE', 'PHYSICAL'] })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async discoverEvents(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('communityId') communityId?: string,
    @Query('type') type?: string
  ): Promise<EventListResponseDto> {
    const parseResult = getEventsQuerySchema.safeParse({ limit, cursor, communityId, type });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.discoverEvents(user.userId, parseResult.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  async getEvent(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<EventDto> {
    const parseResult = eventIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid event ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.getEvent(parseResult.data.id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an event' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  async updateEvent(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown
  ): Promise<EventDto> {
    const paramResult = eventIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid event ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = updateEventSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid update payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.updateEvent(paramResult.data.id, user.userId, bodyResult.data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an event' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Event cancelled successfully' })
  async deleteEvent(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    const parseResult = eventIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid event ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.cancelEvent(parseResult.data.id, user.userId);
  }

  // ----------------------------------------------------
  // RSVP API
  // ----------------------------------------------------

  @Post(':id/rsvp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'RSVP to an event (GOING or INTERESTED)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'RSVP recorded' })
  async rsvp(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown
  ): Promise<{ status: EventRsvpStatus }> {
    const paramResult = eventIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid event ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const bodyResult = createRsvpSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyResult.error.errors[0]?.message || 'Invalid RSVP payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.rsvp(paramResult.data.id, user.userId, bodyResult.data);
  }

  @Patch(':id/rsvp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update RSVP status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'RSVP updated' })
  async updateRsvp(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: unknown
  ): Promise<{ status: EventRsvpStatus }> {
    return this.rsvp(user, id, body);
  }

  @Delete(':id/rsvp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel RSVP and trigger FIFO waitlist promotion' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'RSVP cancelled successfully' })
  async cancelRsvp(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    const parseResult = eventIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid event ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.cancelRsvp(parseResult.data.id, user.userId);
  }

  @Get(':id/attendees')
  @ApiOperation({ summary: 'List event attendees' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'plusOnesOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Attendees retrieved successfully' })
  async listAttendees(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('plusOnesOnly') plusOnesOnly?: string
  ): Promise<EventAttendeeListResponseDto> {
    const paramResult = eventIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: paramResult.error.errors[0]?.message || 'Invalid event ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const queryResult = getAttendeesQuerySchema.safeParse({ limit, cursor, plusOnesOnly });
    if (!queryResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: queryResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.eventsService.listAttendees(paramResult.data.id, user.userId, queryResult.data);
  }
}
