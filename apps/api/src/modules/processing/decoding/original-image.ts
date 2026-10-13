import { sniffImageFormat, type ImageFormat } from '@image-intake/shared';
import type { ImageDecoder, ImageDimensions } from './image-decoder.js';

/** The bytes exactly as the owner uploaded them. Nothing here trusts what the client declared. */
export class OriginalImage {
  readonly format: ImageFormat | null;
  private dimensionsPromise: Promise<ImageDimensions> | null = null;

  constructor(
    readonly bytes: Buffer,
    private readonly decoder: ImageDecoder,
  ) {
    this.format = sniffImageFormat(bytes);
  }

  get sizeBytes(): number {
    return this.bytes.length;
  }

  /** Reads dimensions from the header only. Rejects with UnreadableImageError. */
  dimensions(): Promise<ImageDimensions> {
    const format = this.format;
    if (!format)
      return Promise.reject(new Error('Cannot read dimensions of an unrecognised format'));
    this.dimensionsPromise ??= this.decoder.readDimensions(this.bytes, format);
    return this.dimensionsPromise;
  }
}
