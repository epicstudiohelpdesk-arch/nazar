import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverEnvSchema } from '@platform/config';
import {
  GeminiClientService,
  INVALID_GEMINI_MODELS,
} from '../src/common/ai/gemini-client.service.js';

describe('Gemini Model Configuration & Client Service', () => {
  describe('Configuration Schema Validation', () => {
    it('should default GEMINI_MODEL to verified model gemini-2.5-flash', () => {
      const parsed = serverEnvSchema.parse({
        JWT_ACCESS_SECRET: 'test_access_secret_do_not_use_in_production_min32chars',
        JWT_REFRESH_SECRET: 'test_refresh_secret_do_not_use_in_production_min32chars',
      });

      expect(parsed.GEMINI_MODEL).toBe('gemini-2.5-flash');
    });

    it('should reject invalid model "skimaki-agy-fast" with clear error', () => {
      expect(() => {
        serverEnvSchema.parse({
          JWT_ACCESS_SECRET: 'test_access_secret_do_not_use_in_production_min32chars',
          JWT_REFRESH_SECRET: 'test_refresh_secret_do_not_use_in_production_min32chars',
          GEMINI_MODEL: 'skimaki-agy-fast',
        });
      }).toThrow(/Invalid GEMINI_MODEL/);
    });

    it('should accept valid verified models such as gemini-2.5-flash and gemini-2.5-pro', () => {
      const parsed = serverEnvSchema.parse({
        JWT_ACCESS_SECRET: 'test_access_secret_do_not_use_in_production_min32chars',
        JWT_REFRESH_SECRET: 'test_refresh_secret_do_not_use_in_production_min32chars',
        GEMINI_MODEL: 'gemini-2.5-pro',
      });

      expect(parsed.GEMINI_MODEL).toBe('gemini-2.5-pro');
    });
  });

  describe('GeminiClientService Model Validation', () => {
    it('should disallow invalid model "skimaki-agy-fast"', () => {
      expect(() => {
        new GeminiClientService({
          GEMINI_MODEL: 'skimaki-agy-fast',
        });
      }).toThrow(/Invalid GEMINI_MODEL: "skimaki-agy-fast"/);
    });

    it('should reject empty model names', () => {
      expect(() => {
        new GeminiClientService({
          GEMINI_MODEL: '   ',
        });
      }).toThrow(/GEMINI_MODEL configuration is required/);
    });

    it('should normalize models with "models/" prefix', () => {
      const client = new GeminiClientService({
        GEMINI_MODEL: 'models/gemini-2.5-flash',
      });
      expect(client.getModelName()).toBe('gemini-2.5-flash');
    });
  });

  describe('GeminiClientService Request Execution', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
    });

    it('should execute generateContent request and parse candidate response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello from Gemini!' }],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 15 },
        }),
      });

      const client = new GeminiClientService({
        GEMINI_MODEL: 'gemini-2.5-flash',
        GEMINI_API_KEY: 'test-api-key',
      });

      const res = await client.generateContent('Say hello');
      expect(res.text).toBe('Hello from Gemini!');
      expect(res.model).toBe('gemini-2.5-flash');
      expect(res.totalTokens).toBe(15);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-api-key',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw clear 404 error when API reports model not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: {
            message: 'models/non-existent-model is not found for API version v1beta',
            code: 404,
          },
        }),
      });

      const client = new GeminiClientService({
        GEMINI_MODEL: 'gemini-2.5-flash',
        GEMINI_API_KEY: 'test-api-key',
      });

      await expect(client.generateContent('Test')).rejects.toThrow(/NOT_FOUND \(code 404\)/);
    });
  });
});
