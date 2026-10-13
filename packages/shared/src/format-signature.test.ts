import { describe, expect, it } from 'vitest';
import { sniffImageFormat } from './format-signature.js';

function bytes(...values: (number | string)[]): Uint8Array {
  const out: number[] = [];
  for (const value of values) {
    if (typeof value === 'number') out.push(value);
    else for (let i = 0; i < value.length; i++) out.push(value.charCodeAt(i));
  }
  while (out.length < 16) out.push(0);
  return Uint8Array.from(out);
}

describe('sniffImageFormat', () => {
  it('recognises JPEG', () => {
    expect(sniffImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
  });

  it('recognises PNG', () => {
    expect(sniffImageFormat(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
  });

  it.each(['heic', 'heix', 'mif1'])('recognises HEIC with the %s brand', (brand) => {
    expect(sniffImageFormat(bytes(0, 0, 0, 0x18, 'ftyp', brand))).toBe('heic');
  });

  it('rejects AVIF even though it shares the ISO-BMFF container', () => {
    expect(sniffImageFormat(bytes(0, 0, 0, 0x18, 'ftyp', 'avif'))).toBeNull();
  });

  it('rejects GIF', () => {
    expect(sniffImageFormat(bytes('GIF89a'))).toBeNull();
  });

  it('rejects input shorter than the signature window', () => {
    expect(sniffImageFormat(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
});
