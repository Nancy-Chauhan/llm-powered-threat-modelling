/**
 * File Storage Abstraction Types
 *
 * This module defines interfaces for file storage providers, allowing easy switching
 * between different storage backends (local filesystem, S3, GCS, etc.).
 */

// =============================================================================
// File Types
// =============================================================================

export interface StoredFile {
  /** Unique identifier/key for the file */
  key: string;
  /** Original filename */
  originalName: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Public URL for accessing the file (if available) */
  url?: string;
  /** Storage backend metadata */
  metadata?: Record<string, string>;
}

export interface UploadResult {
  /** Unique key/path for the stored file */
  key: string;
  /** Public URL if the storage supports it */
  url?: string;
  /** ETag or version identifier */
  etag?: string;
}

export interface UploadOptions {
  /** Custom key/path for the file (generated if not provided) */
  key?: string;
  /** Make file publicly accessible */
  public?: boolean;
  /** Content type override */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Expiry for signed URLs (in seconds) */
  urlExpiry?: number;
}

// =============================================================================
// Storage Provider Interface
// =============================================================================

export interface StorageProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Upload a file to storage
   */
  upload(
    data: Buffer | Uint8Array,
    filename: string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Get a file from storage
   */
  get(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a public URL for a file
   * For private storage, generates a signed/presigned URL
   */
  getUrl(key: string, expirySeconds?: number): Promise<string>;

  /**
   * Get file metadata without downloading content
   */
  getMetadata(key: string): Promise<StoredFile | null>;
}

// =============================================================================
// Provider Configuration
// =============================================================================

export type StorageProviderType = 'local' | 's3';

export interface StorageConfig {
  provider: StorageProviderType;
}

export interface LocalStorageConfig extends StorageConfig {
  provider: 'local';
  /** Base directory for file storage */
  basePath: string;
  /** Base URL for serving files (e.g., http://localhost:3001/uploads) */
  baseUrl: string;
}

export interface S3StorageConfig extends StorageConfig {
  provider: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region */
  region: string;
  /** Optional: AWS access key (uses env/IAM if not provided) */
  accessKeyId?: string;
  /** Optional: AWS secret key */
  secretAccessKey?: string;
  /** Optional: Custom endpoint (for S3-compatible services) */
  endpoint?: string;
  /** Optional: Force path-style URLs (for MinIO, etc.) */
  forcePathStyle?: boolean;
  /** Optional: Key prefix for all files */
  keyPrefix?: string;
  /** Default URL expiry in seconds (for signed URLs) */
  defaultUrlExpiry?: number;
}
