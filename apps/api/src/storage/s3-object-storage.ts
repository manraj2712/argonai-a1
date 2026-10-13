import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage, PresignedPost, UploadPolicy } from './object-storage.js';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
  publicEndpoint?: string | undefined;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  forcePathStyle: boolean;
}

const DELETE_BATCH_SIZE = 1000;

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  // A presigned URL is only valid for the host it was signed against, and in docker the
  // browser reaches storage on a different host than the API does.
  private readonly signingClient: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client(this.clientConfig(options, options.endpoint));
    this.signingClient = options.publicEndpoint
      ? new S3Client(this.clientConfig(options, options.publicEndpoint))
      : this.client;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const alreadyThere =
        error instanceof S3ServiceException &&
        ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name);
      if (!alreadyThere) throw error;
    }
  }

  async createUploadPost(key: string, policy: UploadPolicy): Promise<PresignedPost> {
    const { url, fields } = await createPresignedPost(this.signingClient, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', policy.minBytes, policy.maxBytes],
        ['eq', '$Content-Type', policy.contentType],
      ],
      Fields: { 'Content-Type': policy.contentType },
      Expires: policy.expiresInSeconds,
    });
    return { url, fields, expiresAt: new Date(Date.now() + policy.expiresInSeconds * 1000) };
  }

  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn: expiresInSeconds,
      },
    );
  }

  async head(key: string): Promise<{ sizeBytes: number } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { sizeBytes: result.ContentLength ?? 0 };
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)
        return null;
      throw error;
    }
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Object ${key} has no body`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
      const batch = keys.slice(start, start + DELETE_BATCH_SIZE);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  private clientConfig(options: S3StorageOptions, endpoint: string | undefined): S3ClientConfig {
    return {
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      ...(endpoint && { endpoint }),
      ...(options.accessKeyId &&
        options.secretAccessKey && {
          credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          },
        }),
    };
  }
}
