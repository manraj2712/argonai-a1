import { CHECK_CODES, type ImageDto } from '@image-intake/shared';
import type { ImageWithResults } from './images.repository.js';

export function toImageDto(image: ImageWithResults, thumbnailUrl: string | null): ImageDto {
  const checks = [...image.checkResults]
    .sort((a, b) => CHECK_CODES.indexOf(a.checkCode) - CHECK_CODES.indexOf(b.checkCode))
    .map((result) => ({
      code: result.checkCode,
      outcome: result.outcome,
      reason: result.reason,
      measurement: result.measurement as Record<string, unknown>,
    }));

  return {
    id: image.id,
    filename: image.originalFilename,
    status: image.status,
    format: image.format,
    width: image.width,
    height: image.height,
    thumbnailUrl,
    checks,
    createdAt: image.createdAt.toISOString(),
    processedAt: image.processedAt?.toISOString() ?? null,
  };
}
