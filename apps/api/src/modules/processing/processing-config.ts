import type { Env } from '../../config/env.js';

export interface ProcessingConfig {
  concurrency: number;
  maxAttempts: number;
  leaseSeconds: number;
  idlePollMs: number;
  sweepIntervalMs: number;
  abandonedUploadMinutes: number;
  normalizedMaxSide: number;
  thumbnailMaxSide: number;
  faceMinConfidence: number;
  faceMinAreaRatio: number;
  blurMinVariance: number;
  similarityMaxDistance: number;
}

// Thresholds were calibrated against test/fixtures; re-check them there before changing.
export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  concurrency: 2,
  maxAttempts: 3,
  leaseSeconds: 5 * 60,
  idlePollMs: 5_000,
  sweepIntervalMs: 10 * 60_000,
  abandonedUploadMinutes: 60,
  normalizedMaxSide: 2048,
  thumbnailMaxSide: 400,
  faceMinConfidence: 0.5,
  faceMinAreaRatio: 0.015,
  blurMinVariance: 60,
  similarityMaxDistance: 6,
};

export function processingConfigFromEnv(env: Env): ProcessingConfig {
  const defaults = DEFAULT_PROCESSING_CONFIG;
  return {
    ...defaults,
    concurrency: env.WORKER_CONCURRENCY,
    faceMinConfidence: env.FACE_MIN_CONFIDENCE ?? defaults.faceMinConfidence,
    faceMinAreaRatio: env.FACE_MIN_AREA_RATIO ?? defaults.faceMinAreaRatio,
    blurMinVariance: env.BLUR_MIN_VARIANCE ?? defaults.blurMinVariance,
    similarityMaxDistance: env.SIMILARITY_MAX_DISTANCE ?? defaults.similarityMaxDistance,
  };
}
