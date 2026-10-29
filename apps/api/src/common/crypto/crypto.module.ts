import { Global, Module } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service.js';
import { AppConfigModule } from '../../config/app-config.module.js';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [FieldEncryptionService],
  exports: [FieldEncryptionService],
})
export class CryptoModule {}
