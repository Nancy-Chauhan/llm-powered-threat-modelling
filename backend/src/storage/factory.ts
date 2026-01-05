/**
 * Storage Provider Factory
 *
 * Creates and manages storage provider instances based on configuration.
 */

import type {
  StorageProvider,
  StorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
} from './types';
import { LocalStorageProvider } from './providers/local';
import { S3StorageProvider } from './providers/s3';

// =============================================================================
// Factory Functions
// =============================================================================

let defaultProvider: StorageProvider | null = null;

/**
 * Create a storage provider from configuration
 */
export function createStorageProvider(
  config: StorageConfig | LocalStorageConfig | S3StorageConfig
): StorageProvider {
  switch (config.provider) {
    case 'local':
      return new LocalStorageProvider(config as LocalStorageConfig);
    case 's3':
      return new S3StorageProvider(config as S3StorageConfig);
    default:
      throw new Error(`Unsupported storage provider: ${(config as StorageConfig).provider}`);
  }
}

/**
 * Get storage configuration from environment variables
 */
export function getConfigFromEnv(): LocalStorageConfig | S3StorageConfig {
  const provider = process.env.STORAGE_PROVIDER || 'local';

  if (provider === 's3') {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION || process.env.AWS_REGION;

    if (!bucket) {
      throw new Error('S3_BUCKET environment variable is required for S3 storage');
    }
    if (!region) {
      throw new Error('S3_REGION or AWS_REGION environment variable is required for S3 storage');
    }

    return {
      provider: 's3',
      bucket,
      region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      keyPrefix: process.env.S3_KEY_PREFIX,
      defaultUrlExpiry: process.env.S3_URL_EXPIRY
        ? parseInt(process.env.S3_URL_EXPIRY, 10)
        : 3600,
    };
  }

  // Default to local storage
  const basePath = process.env.UPLOAD_DIR || './uploads';
  const baseUrl = process.env.UPLOAD_BASE_URL || `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads`;

  return {
    provider: 'local',
    basePath,
    baseUrl,
  };
}

/**
 * Get the default storage provider (singleton)
 */
export function getDefaultStorageProvider(): StorageProvider {
  if (!defaultProvider) {
    const config = getConfigFromEnv();
    defaultProvider = createStorageProvider(config);
    console.log(`Storage provider initialized: ${defaultProvider.name}`);
  }
  return defaultProvider;
}

/**
 * Reset the default provider (useful for testing)
 */
export function resetDefaultStorageProvider(): void {
  defaultProvider = null;
}
