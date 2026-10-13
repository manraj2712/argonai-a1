import {
  IMAGE_RULES,
  MIME_TYPE_BY_FORMAT,
  SIGNATURE_BYTES_NEEDED,
  sniffImageFormat,
  type AcceptedMimeType,
  type RejectionReason,
} from '@image-intake/shared';

export type PrecheckResult =
  { ok: true; mimeType: AcceptedMimeType } | { ok: false; reason: RejectionReason };

/**
 * The browser-side half of the format and size gates. It uses the same signature table as the
 * server, and reports the MIME type from the bytes because browsers often leave HEIC's empty.
 */
export async function precheckFile(file: Blob): Promise<PrecheckResult> {
  const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES_NEEDED).arrayBuffer());
  const format = sniffImageFormat(head);

  if (!format) return { ok: false, reason: 'unsupported_format' };
  if (file.size < IMAGE_RULES.bytes.min) return { ok: false, reason: 'file_too_small' };
  if (file.size > IMAGE_RULES.bytes.max) return { ok: false, reason: 'file_too_large' };
  return { ok: true, mimeType: MIME_TYPE_BY_FORMAT[format] };
}
