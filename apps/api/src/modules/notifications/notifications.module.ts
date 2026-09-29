import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { DevicesController } from './controllers/devices.controller.js';
import { NotificationsController } from './controllers/notifications.controller.js';
import { DevicesService } from './services/devices.service.js';
import { NotificationPreferencesService } from './services/notification-preferences.service.js';
import { NotificationsService } from './services/notifications.service.js';
import { NotificationEventConsumer } from './workers/notification-event-consumer.js';
import { NotificationDeliveryWorker } from './workers/notification-delivery-worker.js';
import { DevicesRepository } from './repositories/devices.repository.js';
import { DEVICES_REPOSITORY_TOKEN } from './repositories/devices.repository.interface.js';
import { NotificationPreferencesRepository } from './repositories/notification-preferences.repository.js';
import { NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN } from './repositories/notification-preferences.repository.interface.js';
import { NotificationsRepository } from './repositories/notifications.repository.js';
import { NOTIFICATIONS_REPOSITORY_TOKEN } from './repositories/notifications.repository.interface.js';
import { NotificationDeliveryJobsRepository } from './repositories/notification-delivery-jobs.repository.js';
import { NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN } from './repositories/notification-delivery-jobs.repository.interface.js';
import { ApnsPushProvider } from './providers/apns-push.provider.js';
import { APNS_PROVIDER_TOKEN } from './providers/push-provider.interface.js';
import { FcmPushProvider } from './providers/fcm-push.provider.js';
import { FCM_PROVIDER_TOKEN } from './providers/push-provider.interface.js';

@Module({
  imports: [DatabaseModule, SafetyModule],
  controllers: [DevicesController, NotificationsController],
  providers: [
    DevicesService,
    NotificationPreferencesService,
    NotificationsService,
    NotificationEventConsumer,
    NotificationDeliveryWorker,
    {
      provide: DEVICES_REPOSITORY_TOKEN,
      useClass: DevicesRepository,
    },
    {
      provide: NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN,
      useClass: NotificationPreferencesRepository,
    },
    {
      provide: NOTIFICATIONS_REPOSITORY_TOKEN,
      useClass: NotificationsRepository,
    },
    {
      provide: NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN,
      useClass: NotificationDeliveryJobsRepository,
    },
    {
      provide: APNS_PROVIDER_TOKEN,
      useClass: ApnsPushProvider,
    },
    {
      provide: FCM_PROVIDER_TOKEN,
      useClass: FcmPushProvider,
    },
  ],
  exports: [
    DevicesService,
    NotificationPreferencesService,
    NotificationsService,
    NotificationEventConsumer,
    NotificationDeliveryWorker,
    DEVICES_REPOSITORY_TOKEN,
    NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN,
    NOTIFICATIONS_REPOSITORY_TOKEN,
    NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN,
    APNS_PROVIDER_TOKEN,
    FCM_PROVIDER_TOKEN,
  ],
})
export class NotificationsModule {}
