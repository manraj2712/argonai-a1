import type {
  ObjectStorage,
  PresignedPost,
  UploadPolicy,
} from '../../src/storage/object-storage.js';

export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  createUploadPost(key: string, policy: UploadPolicy): Promise<PresignedPost> {
    return Promise.resolve({
      url: 'http://storage.test/bucket',
      fields: { key, 'Content-Type': policy.contentType },
      expiresAt: new Date(Date.now() + policy.expiresInSeconds * 1000),
    });
  }

  createDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(`http://storage.test/bucket/${key}?signed`);
  }

  head(key: string): Promise<{ sizeBytes: number } | null> {
    const object = this.objects.get(key);
    return Promise.resolve(object ? { sizeBytes: object.body.length } : null);
  }

  get(key: string): Promise<Buffer> {
    const object = this.objects.get(key);
    return object ? Promise.resolve(object.body) : Promise.reject(new Error(`No object ${key}`));
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) this.objects.delete(key);
    return Promise.resolve();
  }
}
