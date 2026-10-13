import { describe, expect, it } from 'vitest';
import { precheckFile } from '../src/features/intake/precheck';

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const ascii = (text: string) => Array.from(new TextEncoder().encode(text));
const HEIC_HEAD = [0, 0, 0, 0x18, ...ascii('ftypheic')];

function file(head: number[], size: number, type = ''): Blob {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return new Blob([bytes], { type });
}

describe('precheckFile', () => {
  it('accepts a JPEG within the size limits', async () => {
    expect(await precheckFile(file(JPEG_HEAD, 50_000))).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
    });
  });

  it('works out the MIME type for a HEIC the browser left untyped', async () => {
    expect(await precheckFile(file(HEIC_HEAD, 50_000, ''))).toEqual({
      ok: true,
      mimeType: 'image/heic',
    });
  });

  it('rejects a GIF even when it claims to be a JPEG', async () => {
    const gif = file(ascii('GIF89a'), 50_000, 'image/jpeg');
    expect(await precheckFile(gif)).toEqual({ ok: false, reason: 'unsupported_format' });
  });

  it('rejects files outside the size limits', async () => {
    expect(await precheckFile(file(JPEG_HEAD, 1_000))).toEqual({
      ok: false,
      reason: 'file_too_small',
    });
    expect(await precheckFile(file(JPEG_HEAD, 26 * 1024 * 1024))).toEqual({
      ok: false,
      reason: 'file_too_large',
    });
  });
});
