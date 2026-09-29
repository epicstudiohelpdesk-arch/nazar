import {
  Controller,
  Post,
  Body,
  Req,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  UsePipes,
  Inject,
} from '@nestjs/common';
import { type Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { AnalyticsIngestionService } from '../services/analytics-ingestion.service.js';
import { AnalyticsExperimentService } from '../services/analytics-experiment.service.js';
import {
  ingestAnalyticsEventsSchema,
  recordExperimentExposureSchema,
  type IngestAnalyticsEventsInput,
  type RecordExperimentExposureInput,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { type IngestAnalyticsEventsResultDto } from '@platform/api-contracts';
import { type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsIngestionService)
    private readonly ingestionService: AnalyticsIngestionService,
    @Inject(AnalyticsExperimentService)
    private readonly experimentService: AnalyticsExperimentService
  ) {}

  /**
   * Ingests a batch of telemetry events from mobile or web clients.
   * Tolerates temporary offline latency and operates idempotently.
   */
  @Post('events')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new AppValidationPipe(ingestAnalyticsEventsSchema))
  async ingestEvents(
    @Body() dto: IngestAnalyticsEventsInput,
    @Req() req: Request & { user?: AuthenticatedPrincipal },
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<IngestAnalyticsEventsResultDto> {
    const principal = req.user ?? null;
    return this.ingestionService.ingestClientEvents(dto, principal, ip, userAgent);
  }

  /**
   * Records client-side variant exposure for an assigned experiment.
   */
  @Post('experiments/exposure')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new AppValidationPipe(recordExperimentExposureSchema))
  async recordExposure(@Body() dto: RecordExperimentExposureInput): Promise<{ recorded: boolean }> {
    await this.experimentService.recordExposure(
      dto.experimentId,
      dto.subjectId,
      dto.variant,
      dto.properties
    );

    return { recorded: true };
  }
}
