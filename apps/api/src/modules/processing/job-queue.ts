import { ConflictError } from '../../core/errors.js';
import type { Database } from '../../db/client.js';
import { publishStatusChange } from '../events/status-events.js';
import type { ImagesRepository } from '../images/images.repository.js';
import type { ProcessingConfig } from './processing-config.js';

export interface ClaimedImage {
  id: string;
  ownerId: string;
  originalKey: string;
  attempts: number;
}

export interface SweepResult {
  abandonedKeys: string[];
  timedOut: number;
}

type QueueConfig = Pick<
  ProcessingConfig,
  'leaseSeconds' | 'maxAttempts' | 'abandonedUploadMinutes'
>;

/** The images table is the queue: a pending row is a job (ADR-0003). */
export class JobQueue {
  constructor(
    private readonly db: Database,
    private readonly images: ImagesRepository,
    private readonly config: QueueConfig,
  ) {}

  /**
   * Takes the oldest pending image, or one whose worker's lease ran out. SKIP LOCKED lets
   * any number of workers claim at once without ever handing out the same row twice.
   */
  claim(): Promise<ClaimedImage | null> {
    const { leaseSeconds, maxAttempts } = this.config;

    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedImage[]>`
        UPDATE images
        SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
        WHERE id = (
          SELECT id FROM images
          WHERE (status = 'pending'
                 OR (status = 'processing' AND locked_at < now() - make_interval(secs => ${leaseSeconds})))
            AND attempts < ${maxAttempts}
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id, owner_id AS "ownerId", original_key AS "originalKey", attempts`;

      const claimed = rows[0];
      if (!claimed) return null;
      await publishStatusChange(tx, {
        imageId: claimed.id,
        ownerId: claimed.ownerId,
        status: 'processing',
      });
      return claimed;
    });
  }

  /** Puts an image back after a system error, or fails it for good once attempts run out. */
  async release(image: ClaimedImage, error: unknown): Promise<void> {
    const next = image.attempts >= this.config.maxAttempts ? 'failed' : 'pending';
    const message = error instanceof Error ? error.message : String(error);

    try {
      await this.db.$transaction(async (tx) => {
        await this.images.transition(tx, image.id, 'processing', next, {
          lockedAt: null,
          lastError: message.slice(0, 1000),
          ...(next === 'failed' && { processedAt: new Date() }),
        });
        await publishStatusChange(tx, { imageId: image.id, ownerId: image.ownerId, status: next });
      });
    } catch (releaseError) {
      // deleted, or another worker already finished it after our lease expired
      if (!(releaseError instanceof ConflictError)) throw releaseError;
    }
  }

  sweep(): Promise<SweepResult> {
    const { leaseSeconds, maxAttempts, abandonedUploadMinutes } = this.config;

    return this.db.$transaction(async (tx) => {
      const abandoned = await tx.$queryRaw<{ originalKey: string }[]>`
        DELETE FROM images
        WHERE status = 'awaiting_upload'
          AND created_at < now() - make_interval(mins => ${abandonedUploadMinutes})
        RETURNING original_key AS "originalKey"`;

      // a worker died holding its last attempt; claim() won't pick these up again
      const timedOut = await tx.$queryRaw<{ id: string; ownerId: string }[]>`
        UPDATE images
        SET status = 'failed', locked_at = NULL, processed_at = now(), updated_at = now(),
            last_error = 'Processing timed out'
        WHERE status = 'processing'
          AND locked_at < now() - make_interval(secs => ${leaseSeconds})
          AND attempts >= ${maxAttempts}
        RETURNING id, owner_id AS "ownerId"`;

      for (const image of timedOut) {
        await publishStatusChange(tx, {
          imageId: image.id,
          ownerId: image.ownerId,
          status: 'failed',
        });
      }

      return { abandonedKeys: abandoned.map((row) => row.originalKey), timedOut: timedOut.length };
    });
  }
}
