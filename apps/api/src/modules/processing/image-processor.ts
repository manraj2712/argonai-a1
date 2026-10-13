import type { Logger } from '../../core/logger.js';
import { objectKeys } from '../../storage/object-keys.js';
import type { ObjectStorage } from '../../storage/object-storage.js';
import { AnalyzedImage } from './analysis/analyzed-image.js';
import { failed } from './checks/check.js';
import type { CheckPipeline } from './checks/check-pipeline.js';
import { UnreadableImageError, type ImageDecoder } from './decoding/image-decoder.js';
import type { ImageNormalizer, NormalizedImage } from './decoding/normalizer.js';
import { OriginalImage } from './decoding/original-image.js';
import type { FaceDetector } from './faces/face-detector.js';
import type { FinalizeOutcome, ImageFinalizer } from './image-finalizer.js';
import type { ClaimedImage } from './job-queue.js';

export interface ImageProcessorDeps {
  storage: ObjectStorage;
  decoder: ImageDecoder;
  normalizer: ImageNormalizer;
  pipeline: CheckPipeline;
  faceDetector: FaceDetector;
  finalizer: ImageFinalizer;
  logger: Logger;
}

interface RenditionKeys {
  normalizedKey: string | null;
  thumbnailKey: string | null;
}

/** Examines one claimed image end to end. Throws only for system errors, which the caller retries. */
export class ImageProcessor {
  constructor(private readonly deps: ImageProcessorDeps) {}

  async process(image: ClaimedImage): Promise<FinalizeOutcome> {
    const { storage, decoder, pipeline, faceDetector, finalizer } = this.deps;

    const original = new OriginalImage(await storage.get(image.originalKey), decoder);
    const gate = await pipeline.runGate(original);
    let results = gate.results;

    const normalized = await this.tryNormalize(original);
    if (gate.passed && !normalized) {
      // the header parsed but the pixel data didn't, e.g. a truncated file
      results = [
        ...results.filter((result) => result.code !== 'format'),
        failed('format', 'unreadable_image', { detected: original.format }),
      ];
    }

    const keys = normalized
      ? await this.storeRenditions(image, normalized)
      : { normalizedKey: null, thumbnailKey: null };

    let fingerprint: bigint | null = null;
    if (gate.passed && normalized) {
      const analyzed = new AnalyzedImage(
        normalized.jpeg,
        normalized.width,
        normalized.height,
        faceDetector,
      );
      results = [...results, ...(await pipeline.runQuality(analyzed))];
      fingerprint = await analyzed.fingerprint();
    }

    const outcome = await finalizer.finalize({
      image,
      results,
      fingerprint,
      sizeBytes: original.sizeBytes,
      format: original.format,
      width: normalized?.width ?? null,
      height: normalized?.height ?? null,
      ...keys,
    });

    await this.cleanUp(image, outcome, keys);
    return outcome;
  }

  /**
   * Even a rejected image gets a thumbnail when we can make one, so the owner can see what
   * was turned down. Decoding is still bounded by the pixel limit.
   */
  private async tryNormalize(original: OriginalImage): Promise<NormalizedImage | null> {
    if (!original.format) return null;
    try {
      return await this.deps.normalizer.normalize(original);
    } catch (error) {
      if (error instanceof UnreadableImageError) return null;
      throw error;
    }
  }

  // deterministic keys, so a retry overwrites instead of leaving orphans behind
  private async storeRenditions(
    image: ClaimedImage,
    normalized: NormalizedImage,
  ): Promise<RenditionKeys> {
    const normalizedKey = objectKeys.normalized(image.ownerId, image.id);
    const thumbnailKey = objectKeys.thumbnail(image.ownerId, image.id);
    await Promise.all([
      this.deps.storage.put(normalizedKey, normalized.jpeg, 'image/jpeg'),
      this.deps.storage.put(thumbnailKey, normalized.thumbnail, 'image/webp'),
    ]);
    return { normalizedKey, thumbnailKey };
  }

  private async cleanUp(
    image: ClaimedImage,
    outcome: FinalizeOutcome,
    keys: RenditionKeys,
  ): Promise<void> {
    const toDelete: (string | null)[] =
      outcome === 'deleted'
        ? [image.originalKey, keys.normalizedKey, keys.thumbnailKey]
        : outcome === 'superseded'
          ? []
          : [image.originalKey];

    const existing = toDelete.filter((key): key is string => key !== null);
    if (existing.length === 0) return;

    await this.deps.storage.deleteMany(existing).catch((error: unknown) => {
      this.deps.logger.warn({ err: error, imageId: image.id }, 'failed to clean up objects');
    });
  }
}
