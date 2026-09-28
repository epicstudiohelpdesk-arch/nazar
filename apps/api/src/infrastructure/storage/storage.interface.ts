export interface PresignedUploadResult {
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresAt: string;
}

export interface IObjectStorageService {
  createPresignedUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds?: number
  ): Promise<PresignedUploadResult>;
  getPresignedDownloadUrl(bucket: string, key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(bucket: string, key: string): Promise<void>;
}

export const STORAGE_SERVICE_TOKEN = Symbol('IObjectStorageService');
