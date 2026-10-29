import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';

// Repositories
import { AdminUsersRepository } from './repositories/admin-users.repository.js';
import { AdminRolesRepository } from './repositories/admin-roles.repository.js';
import { AdminSessionsRepository } from './repositories/admin-sessions.repository.js';
import { AdminAuditLogsRepository } from './repositories/admin-audit-logs.repository.js';

// Services
import { AdminAuthService } from './services/admin-auth.service.js';
import { AdminUsersService } from './services/admin-users.service.js';
import { AdminModerationService } from './services/admin-moderation.service.js';
import { AdminOperationsService } from './services/admin-operations.service.js';
import { AdminAuditService } from './services/admin-audit.service.js';
import { AdminHealthService } from './services/admin-health.service.js';

// Guards
import { AdminAuthGuard } from './guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from './guards/admin-permissions.guard.js';

// Controllers
import { AdminAuthController } from './controllers/admin-auth.controller.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminModerationController } from './controllers/admin-moderation.controller.js';
import { AdminOperationsController } from './controllers/admin-operations.controller.js';
import { AdminAuditController } from './controllers/admin-audit.controller.js';
import { AdminHealthController } from './controllers/admin-health.controller.js';

// Constants
import {
  ADMIN_USERS_REPOSITORY_TOKEN,
  ADMIN_ROLES_REPOSITORY_TOKEN,
  ADMIN_SESSIONS_REPOSITORY_TOKEN,
  ADMIN_AUDIT_LOGS_REPOSITORY_TOKEN,
} from './constants/admin.constants.js';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminModerationController,
    AdminOperationsController,
    AdminAuditController,
    AdminHealthController,
  ],
  providers: [
    // Repositories
    AdminUsersRepository,
    {
      provide: ADMIN_USERS_REPOSITORY_TOKEN,
      useExisting: AdminUsersRepository,
    },
    AdminRolesRepository,
    {
      provide: ADMIN_ROLES_REPOSITORY_TOKEN,
      useExisting: AdminRolesRepository,
    },
    AdminSessionsRepository,
    {
      provide: ADMIN_SESSIONS_REPOSITORY_TOKEN,
      useExisting: AdminSessionsRepository,
    },
    AdminAuditLogsRepository,
    {
      provide: ADMIN_AUDIT_LOGS_REPOSITORY_TOKEN,
      useExisting: AdminAuditLogsRepository,
    },

    // Services
    AdminAuthService,
    AdminUsersService,
    AdminModerationService,
    AdminOperationsService,
    AdminAuditService,
    AdminHealthService,

    // Guards
    AdminAuthGuard,
    AdminPermissionsGuard,
  ],
  exports: [
    AdminAuthService,
    AdminUsersService,
    AdminModerationService,
    AdminOperationsService,
    AdminAuditService,
    AdminHealthService,
    AdminAuthGuard,
    AdminPermissionsGuard,
    AdminUsersRepository,
    AdminRolesRepository,
    AdminSessionsRepository,
    AdminAuditLogsRepository,
  ],
})

// Gate 1A: the OnModuleInit bootstrap that created a default SUPER_ADMIN
// account (admin@nazar.internal) with a hard-coded password on every start
// was removed. Administrators are now provisioned explicitly via the
// audited `pnpm admin:provision` workflow (see tools/provision-admin-cli.ts).
export class AdminModule {}
