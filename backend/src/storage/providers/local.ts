/**
 * Local Filesystem Storage Provider
 *
 * Stores files on the local filesystem with optional public URL serving.
 */

import { mkdir, readFile, unlink, stat, access } from 'fs/promises';
import { join, dirname } from 'path';
import { nanoid } from 'nanoid';
import type {
  StorageProvider,
  StoredFile,
  UploadResult,
  UploadOptions,
  LocalStorageConfig,
} from '../types';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private basePath: string;
  private baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async upload(
    data: Buffer | Uint8Array,
    filename: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    // Generate key if not provided
    const key = options?.key || `${nanoid()}-${filename}`;
    const filePath = join(this.basePath, key);

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Write file
    await Bun.write(filePath, data);

    return {
      key,
      url: `${this.baseUrl}/${key}`,
    };
  }

  async get(key: string): Promise<Buffer> {
    const filePath = join(this.basePath, key);
    return Buffer.from(await readFile(filePath));
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    try {
      await unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = join(this.basePath, key);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string, _expirySeconds?: number): Promise<string> {
    // Local storage doesn't support signed URLs, just return the public URL
    return `${this.baseUrl}/${key}`;
  }

  async getMetadata(key: string): Promise<StoredFile | null> {
    const filePath = join(this.basePath, key);
    try {
      const stats = await stat(filePath);
      return {
        key,
        originalName: key.split('-').slice(1).join('-') || key, // Extract original name from key
        mimeType: this.guessMimeType(key),
        size: stats.size,
        url: `${this.baseUrl}/${key}`,
      };
    } catch {
      return null;
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
