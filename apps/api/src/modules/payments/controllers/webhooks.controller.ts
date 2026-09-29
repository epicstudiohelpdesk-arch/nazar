import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import {
  type AppleWebhookRequestDto,
  type GoogleWebhookRequestDto,
  type WebhookAcknowledgementDto,
} from '@platform/api-contracts';
import {
  appleWebhookSchema,
  googleWebhookSchema,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { BillingWebhookService } from '../services/billing-webhook.service.js';

@ApiTags('Store Provider Webhooks')
@Public()
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(
    @Inject(BillingWebhookService)
    private readonly webhookService: BillingWebhookService
  ) {}

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Apple App Store Server Notifications v2' })
  @SwaggerResponse({ status: 200, description: 'Apple webhook acknowledged' })
  async handleAppleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
    @Body(new AppValidationPipe(appleWebhookSchema)) body: AppleWebhookRequestDto
  ): Promise<WebhookAcknowledgementDto> {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(body);
    return this.webhookService.handleWebhook(
      'APPLE_APP_STORE',
      headers,
      rawBody,
      body as unknown as Record<string, unknown>
    );
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Google Play Real-Time Developer Notifications (RTDN)' })
  @SwaggerResponse({ status: 200, description: 'Google webhook acknowledged' })
  async handleGoogleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
    @Body(new AppValidationPipe(googleWebhookSchema)) body: GoogleWebhookRequestDto
  ): Promise<WebhookAcknowledgementDto> {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(body);
    return this.webhookService.handleWebhook(
      'GOOGLE_PLAY',
      headers,
      rawBody,
      body as unknown as Record<string, unknown>
    );
  }
}
