import type {
  BlockUserRequestDto,
  BlockUserResponseDto,
  UnblockUserResponseDto,
  BlockedUserListResponseDto,
  CreateReportRequestDto,
  ReportResponseDto,
} from '@platform/api-contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

export const SAFETY_QUERY_KEYS = {
  blocks: ['safety', 'blocks'] as const,
  report: (id: string) => ['safety', 'report', id] as const,
};

/**
 * Centrally invalidates all relationship and safety caches across
 * discovery, matches, messaging, social, and blocked-users list.
 */
export function invalidateSafetyCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.blocks });
  void queryClient.invalidateQueries({ queryKey: ['discovery'] });
  void queryClient.invalidateQueries({ queryKey: ['matches'] });
  void queryClient.invalidateQueries({ queryKey: ['chat'] });
  void queryClient.invalidateQueries({ queryKey: ['social'] });
}

export function createSafetyApi(authClient: AuthClient) {
  return {
    async blockUser(
      targetUserId: string,
      payload?: BlockUserRequestDto
    ): Promise<BlockUserResponseDto> {
      const res = await authClient.request<BlockUserResponseDto>(
        `/v1/users/${targetUserId}/block`,
        {
          method: 'POST',
          body: JSON.stringify(payload || {}),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to block user');
      }
      return res.data;
    },

    async unblockUser(targetUserId: string): Promise<UnblockUserResponseDto> {
      const res = await authClient.request<UnblockUserResponseDto>(
        `/v1/users/${targetUserId}/block`,
        {
          method: 'DELETE',
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to unblock user');
      }
      return res.data;
    },

    async getBlockedUsers(
      params: { limit?: number; cursor?: string } = {}
    ): Promise<BlockedUserListResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params.cursor) {
        searchParams.set('cursor', params.cursor);
      }

      const queryString = searchParams.toString();
      const endpoint = queryString ? `/v1/users/blocks?${queryString}` : '/v1/users/blocks';

      const res = await authClient.request<BlockedUserListResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve blocked users');
      }
      return res.data;
    },

    async createReport(payload: CreateReportRequestDto): Promise<ReportResponseDto> {
      const res = await authClient.request<ReportResponseDto>('/v1/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to submit report');
      }
      return res.data;
    },

    async getReport(reportId: string): Promise<ReportResponseDto> {
      const res = await authClient.request<ReportResponseDto>(`/v1/reports/${reportId}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve report');
      }
      return res.data;
    },
  };
}

export type SafetyApi = ReturnType<typeof createSafetyApi>;

let defaultSafetyApi: SafetyApi | null = null;

export function getDefaultSafetyApi(): SafetyApi {
  if (!defaultSafetyApi) {
    defaultSafetyApi = createSafetyApi(getDefaultAuthClient());
  }
  return defaultSafetyApi;
}
