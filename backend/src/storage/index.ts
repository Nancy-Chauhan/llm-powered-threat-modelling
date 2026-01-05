/**
 * Storage Module Exports
 */

// Types
export type {
  StorageProvider,
  StoredFile,
  UploadResult,
  UploadOptions,
  StorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
  StorageProviderType,
} from './types';

// Providers
export { LocalStorageProvider } from './providers/local';
export { S3StorageProvider } from './providers/s3';

// Factory
export {
  createStorageProvider,
  getDefaultStorageProvider,
  getConfigFromEnv,
  resetDefaultStorageProvider,
} from './factory';
