import sharp from 'sharp';
import { UnreadableImageError, type ImageDecoder } from './image-decoder.js';
import type { OriginalImage } from './original-image.js';

export interface NormalizedImage {
  jpeg: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}

export interface NormalizerOptions {
  maxSide: number;
  thumbnailMaxSide: number;
}

/**
 * Re-encodes the original so nothing downstream ever touches the uploaded bytes:
 * EXIF orientation is applied and then all metadata (GPS, embedded payloads) is dropped.
 */
export class ImageNormalizer {
  constructor(
    private readonly decoder: ImageDecoder,
    private readonly options: NormalizerOptions,
  ) {}

  async normalize(original: OriginalImage): Promise<NormalizedImage> {
    if (!original.format) throw new UnreadableImageError('unrecognised format');
    const { maxSide, thumbnailMaxSide } = this.options;

    let jpeg: Buffer;
    let width: number;
    let height: number;
    try {
      const pipeline = await this.decoder.decode(original.bytes, original.format);
      const result = await pipeline
        .rotate()
        .toColourspace('srgb')
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      ({
        data: jpeg,
        info: { width, height },
      } = result);
    } catch (error) {
      throw error instanceof UnreadableImageError ? error : new UnreadableImageError(error);
    }

    const thumbnail = await sharp(jpeg)
      .resize({ width: thumbnailMaxSide, height: thumbnailMaxSide, fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();

    return { jpeg, thumbnail, width, height };
  }
}
