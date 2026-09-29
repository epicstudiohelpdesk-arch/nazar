import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller.js';

@Module({
  controllers: [ComplianceController],
})
export class ComplianceModule {}
