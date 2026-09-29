import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
  ApiBody,
} from '@nestjs/swagger';
import { ErrorCode, type ReportResponseDto } from '@platform/api-contracts';
import {
  createReportSchema,
  reportIdParamSchema,
  type CreateReportInput,
} from '@platform/validation';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { ReportingService } from '../services/reporting.service.js';

@ApiTags('Trust & Safety')
@Controller('v1/reports')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ReportingController {
  constructor(
    @Inject(ReportingService)
    private readonly reportingService: ReportingService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a safety report',
    description:
      'Creates a report against a user, profile, message, conversation, or media asset, triggering triage and moderation case linkage.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['targetType', 'targetId', 'reasonCode'],
      properties: {
        targetType: {
          type: 'string',
          enum: ['USER', 'PROFILE', 'MESSAGE', 'CONVERSATION', 'MEDIA'],
        },
        targetId: { type: 'string', example: '018f0000-0000-7000-8000-000000000001' },
        reasonCode: {
          type: 'string',
          example: 'HARASSMENT',
        },
        description: { type: 'string', example: 'Sent unsolicited offensive content' },
        metadata: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Report submitted successfully' })
  async createReport(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: CreateReportInput
  ): Promise<ReportResponseDto> {
    const parseResult = createReportSchema.safeParse(body);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid report payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.reportingService.createReport(user.userId, parseResult.data);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve report status',
    description:
      'Returns report submission status for the reporter. Never exposes moderator notes or private investigation details.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Report UUID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  async getReport(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') reportId: string
  ): Promise<ReportResponseDto> {
    const parseResult = reportIdParamSchema.safeParse({ id: reportId });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid report ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.reportingService.getReport(user.userId, parseResult.data.id);
  }
}
