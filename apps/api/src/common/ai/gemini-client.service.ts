import { Injectable } from '@nestjs/common';
import type { ServerEnv } from '@platform/config';

export interface GeminiGenerateOptions {
  readonly systemInstruction?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface GeminiGenerateResult {
  readonly text: string;
  readonly model: string;
  readonly totalTokens?: number;
}

export interface GeminiModelInfo {
  readonly name: string;
  readonly displayName: string;
  readonly supportedGenerationMethods: readonly string[];
}

export const INVALID_GEMINI_MODELS = new Set(['skimaki-agy-fast', 'models/skimaki-agy-fast']);

@Injectable()
export class GeminiClientService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(envConfig?: Partial<ServerEnv>) {
    const rawModel = envConfig?.GEMINI_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    this.apiKey = envConfig?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? '';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Startup / configuration validation
    this.model = this.validateAndNormalizeModel(rawModel);
  }

  /**
   * Validates the supplied model identifier.
   * Fails explicitly if an invalid or hallucinated model (e.g. skimaki-agy-fast) is supplied.
   */
  public validateAndNormalizeModel(modelName: string): string {
    const trimmed = (modelName || '').trim();
    if (!trimmed) {
      throw new Error('GEMINI_MODEL configuration is required and cannot be empty.');
    }

    if (INVALID_GEMINI_MODELS.has(trimmed) || trimmed.includes('skimaki')) {
      throw new Error(
        `Invalid GEMINI_MODEL: "${trimmed}" is not a valid Gemini model. Must use a verified model supporting generateContent (e.g. "gemini-2.5-flash").`
      );
    }

    // Strip leading "models/" if present for standard URL construction
    return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;
  }

  public getModelName(): string {
    return this.model;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Queries the models endpoint using the configured credentials.
   */
  async listModels(): Promise<GeminiModelInfo[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const endpoint = `${this.baseUrl}/models?key=${this.apiKey}`;
    const res = await fetch(endpoint, { method: 'GET' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to list Gemini models (HTTP ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { models?: Array<any> };
    return (data.models || []).map((m) => ({
      name: m.name,
      displayName: m.displayName || m.name,
      supportedGenerationMethods: m.supportedGenerationMethods || [],
    }));
  }

  /**
   * Executes a minimal or production generateContent request.
   */
  async generateContent(
    prompt: string,
    options: GeminiGenerateOptions = {}
  ): Promise<GeminiGenerateResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    if (options.systemInstruction) {
      requestBody.system_instruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    if (options.temperature !== undefined || options.maxOutputTokens !== undefined) {
      requestBody.generationConfig = {
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxOutputTokens !== undefined
          ? { maxOutputTokens: options.maxOutputTokens }
          : {}),
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as any;
      const message = errBody?.error?.message || `HTTP error ${res.status}: ${res.statusText}`;

      if (res.status === 404) {
        throw new Error(
          `NOT_FOUND (code 404): models/${this.model} is not found for API version v1beta, or is not supported for generateContent. Details: ${message}`
        );
      }

      throw new Error(`Gemini generateContent failed (HTTP ${res.status}): ${message}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: { totalTokenCount?: number };
    };

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return {
      text: candidateText,
      model: this.model,
      totalTokens: data.usageMetadata?.totalTokenCount,
    };
  }
}
