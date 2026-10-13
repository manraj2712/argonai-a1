import type { ImageFormat } from '@image-intake/shared';
import decodeHeic, { type LazyImage } from 'heic-decode';
import sharp, { type Sharp } from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
}

export class UnreadableImageError extends Error {
  constructor(cause: unknown) {
    super('Image could not be decoded', { cause });
    this.name = 'UnreadableImageError';
  }
}

export class PixelLimitExceededError extends Error {
  constructor(dimensions: ImageDimensions) {
    super(`Image is ${dimensions.width}x${dimensions.height}, over the pixel limit`);
    this.name = 'PixelLimitExceededError';
  }
}

/**
 * sharp handles JPEG and PNG. Its prebuilt libheif has no HEVC decoder, so HEIC goes
 * through heic-decode instead (ADR-0004).
 */
export class ImageDecoder {
  constructor(private readonly maxPixels: number) {}

  async readDimensions(bytes: Buffer, format: ImageFormat): Promise<ImageDimensions> {
    try {
      if (format === 'heic') {
        return await this.withHeicPrimary(bytes, ({ width, height }) => ({ width, height }));
      }
      const { width, height } = await sharp(bytes, {
        failOn: 'error',
        limitInputPixels: false,
      }).metadata();
      return { width, height };
    } catch (error) {
      throw new UnreadableImageError(error);
    }
  }

  /** Returns a sharp pipeline over the decoded pixels; sharp itself decodes lazily. */
  async decode(bytes: Buffer, format: ImageFormat): Promise<Sharp> {
    if (format !== 'heic') {
      return sharp(bytes, { failOn: 'error', limitInputPixels: this.maxPixels });
    }

    const decoded = await this.withHeicPrimary(bytes, (image) => {
      // dimensions come from the container, so this check runs before any pixels are decoded
      if (image.width * image.height > this.maxPixels) throw new PixelLimitExceededError(image);
      return image.decode();
    });
    const pixels = Buffer.from(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength,
    );
    return sharp(pixels, { raw: { width: decoded.width, height: decoded.height, channels: 4 } });
  }

  private async withHeicPrimary<T>(
    bytes: Buffer,
    use: (image: LazyImage) => Promise<T> | T,
  ): Promise<T> {
    const images = await decodeHeic.all({ buffer: bytes });
    try {
      const primary = images[0];
      if (!primary) throw new Error('HEIC container has no images');
      return await use(primary);
    } finally {
      images.dispose();
    }
  }
}
