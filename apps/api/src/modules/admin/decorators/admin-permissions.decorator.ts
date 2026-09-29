import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { AdminPermissionName } from '@platform/api-contracts';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';

export const RequirePermissions = (
  ...permissions: AdminPermissionName[]
): CustomDecorator<string> => SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);
