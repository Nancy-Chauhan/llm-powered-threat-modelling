/**
 * S3 Storage Provider
 *
 * Stores files in Amazon S3 or S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import type {
  StorageProvider,
  StoredFile,
  UploadResult,
  UploadOptions,
  S3StorageConfig,
} from '../types';

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private client: S3Client;
  private bucket: string;
  private keyPrefix: string;
  private defaultUrlExpiry: number;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix || '';
    this.defaultUrlExpiry = config.defaultUrlExpiry || 3600; // 1 hour default

    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
      ...(config.forcePathStyle && { forcePathStyle: config.forcePathStyle }),
      ...(config.accessKeyId &&
        config.secretAccessKey && {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }),
    });
  }

  private getFullKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}/${key}` : key;
  }

  async upload(
    data: Buffer | Uint8Array,
    filename: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const key = options?.key || `${nanoid()}-${filename}`;
    const fullKey = this.getFullKey(key);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: data,
      ContentType: options?.contentType || this.guessMimeType(filename),
      Metadata: options?.metadata,
      ...(options?.public && { ACL: 'public-read' }),
    });

    const result = await this.client.send(command);

    // Generate signed URL for access
    const url = await this.getUrl(key, options?.urlExpiry);

    return {
      key,
      url,
      etag: result.ETag,
    };
  }

  async get(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    const response = await this.client.send(command);
    const stream = response.Body;

    if (!stream) {
      throw new Error(`File not found: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getUrl(key: string, expirySeconds?: number): Promise<string> {
    const fullKey = this.getFullKey(key);
    const expiry = expirySeconds || this.defaultUrlExpiry;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiry });
  }

  async getMetadata(key: string): Promise<StoredFile | null> {
    const fullKey = this.getFullKey(key);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      });
      const response = await this.client.send(command);

      return {
        key,
        originalName: key.split('-').slice(1).join('-') || key,
        mimeType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || 0,
        url: await this.getUrl(key),
        metadata: response.Metadata,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  private guessMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      html: 'text/html',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
