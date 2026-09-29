import { z } from 'zod';

export const paymentProviderEnum = z.enum(['APPLE_APP_STORE', 'GOOGLE_PLAY', 'MOCK']);

export const verifyPurchaseSchema = z.object({
  provider: paymentProviderEnum,
  productId: z.string().trim().min(1, 'productId is required').max(128),
  transactionId: z.string().trim().min(1, 'transactionId is required').max(255),
  purchaseToken: z.string().trim().optional(),
  receiptData: z.string().trim().optional(),
  environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
});

export type VerifyPurchaseInput = z.infer<typeof verifyPurchaseSchema>;

export const restorePurchasesSchema = z.object({
  provider: paymentProviderEnum,
  receiptData: z.string().trim().optional(),
  purchaseTokens: z.array(z.string().trim().min(1)).optional(),
  environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
});

export type RestorePurchasesInput = z.infer<typeof restorePurchasesSchema>;

export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const appleWebhookSchema = z.object({
  signedPayload: z.string().min(1, 'signedPayload is required'),
});

export type AppleWebhookInput = z.infer<typeof appleWebhookSchema>;

export const googleWebhookSchema = z.object({
  message: z.object({
    data: z.string().min(1, 'data is required'),
    messageId: z.string().min(1, 'messageId is required'),
    publishTime: z.string().min(1, 'publishTime is required'),
  }),
  subscription: z.string().min(1, 'subscription is required'),
});

export type GoogleWebhookInput = z.infer<typeof googleWebhookSchema>;
