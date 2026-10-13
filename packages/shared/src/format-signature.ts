import type { ImageFormat } from './image-rules.js';

export const SIGNATURE_BYTES_NEEDED = 12;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

// mif1/msf1 are the generic HEIF brands; iPhones write "heic" but some converters only write mif1.
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** Identifies the real format from the leading bytes, ignoring whatever the file claims to be. */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < SIGNATURE_BYTES_NEEDED) return null;
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (ascii(bytes, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(bytes, 8, 12))) return 'heic';
  return null;
}
