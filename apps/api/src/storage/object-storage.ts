export interface UploadPolicy {
  contentType: string;
  minBytes: number;
  maxBytes: number;
  expiresInSeconds: number;
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectStorage {
  createUploadPost(key: string, policy: UploadPolicy): Promise<PresignedPost>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Resolves to null when the object doesn't exist. */
  head(key: string): Promise<{ sizeBytes: number } | null>;
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}
