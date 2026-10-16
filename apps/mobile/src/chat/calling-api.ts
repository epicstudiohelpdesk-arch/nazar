import type {
  InitiateCallRequestDto,
  InitiateCallResponseDto,
  EndCallResponseDto,
  CallSessionDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

export function createCallingApi(authClient: AuthClient) {
  return {
    async initiateCall(payload: InitiateCallRequestDto): Promise<InitiateCallResponseDto> {
      const res = await authClient.request<InitiateCallResponseDto>('/v1/calls/initiate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to initiate call');
      }
      return res.data;
    },

    async endCall(callSessionId: string, reason?: string): Promise<EndCallResponseDto> {
      const res = await authClient.request<EndCallResponseDto>(`/v1/calls/${callSessionId}/end`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to end call');
      }
      return res.data;
    },

    async getCallSession(callSessionId: string): Promise<CallSessionDto> {
      const res = await authClient.request<CallSessionDto>(`/v1/calls/${callSessionId}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve call session');
      }
      return res.data;
    },
  };
}

export type CallingApi = ReturnType<typeof createCallingApi>;

let defaultCallingApi: CallingApi | null = null;

export function getDefaultCallingApi(): CallingApi {
  if (!defaultCallingApi) {
    defaultCallingApi = createCallingApi(getDefaultAuthClient());
  }
  return defaultCallingApi;
}
