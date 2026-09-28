import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '../../config/app-config.service.js';
import type { IObjectStorageService, PresignedUploadResult } from './storage.interface.js';

@Injectable()
export class S3StorageService implements IObjectStorageService, OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;

  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {
    this.s3Client = new S3Client({
      endpoint: this.configService.s3Endpoint,
      region: this.configService.s3Region,
      credentials: {
        accessKeyId: this.configService.s3AccessKeyId,
        secretAccessKey: this.configService.s3SecretAccessKey,
      },
      forcePathStyle: this.configService.s3ForcePathStyle,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const bucket = this.configService.s3BucketName;
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (err: unknown) {
        const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          this.logger.log(`Bucket "${bucket}" not found. Creating bucket in local/dev storage...`);
          await this.s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
          this.logger.log(`Bucket "${bucket}" created successfully.`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Storage bucket initialization check failed (non-fatal in testing): ${String(err)}`
      );
    }
  }

  async createPresignedUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds = 900
  ): Promise<PresignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    return {
      uploadUrl,
      storageKey: key,
      expiresAt,
    };
  }

  async getPresignedDownloadUrl(
    bucket: string,
    key: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  getPublicUrl(key: string): string {
    const prefix = this.configService.mediaPublicUrlPrefix.replace(/\/$/, '');
    const cleanKey = key.replace(/^\//, '');
    return `${prefix}/${cleanKey}`;
  }
}
