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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import {
  type InitiateCallResponseDto,
  type EndCallResponseDto,
  type CallSessionDto,
} from '@platform/api-contracts';
import {
  initiateCallSchema,
  type InitiateCallInput,
  type EndCallInput,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CallingService } from '../services/calling.service.js';

@ApiTags('Chat & Real-Time Calling')
@Controller('v1/calls')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CallingController {
  constructor(
    @Inject(CallingService)
    private readonly callingService: CallingService
  ) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate an in-app safe WebRTC audio or video call',
    description:
      'Asserts active reciprocal match and verified message history before creating a call session.',
  })
  @ApiResponse({ status: 200, description: 'Call session initiated' })
  async initiateCall(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(initiateCallSchema)) body: InitiateCallInput
  ): Promise<InitiateCallResponseDto> {
    return this.callingService.initiateCall(user.userId, body);
  }

  @Post(':callSessionId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End or decline an active call session' })
  @ApiParam({ name: 'callSessionId', type: String, description: 'Call session UUID' })
  @ApiResponse({ status: 200, description: 'Call session ended' })
  async endCall(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('callSessionId') callSessionId: string,
    @Body() body?: unknown
  ): Promise<EndCallResponseDto> {
    const input: EndCallInput = {
      callSessionId,
      reason: (body as any)?.reason,
    };
    return this.callingService.endCall(user.userId, input);
  }

  @Get(':callSessionId')
  @ApiOperation({ summary: 'Get details of a call session' })
  @ApiParam({ name: 'callSessionId', type: String, description: 'Call session UUID' })
  @ApiResponse({ status: 200, description: 'Call session retrieved' })
  async getCallSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('callSessionId') callSessionId: string
  ): Promise<CallSessionDto> {
    return this.callingService.getCallSession(user.userId, callSessionId);
  }
}
