/**
 * Audio Storage Service - Supabase/S3 compatible with signed URLs
 * Does NOT affect radio automation - only handles file uploads/retrieval
 */

import { createClient } from 'npm:@supabase/supabase-js@^2.39.0';

export type StorageProvider = 'supabase' | 's3' | 'local';

export interface StorageConfig {
  provider: StorageProvider;
  // Supabase
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseBucket?: string;
  // S3
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Endpoint?: string;
  // Local
  localPath?: string;
  localBaseUrl?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  signedUrl?: string;
  expiresAt?: number;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds
  download?: boolean;
}

class AudioStorage {
  private config: StorageConfig;
  private supabase: ReturnType<typeof createClient> | null = null;
  private s3Client: any = null;

  constructor(config: StorageConfig) {
    this.config = config;
    this.init();
  }

  private init() {
    if (this.config.provider === 'supabase') {
      if (!this.config.supabaseUrl || !this.config.supabaseServiceKey) {
        throw new Error('Supabase config requires supabaseUrl and supabaseServiceKey');
      }
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseServiceKey);
    }
    // S3 client would be initialized here if needed
    // For now, we focus on Supabase as primary provider
  }

  /**
   * Upload audio file - returns key and public URL
   * Does NOT affect radio queue - only stores the file
   */
  async uploadAudio(
    file: Uint8Array,
    filename: string,
    contentType: string = 'audio/mpeg'
  ): Promise<UploadResult> {
    const key = this.generateKey(filename);
    const bucket = this.config.supabaseBucket || 'audio';

    switch (this.config.provider) {
      case 'supabase':
        return this.uploadSupabase(file, key, contentType, bucket);
      case 's3':
        return this.uploadS3(file, key, contentType);
      case 'local':
        return this.uploadLocal(file, key, contentType);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  private async uploadSupabase(
    file: Uint8Array,
    key: string,
    contentType: string,
    bucket: string
  ): Promise<UploadResult> {
    if (!this.supabase) throw new Error('Supabase not initialized');

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(key, file, {
        contentType,
        upsert: false,
      });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data: { publicUrl } } = this.supabase.storage.from(bucket).getPublicUrl(key);

    return {
      key,
      url: publicUrl,
      signedUrl: publicUrl, // For Supabase public bucket, public URL = signed URL
    };
  }

  private async uploadS3(
    file: Uint8Array,
    key: string,
    contentType: string
  ): Promise<UploadResult> {
    // S3 implementation would go here
    throw new Error('S3 provider not yet implemented');
  }

  private async uploadLocal(
    file: Uint8Array,
    key: string,
    contentType: string
  ): Promise<UploadResult> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const localPath = this.config.localPath || './storage/audio';
    const fullPath = path.join(localPath, key);

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, file);

    const baseUrl = this.config.localBaseUrl || 'http://localhost:8000';
    return {
      key,
      url: `${baseUrl}/storage/audio/${key}`,
      signedUrl: `${baseUrl}/storage/audio/${key}`,
    };
  }

  /**
   * Generate signed URL for private access
   * Radio automation uses PUBLIC URLs - this is for admin/premium access only
   */
  async getSignedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const { expiresIn = 3600, download = false } = options;
    const bucket = this.config.supabaseBucket || 'audio';

    switch (this.config.provider) {
      case 'supabase':
        if (!this.supabase) throw new Error('Supabase not initialized');
        const { data, error } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(key, expiresIn, { download });
        if (error) throw new Error(`Signed URL failed: ${error.message}`);
        return data.signedUrl;

      case 'local':
        // For local, just return the public URL
        const baseUrl = this.config.localBaseUrl || 'http://localhost:8000';
        return `${baseUrl}/storage/audio/${key}`;

      default:
        throw new Error(`Signed URL not supported for ${this.config.provider}`);
    }
  }

  /**
   * Delete audio file
   */
  async deleteAudio(key: string): Promise<void> {
    const bucket = this.config.supabaseBucket || 'audio';

    switch (this.config.provider) {
      case 'supabase':
        if (!this.supabase) throw new Error('Supabase not initialized');
        const { error } = await this.supabase.storage.from(bucket).remove([key]);
        if (error) throw new Error(`Delete failed: ${error.message}`);
        break;

      case 'local':
        const fs = await import('node:fs');
        const path = await import('node:path');
        const localPath = this.config.localPath || './storage/audio';
        await fs.promises.unlink(path.join(localPath, key)).catch(() => {});
        break;
    }
  }

  /**
   * List audio files
   */
  async listAudio(prefix?: string): Promise<Array<{ key: string; size: number; createdAt: string }>> {
    const bucket = this.config.supabaseBucket || 'audio';

    switch (this.config.provider) {
      case 'supabase':
        if (!this.supabase) throw new Error('Supabase not initialized');
        const { data, error } = await this.supabase.storage
          .from(bucket)
          .list(prefix, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
        if (error) throw new Error(`List failed: ${error.message}`);
        return data.map(f => ({
          key: prefix ? `${prefix}/${f.name}` : f.name,
          size: f.metadata?.size || 0,
          createdAt: f.created_at,
        }));

      case 'local':
        const fs = await import('node:fs');
        const path = await import('node:path');
        const localPath = this.config.localPath || './storage/audio';
        const files = await fs.promises.readdir(localPath).catch(() => []);
        return files.map(f => {
          const fullPath = path.join(localPath, f);
          const stat = fs.statSync(fullPath);
          return { key: f, size: stat.size, createdAt: stat.birthtime.toISOString() };
        });

      default:
        return [];
    }
  }

  private generateKey(filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = filename.split('.').pop() || 'mp3';
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    return `tracks/${timestamp}-${random}-${safeName}.${ext}`;
  }

  /**
   * Get public URL for a key (used by radio automation)
   * This is what the radio scheduler uses - MUST be public and stable
   */
  getPublicUrl(key: string): string {
    const bucket = this.config.supabaseBucket || 'audio';

    switch (this.config.provider) {
      case 'supabase':
        if (!this.supabase) throw new Error('Supabase not initialized');
        const { data: { publicUrl } } = this.supabase.storage.from(bucket).getPublicUrl(key);
        return publicUrl;

      case 'local':
        const baseUrl = this.config.localBaseUrl || 'http://localhost:8000';
        return `${baseUrl}/storage/audio/${key}`;

      default:
        throw new Error(`Public URL not supported for ${this.config.provider}`);
    }
  }
}

// Singleton instance
let storageInstance: AudioStorage | null = null;

export function initStorage(config: StorageConfig): AudioStorage {
  storageInstance = new AudioStorage(config);
  return storageInstance;
}

export function getStorage(): AudioStorage {
  if (!storageInstance) {
    // Default to local storage for development
    storageInstance = new AudioStorage({
      provider: 'local',
      localPath: './storage/audio',
      localBaseUrl: 'http://localhost:8000',
    });
  }
  return storageInstance;
}

export { AudioStorage };