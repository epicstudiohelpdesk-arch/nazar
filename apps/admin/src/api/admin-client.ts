import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminMeResponse,
  AdminUserSummaryDto,
  AdminUserDetailDto,
  AdminUserSearchQuery,
  AdminSuspendUserRequest,
  AdminRestoreUserRequest,
  AdminRevokeSessionsRequest,
  AdminActionResponse,
  AdminModerationCaseDto,
  AdminModerationCaseQuery,
  AdminReportDto,
  AdminReportQuery,
  AdminAssignModerationCaseRequest,
  AdminDecideModerationCaseRequest,
  AdminResolveReportRequest,
  AdminModerationDecisionResponse,
  AdminDashboardMetricsDto,
  AdminAuditLogDto,
  AdminAuditLogQuery,
  AdminSecurityEventDto,
  AdminSecurityEventQuery,
  AdminSystemHealthDto,
  AdminRecommendationDiagnosticsDto,
  AdminOutboxJobDto,
  AdminNotificationJobDto,
  AnalyticsOverviewDto,
  DailyMetricDto,
  DailyMetricsQueryDto,
  FunnelResultDto,
  FunnelQueryDto,
  RetentionResultDto,
  RetentionQueryDto,
  ExperimentSummaryDto,
  AnalyticsPipelineHealthDto,
  AnalyticsQuarantineItemDto,
} from '@platform/api-contracts';

const API_BASE = '/v1/admin';

export class AdminApiClient {
  private token: string | null = null;

  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('nazar_admin_token') : null;
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('nazar_admin_token', token);
    } else {
      localStorage.removeItem('nazar_admin_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody.message || errBody.error || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(message);
    }

    // Handles unwrapping if response was intercepted or standard JSON
    const data = await res.json();
    return (data.data !== undefined ? data.data : data) as T;
  }

  // Auth
  async login(payload: AdminLoginRequest): Promise<AdminLoginResponse> {
    const res = await this.request<AdminLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.accessToken);
    return res;
  }

  async getMe(): Promise<AdminMeResponse> {
    return this.request<AdminMeResponse>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // Users
  async searchUsers(
    params: AdminUserSearchQuery = {}
  ): Promise<{ items: AdminUserSummaryDto[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params.query) query.set('query', params.query);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/users${qs}`);
  }

  async getUserDetail(userId: string): Promise<{ user: AdminUserDetailDto }> {
    return this.request(`/users/${userId}`);
  }

  async suspendUser(userId: string, body: AdminSuspendUserRequest): Promise<AdminActionResponse> {
    return this.request(`/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async restoreUser(userId: string, body: AdminRestoreUserRequest): Promise<AdminActionResponse> {
    return this.request(`/users/${userId}/restore`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async revokeSessions(
    userId: string,
    body: AdminRevokeSessionsRequest
  ): Promise<AdminActionResponse> {
    return this.request(`/users/${userId}/revoke-sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Moderation & Reports
  async getModerationCases(
    params: AdminModerationCaseQuery = {}
  ): Promise<{ items: AdminModerationCaseDto[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/moderation/cases${qs}`);
  }

  async assignCase(
    caseId: string,
    body: AdminAssignModerationCaseRequest
  ): Promise<AdminModerationDecisionResponse> {
    return this.request(`/moderation/cases/${caseId}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async decideCase(
    caseId: string,
    body: AdminDecideModerationCaseRequest
  ): Promise<AdminModerationDecisionResponse> {
    return this.request(`/moderation/cases/${caseId}/decide`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getReports(
    params: AdminReportQuery = {}
  ): Promise<{ items: AdminReportDto[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.targetType) query.set('targetType', params.targetType);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/reports${qs}`);
  }

  async resolveReport(
    reportId: string,
    body: AdminResolveReportRequest
  ): Promise<AdminModerationDecisionResponse> {
    return this.request(`/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Operations & Diagnostics
  async getDashboard(): Promise<{ metrics: AdminDashboardMetricsDto }> {
    return this.request('/operations/dashboard');
  }

  async getRecommendationDiagnostics(): Promise<{
    diagnostics: AdminRecommendationDiagnosticsDto;
  }> {
    return this.request('/operations/recommendations/diagnostics');
  }

  async getOutboxJobs(): Promise<{ items: AdminOutboxJobDto[] }> {
    return this.request('/operations/jobs/outbox');
  }

  async getNotificationJobs(): Promise<{ items: AdminNotificationJobDto[] }> {
    return this.request('/operations/jobs/notifications');
  }

  async getHealth(): Promise<{ health: AdminSystemHealthDto }> {
    return this.request('/system/health');
  }

  // Audit
  async getAuditLogs(
    params: AdminAuditLogQuery = {}
  ): Promise<{ items: AdminAuditLogDto[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params.action) query.set('action', params.action);
    if (params.resourceType) query.set('resourceType', params.resourceType);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/audit/logs${qs}`);
  }

  async getSecurityEvents(
    params: AdminSecurityEventQuery = {}
  ): Promise<{ items: AdminSecurityEventDto[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params.eventType) query.set('eventType', params.eventType);
    if (params.severity) query.set('severity', params.severity);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/audit/security-events${qs}`);
  }

  // Analytics & Telemetry (Gate 15)
  async getAnalyticsOverview(startDate?: string, endDate?: string): Promise<AnalyticsOverviewDto> {
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/analytics/overview${qs}`);
  }

  async getAnalyticsMetrics(params: DailyMetricsQueryDto): Promise<DailyMetricDto[]> {
    const query = new URLSearchParams();
    query.set('startDate', params.startDate);
    query.set('endDate', params.endDate);
    if (params.dimension) query.set('dimension', params.dimension);
    if (params.metricNames) {
      params.metricNames.forEach((m) => query.append('metricNames', m));
    }
    return this.request(`/analytics/metrics?${query.toString()}`);
  }

  async getAnalyticsFunnel(
    funnelId: string,
    params: FunnelQueryDto = {}
  ): Promise<FunnelResultDto> {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.platform) query.set('platform', params.platform);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/analytics/funnels/${funnelId}${qs}`);
  }

  async getAnalyticsRetention(params: RetentionQueryDto = {}): Promise<RetentionResultDto> {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/analytics/retention${qs}`);
  }

  async getAnalyticsExperiments(): Promise<ExperimentSummaryDto[]> {
    return this.request('/analytics/experiments');
  }

  async getAnalyticsHealth(): Promise<AnalyticsPipelineHealthDto> {
    return this.request('/analytics/health');
  }

  async getAnalyticsQuarantine(limit = 50, offset = 0): Promise<AnalyticsQuarantineItemDto[]> {
    return this.request(`/analytics/quarantine?limit=${limit}&offset=${offset}`);
  }

  async triggerAnalyticsAggregation(
    date?: string
  ): Promise<{ aggregatedMetricsCount: number; date: string }> {
    return this.request('/analytics/aggregate', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }
}

export const adminApi = new AdminApiClient();
