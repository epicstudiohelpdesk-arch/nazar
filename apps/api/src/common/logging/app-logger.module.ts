import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service.js';
import { LoggingInterceptor } from './logging.interceptor.js';

@Global()
@Module({
  providers: [AppLoggerService, LoggingInterceptor],
  exports: [AppLoggerService, LoggingInterceptor],
})
export class AppLoggerModule {}
