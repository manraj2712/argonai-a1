import type { ImageFormat } from '@image-intake/shared';
import { ConflictError } from '../../core/errors.js';
import type { Database, DbClient } from '../../db/client.js';
import { publishStatusChange } from '../events/status-events.js';
import type { ImagesRepository } from '../images/images.repository.js';
import { failed, passed, type CheckResult } from './checks/check.js';
import type { ClaimedImage } from './job-queue.js';

export interface FinalizeInput {
  image: ClaimedImage;
  results: CheckResult[];
  fingerprint: bigint | null;
  sizeBytes: number;
  format: ImageFormat | null;
  width: number | null;
  height: number | null;
  normalizedKey: string | null;
  thumbnailKey: string | null;
}

/**
 * - `deleted`: the owner removed the image while we worked on it
 * - `superseded`: another worker finished it first after our lease expired
 */
export type FinalizeOutcome = 'accepted' | 'rejected' | 'deleted' | 'superseded';

export class ImageFinalizer {
  constructor(
    private readonly db: Database,
    private readonly images: ImagesRepository,
    private readonly similarityMaxDistance: number,
  ) {}

  finalize(input: FinalizeInput): Promise<FinalizeOutcome> {
    const { image } = input;

    return this.db.$transaction(async (tx) => {
      // Serialises finalization per owner so two near-duplicates processed at the same
      // time can't both see an accepted set without the other and both get in (ADR-0005).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${image.ownerId}, 0))`;

      const results =
        input.fingerprint === null
          ? input.results
          : [...input.results, await this.checkSimilarity(tx, image, input.fingerprint)];
      const status = results.some((result) => result.outcome === 'failed')
        ? 'rejected'
        : 'accepted';

      try {
        await this.images.transition(tx, image.id, 'processing', status, {
          fingerprint: input.fingerprint,
          sizeBytes: input.sizeBytes,
          format: input.format,
          width: input.width,
          height: input.height,
          normalizedKey: input.normalizedKey,
          thumbnailKey: input.thumbnailKey,
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
        });
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        const stillExists = await tx.image.count({ where: { id: image.id } });
        return stillExists ? 'superseded' : 'deleted';
      }

      // replace rather than append, so a retried image never ends up with stale results
      await tx.imageCheckResult.deleteMany({ where: { imageId: image.id } });
      await tx.imageCheckResult.createMany({
        data: results.map((result) => ({
          imageId: image.id,
          checkCode: result.code,
          outcome: result.outcome,
          reason: result.reason,
          measurement: result.measurement,
        })),
      });
      await publishStatusChange(tx, { imageId: image.id, ownerId: image.ownerId, status });

      return status;
    });
  }

  private async checkSimilarity(
    tx: DbClient,
    image: ClaimedImage,
    fingerprint: bigint,
  ): Promise<CheckResult> {
    const [nearest] = await tx.$queryRaw<{ id: string; distance: number }[]>`
      SELECT id, bit_count((fingerprint # ${fingerprint}::bigint)::bit(64))::int AS distance
      FROM images
      WHERE owner_id = ${image.ownerId}::uuid
        AND status = 'accepted'
        AND id <> ${image.id}::uuid
        AND fingerprint IS NOT NULL
      ORDER BY distance
      LIMIT 1`;

    const threshold = this.similarityMaxDistance;
    if (!nearest) return passed('similarity', { distance: null, threshold });

    const measurement = { distance: nearest.distance, threshold, nearestImageId: nearest.id };
    return nearest.distance <= threshold
      ? failed('similarity', 'too_similar', measurement)
      : passed('similarity', measurement);
  }
}
