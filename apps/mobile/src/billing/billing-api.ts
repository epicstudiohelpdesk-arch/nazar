import {
  type ProductListResponseDto,
  type VerifyPurchaseRequestDto,
  type RestorePurchasesRequestDto,
  type PurchaseVerificationResultDto,
  type RestorePurchasesResultDto,
  type EntitlementsListResponseDto,
  type SubscriptionListResponseDto,
  type SubscriptionResponseDto,
  type PaymentTransactionListResponseDto,
} from '@platform/api-contracts';

export interface BillingApiConfig {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
}

export class BillingApiClient {
  constructor(private readonly config: BillingApiConfig) {}

  private async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data: T }> {
    const token = await this.config.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(
        errorBody?.message || errorBody?.code || `HTTP error ${res.status}: ${res.statusText}`
      );
    }

    return res.json();
  }

  async listProducts(): Promise<ProductListResponseDto> {
    const res = await this.fetchWithAuth<ProductListResponseDto>('/v1/billing/products', {
      method: 'GET',
    });
    return res.data;
  }

  async verifyPurchase(payload: VerifyPurchaseRequestDto): Promise<PurchaseVerificationResultDto> {
    const res = await this.fetchWithAuth<PurchaseVerificationResultDto>(
      '/v1/billing/purchases/verify',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  }

  async restorePurchases(payload: RestorePurchasesRequestDto): Promise<RestorePurchasesResultDto> {
    const res = await this.fetchWithAuth<RestorePurchasesResultDto>(
      '/v1/billing/purchases/restore',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  }

  async getEntitlements(): Promise<EntitlementsListResponseDto> {
    const res = await this.fetchWithAuth<EntitlementsListResponseDto>('/v1/billing/entitlements', {
      method: 'GET',
    });
    return res.data;
  }

  async listSubscriptions(): Promise<SubscriptionListResponseDto> {
    const res = await this.fetchWithAuth<SubscriptionListResponseDto>('/v1/billing/subscriptions', {
      method: 'GET',
    });
    return res.data;
  }

  async getSubscription(id: string): Promise<SubscriptionResponseDto> {
    const res = await this.fetchWithAuth<SubscriptionResponseDto>(
      `/v1/billing/subscriptions/${id}`,
      {
        method: 'GET',
      }
    );
    return res.data;
  }

  async listTransactions(
    limit: number = 20,
    cursor?: string
  ): Promise<PaymentTransactionListResponseDto> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      params.append('cursor', cursor);
    }
    const res = await this.fetchWithAuth<PaymentTransactionListResponseDto>(
      `/v1/billing/transactions?${params.toString()}`,
      { method: 'GET' }
    );
    return res.data;
  }
}
