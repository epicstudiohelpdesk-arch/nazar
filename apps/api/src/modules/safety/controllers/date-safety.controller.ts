import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
} from '@nestjs/swagger';
import {
  type DateCheckinResponseDto,
  type ConfirmCheckinResponseDto,
  type TriggerSosResponseDto,
} from '@platform/api-contracts';
import {
  createDateCheckinSchema,
  triggerSosSchema,
  type CreateDateCheckinInput,
  type TriggerSosInput,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { DateSafetyService } from '../services/date-safety.service.js';

@ApiTags('Trust & Safety')
@Controller('v1/safety')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DateSafetyController {
  constructor(
    @Inject(DateSafetyService)
    private readonly dateSafetyService: DateSafetyService
  ) {}

  @Post('date-checkin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Schedule a date safety check-in',
    description:
      'Registers date details, emergency contact info, and deadline timer for automated safety checks.',
  })
  @ApiResponse({ status: 201, description: 'Date check-in created successfully' })
  async createDateCheckin(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(createDateCheckinSchema)) input: CreateDateCheckinInput
  ): Promise<DateCheckinResponseDto> {
    return this.dateSafetyService.createCheckin(user.userId, input);
  }

  @Get('date-checkin/active')
  @ApiOperation({
    summary: 'Get active scheduled date check-in',
    description: 'Retrieves the currently scheduled date check-in for the user if one exists.',
  })
  @ApiResponse({ status: 200, description: 'Active date check-in retrieved' })
  async getActiveCheckin(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<DateCheckinResponseDto | null> {
    return this.dateSafetyService.getActiveCheckin(user.userId);
  }

  @Post('date-checkin/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm safe arrival / date completion',
    description: 'Marks the scheduled check-in as safe and notifies emergency contacts.',
  })
  @ApiResponse({ status: 200, description: 'Date confirmed safe' })
  async confirmDateCheckin(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<ConfirmCheckinResponseDto> {
    return this.dateSafetyService.confirmCheckin(user.userId, id);
  }

  @Post('sos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger emergency SOS alert',
    description:
      'Instantly dispatches high-priority emergency alerts with geolocation coordinates to trusted contacts and the Trust & Safety team.',
  })
  @ApiResponse({ status: 200, description: 'Emergency SOS dispatched' })
  async triggerSos(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(triggerSosSchema)) input: TriggerSosInput
  ): Promise<TriggerSosResponseDto> {
    return this.dateSafetyService.triggerSos(user.userId, input);
  }
}
