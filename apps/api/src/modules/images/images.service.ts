import { randomUUID } from 'node:crypto';
import {
  IMAGE_RULES,
  type CreateImagesRequest,
  type CreateImagesResponse,
  type ImageDto,
  type ImageStatus,
  type ListImagesResponse,
} from '@image-intake/shared';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import type { Logger } from '../../core/logger.js';
import type { Database } from '../../db/client.js';
import { objectKeys } from '../../storage/object-keys.js';
import type { ObjectStorage } from '../../storage/object-storage.js';
import { publishStatusChange } from '../events/status-events.js';
import { decodeCursor, encodeCursor } from './image-cursor.js';
import { toImageDto } from './image.mapper.js';
import type { ImageWithResults, ImagesRepository } from './images.repository.js';

const UPLOAD_WINDOW_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export interface ImagesServiceDeps {
  db: Database;
  images: ImagesRepository;
  storage: ObjectStorage;
  logger: Logger;
}

export interface ListImagesOptions {
  statuses?: ImageStatus[] | undefined;
  limit: number;
  cursor?: string | undefined;
}

export class ImagesService {
  constructor(private readonly deps: ImagesServiceDeps) {}

  async createUploadSlots(
    ownerId: string,
    request: CreateImagesRequest,
  ): Promise<CreateImagesResponse['items']> {
    const { db, images, storage } = this.deps;

    const newImages = request.files.map((file) => {
      const id = randomUUID();
      return {
        id,
        ownerId,
        originalFilename: file.filename,
        declaredMimeType: file.mimeType,
        declaredSizeBytes: file.sizeBytes,
        originalKey: objectKeys.original(ownerId, id),
      };
    });
    const created = await images.createMany(db, newImages);

    // createManyAndReturn doesn't promise input order, and the client matches slots by index
    const createdById = new Map(created.map((image) => [image.id, image]));
    const ordered = newImages.map(({ id }) => createdById.get(id));

    return Promise.all(
      ordered.map(async (image) => {
        if (!image) throw new Error('Created image missing from batch result');
        const upload = await storage.createUploadPost(image.originalKey, {
          contentType: image.declaredMimeType,
          minBytes: IMAGE_RULES.bytes.min,
          maxBytes: IMAGE_RULES.bytes.max,
          expiresInSeconds: UPLOAD_WINDOW_SECONDS,
        });
        return {
          image: toImageDto({ ...image, checkResults: [] }, null),
          upload: { ...upload, expiresAt: upload.expiresAt.toISOString() },
        };
      }),
    );
  }

  async completeUpload(ownerId: string, imageId: string): Promise<ImageDto> {
    const { db, images, storage } = this.deps;
    const image = await this.requireOwned(ownerId, imageId);

    // a retried request after a lost response shouldn't fail
    if (image.status !== 'awaiting_upload') return this.toDto(image);

    const object = await storage.head(image.originalKey);
    if (!object) {
      throw new ConflictError('The file has not finished uploading', 'upload_missing');
    }

    await db.$transaction(async (tx) => {
      await images.transition(tx, imageId, 'awaiting_upload', 'pending', {
        sizeBytes: object.sizeBytes,
      });
      await publishStatusChange(tx, { imageId, ownerId, status: 'pending' });
    });

    return this.toDto(await this.requireOwned(ownerId, imageId));
  }

  async list(ownerId: string, options: ListImagesOptions): Promise<ListImagesResponse> {
    const page = await this.deps.images.listPage(this.deps.db, {
      ownerId,
      statuses: options.statuses,
      limit: options.limit,
      after: options.cursor ? decodeCursor(options.cursor) : undefined,
    });
    return {
      items: await Promise.all(page.items.map((image) => this.toDto(image))),
      nextCursor: page.next ? encodeCursor(page.next) : null,
    };
  }

  async get(ownerId: string, imageId: string): Promise<ImageDto> {
    return this.toDto(await this.requireOwned(ownerId, imageId));
  }

  async delete(ownerId: string, imageId: string): Promise<void> {
    const { db, images, storage, logger } = this.deps;

    const deleted = await db.$transaction(async (tx) => {
      const image = await images.findOwned(tx, ownerId, imageId);
      if (!image) throw new NotFoundError('Image');
      return images.delete(tx, image.id);
    });

    // Storage can't join the transaction. A worker that's mid-way through this image
    // will fail its compare-and-set and clean up what it wrote.
    const keys = [deleted.originalKey, deleted.normalizedKey, deleted.thumbnailKey].filter(
      (key): key is string => key !== null,
    );
    await storage.deleteMany(keys).catch((error: unknown) => {
      logger.warn({ err: error, imageId }, 'failed to delete objects for deleted image');
    });
  }

  private async requireOwned(ownerId: string, imageId: string): Promise<ImageWithResults> {
    const image = await this.deps.images.findOwned(this.deps.db, ownerId, imageId);
    if (!image) throw new NotFoundError('Image');
    return image;
  }

  private async toDto(image: ImageWithResults): Promise<ImageDto> {
    const thumbnailUrl = image.thumbnailKey
      ? await this.deps.storage.createDownloadUrl(image.thumbnailKey, DOWNLOAD_URL_TTL_SECONDS)
      : null;
    return toImageDto(image, thumbnailUrl);
  }
}
