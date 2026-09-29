import type {
  BlockUserRequestDto,
  BlockUserResponseDto,
  UnblockUserResponseDto,
  BlockedUserListResponseDto,
  CreateReportRequestDto,
  ReportResponseDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';

export const SAFETY_QUERY_KEYS = {
  blocks: ['safety', 'blocks'] as const,
  report: (id: string) => ['safety', 'report', id] as const,
};

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
