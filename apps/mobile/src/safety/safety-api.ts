import type {
  BlockUserRequestDto,
  BlockUserResponseDto,
  UnblockUserResponseDto,
  BlockedUserListResponseDto,
  CreateReportRequestDto,
  ReportResponseDto,
  BlockContactsRequestDto,
  BlockContactsResponseDto,
  BlockedContactsListResponseDto,
  VerificationChallengeResponseDto,
  SubmitVerificationRequestDto,
  SubmitVerificationResponseDto,
  VerificationStatusResponseDto,
  CreateDateCheckinRequestDto,
  DateCheckinResponseDto,
  TriggerSosRequestDto,
  TriggerSosResponseDto,
  ConfirmCheckinResponseDto,
} from '@platform/api-contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

export const SAFETY_QUERY_KEYS = {
  blocks: ['safety', 'blocks'] as const,
  blockedContacts: ['safety', 'blocked-contacts'] as const,
  verificationStatus: ['safety', 'verification-status'] as const,
  activeDateCheckin: ['safety', 'active-date-checkin'] as const,
  report: (id: string) => ['safety', 'report', id] as const,
};

/**
 * Centrally invalidates all relationship and safety caches across
 * discovery, matches, messaging, social, and blocked-users list.
 */
export function invalidateSafetyCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.blocks });
  void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.blockedContacts });
  void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.verificationStatus });
  void queryClient.invalidateQueries({ queryKey: ['profile'] });
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

    async blockContacts(payload: BlockContactsRequestDto): Promise<BlockContactsResponseDto> {
      const res = await authClient.request<BlockContactsResponseDto>(
        '/v1/users/blocked-contacts',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to block contacts');
      }
      return res.data;
    },

    async listBlockedContacts(): Promise<BlockedContactsListResponseDto> {
      const res = await authClient.request<BlockedContactsListResponseDto>(
        '/v1/users/blocked-contacts'
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve blocked contacts');
      }
      return res.data;
    },

    async unblockContact(phoneHash: string): Promise<{ success: boolean }> {
      const res = await authClient.request<{ success: boolean }>(
        `/v1/users/blocked-contacts/${phoneHash}`,
        {
          method: 'DELETE',
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to unblock contact');
      }
      return res.data;
    },

    async getVerificationChallenge(): Promise<VerificationChallengeResponseDto> {
      const res = await authClient.request<VerificationChallengeResponseDto>(
        '/v1/safety/verification/challenge'
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to generate verification challenge');
      }
      return res.data;
    },

    async submitPhotoVerification(
      payload: SubmitVerificationRequestDto
    ): Promise<SubmitVerificationResponseDto> {
      const res = await authClient.request<SubmitVerificationResponseDto>(
        '/v1/safety/verification/verify',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to submit photo verification');
      }
      return res.data;
    },

    async getVerificationStatus(): Promise<VerificationStatusResponseDto> {
      const res = await authClient.request<VerificationStatusResponseDto>(
        '/v1/safety/verification/status'
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve verification status');
      }
      return res.data;
    },

    async createDateCheckin(
      payload: CreateDateCheckinRequestDto
    ): Promise<DateCheckinResponseDto> {
      const res = await authClient.request<DateCheckinResponseDto>(
        '/v1/safety/date-checkin',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create date check-in');
      }
      return res.data;
    },

    async getActiveDateCheckin(): Promise<DateCheckinResponseDto | null> {
      const res = await authClient.request<DateCheckinResponseDto | null>(
        '/v1/safety/date-checkin/active'
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve active date check-in');
      }
      return res.data;
    },

    async confirmDateCheckin(id: string): Promise<ConfirmCheckinResponseDto> {
      const res = await authClient.request<ConfirmCheckinResponseDto>(
        `/v1/safety/date-checkin/${id}/confirm`,
        {
          method: 'POST',
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to confirm date check-in');
      }
      return res.data;
    },

    async triggerSos(payload: TriggerSosRequestDto): Promise<TriggerSosResponseDto> {
      const res = await authClient.request<TriggerSosResponseDto>(
        '/v1/safety/sos',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to trigger SOS');
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
