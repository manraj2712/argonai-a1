import type { Logger } from '../../core/logger.js';
import type { NotificationListener } from '../../db/notification-listener.js';
import type { ObjectStorage } from '../../storage/object-storage.js';
import { IMAGE_PENDING_CHANNEL } from '../events/status-events.js';
import type { ImageProcessor } from './image-processor.js';
import type { JobQueue } from './job-queue.js';
import type { ProcessingConfig } from './processing-config.js';

export interface ProcessingWorkerDeps {
  queue: JobQueue;
  processor: ImageProcessor;
  listener: NotificationListener;
  storage: ObjectStorage;
  logger: Logger;
  config: Pick<ProcessingConfig, 'concurrency' | 'idlePollMs' | 'sweepIntervalMs'>;
}

/**
 * Runs `concurrency` claim → process loops. Idle slots sleep until a pending notification
 * arrives, with a slow poll as the fallback in case a notification is missed.
 */
export class ProcessingWorker {
  private running = false;
  private slots: Promise<void>[] = [];
  private readonly sleepers = new Set<() => void>();
  private sweepTimer: NodeJS.Timeout | null = null;
  private stopListening: (() => void) | null = null;

  constructor(private readonly deps: ProcessingWorkerDeps) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    this.stopListening = this.deps.listener.on(IMAGE_PENDING_CHANNEL, () => {
      this.wakeOne();
    });
    this.slots = Array.from({ length: this.deps.config.concurrency }, (_, slot) =>
      this.runSlot(slot),
    );
    this.sweepTimer = setInterval(() => void this.sweep(), this.deps.config.sweepIntervalMs);
    void this.sweep();
  }

  /** Lets in-flight images finish, then resolves. */
  async stop(): Promise<void> {
    this.running = false;
    this.stopListening?.();
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const wake of this.sleepers) wake();
    await Promise.all(this.slots);
  }

  private async runSlot(slot: number): Promise<void> {
    const { queue, processor, logger } = this.deps;

    while (this.running) {
      let claimed;
      try {
        claimed = await queue.claim();
      } catch (error) {
        logger.error({ err: error, slot }, 'failed to claim an image');
        await this.sleep();
        continue;
      }

      if (!claimed) {
        await this.sleep();
        continue;
      }

      const log = logger.child({ imageId: claimed.id, attempt: claimed.attempts, slot });
      try {
        const startedAt = performance.now();
        const outcome = await processor.process(claimed);
        log.info({ outcome, ms: Math.round(performance.now() - startedAt) }, 'image processed');
      } catch (error) {
        log.error({ err: error }, 'image processing failed');
        await queue.release(claimed, error).catch((releaseError: unknown) => {
          log.error({ err: releaseError }, 'failed to release image; the lease will expire');
        });
      }
    }
  }

  private sleep(): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.sleepers.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, this.deps.config.idlePollMs);
      this.sleepers.add(wake);
    });
  }

  private wakeOne(): void {
    const [first] = this.sleepers;
    first?.();
  }

  private async sweep(): Promise<void> {
    const { queue, storage, logger } = this.deps;
    try {
      const { abandonedKeys, timedOut } = await queue.sweep();
      if (abandonedKeys.length > 0) await storage.deleteMany(abandonedKeys);
      if (abandonedKeys.length > 0 || timedOut > 0) {
        logger.info({ abandoned: abandonedKeys.length, timedOut }, 'swept stale images');
      }
    } catch (error) {
      logger.error({ err: error }, 'sweep failed');
    }
  }
}
