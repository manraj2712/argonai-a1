import type { ImageStatus } from '@image-intake/shared';
import { ConflictError } from '../../core/errors.js';
import type { DbClient } from '../../db/client.js';
import type { Image, Prisma } from '../../generated/prisma/client.js';
import type { ImageCursor } from './image-cursor.js';
import { assertTransition } from './image-status.js';

const withCheckResults = { checkResults: true } satisfies Prisma.ImageInclude;
export type ImageWithResults = Prisma.ImageGetPayload<{ include: typeof withCheckResults }>;

export interface NewImage {
  id: string;
  ownerId: string;
  originalFilename: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
  originalKey: string;
}

export interface ImagePageQuery {
  ownerId: string;
  statuses?: ImageStatus[] | undefined;
  limit: number;
  after?: ImageCursor | undefined;
}

export interface ImagePage {
  items: ImageWithResults[];
  next: ImageCursor | null;
}

export class ImagesRepository {
  createMany(db: DbClient, images: NewImage[]): Promise<Image[]> {
    return db.image.createManyAndReturn({ data: images });
  }

  findOwned(db: DbClient, ownerId: string, id: string): Promise<ImageWithResults | null> {
    return db.image.findFirst({ where: { id, ownerId }, include: withCheckResults });
  }

  async listPage(db: DbClient, query: ImagePageQuery): Promise<ImagePage> {
    const { after } = query;
    // Keyset pagination on (created_at, id): stable under concurrent inserts and
    // doesn't slow down with depth the way OFFSET does.
    const rows = await db.image.findMany({
      where: {
        ownerId: query.ownerId,
        ...(query.statuses && { status: { in: query.statuses } }),
        ...(after && {
          OR: [
            { createdAt: { lt: after.createdAt } },
            { createdAt: after.createdAt, id: { lt: after.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: withCheckResults,
    });

    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const next =
      rows.length > query.limit && last ? { createdAt: last.createdAt, id: last.id } : null;
    return { items, next };
  }

  /**
   * Compare-and-set: only moves the image if it's still in `from`, so a concurrent
   * change is reported instead of silently overwritten.
   */
  async transition(
    db: DbClient,
    id: string,
    from: ImageStatus,
    to: ImageStatus,
    data: Omit<Prisma.ImageUpdateManyMutationInput, 'status'> = {},
  ): Promise<void> {
    assertTransition(from, to);
    const { count } = await db.image.updateMany({
      where: { id, status: from },
      data: { ...data, status: to },
    });
    if (count === 0) {
      throw new ConflictError(`Image ${id} is no longer ${from}`, 'status_conflict');
    }
  }

  delete(db: DbClient, id: string): Promise<Image> {
    return db.image.delete({ where: { id } });
  }
}
