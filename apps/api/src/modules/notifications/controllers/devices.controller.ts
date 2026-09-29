import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
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
  type RegisterDeviceRequestDto,
  type DeviceResponseDto,
} from '@platform/api-contracts';
import { registerDeviceSchema } from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { DevicesService } from '../services/devices.service.js';

@ApiTags('Devices & Push Registration')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/devices')
export class DevicesController {
  constructor(
    @Inject(DevicesService)
    private readonly devicesService: DevicesService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or update device push token' })
  @SwaggerResponse({ status: 200, description: 'Device registered successfully' })
  async registerDevice(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(registerDeviceSchema)) dto: RegisterDeviceRequestDto
  ): Promise<{ success: true; data: DeviceResponseDto }> {
    const data = await this.devicesService.registerDevice(user.userId, dto);
    return { success: true, data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List registered devices for authenticated user' })
  @SwaggerResponse({ status: 200, description: 'List of registered devices' })
  async listDevices(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<{ success: true; data: readonly DeviceResponseDto[] }> {
    const data = await this.devicesService.listDevices(user.userId);
    return { success: true, data };
  }

  @Delete(':deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke registered device' })
  @SwaggerResponse({ status: 200, description: 'Device revoked' })
  async revokeDevice(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('deviceId') deviceId: string
  ): Promise<{ success: true; data: { revoked: boolean } }> {
    const revoked = await this.devicesService.revokeDevice(user.userId, deviceId);
    return { success: true, data: { revoked } };
  }
}
