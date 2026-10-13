import { z } from 'zod';
import { ValidationError } from '../../core/errors.js';

export interface ImageCursor {
  createdAt: Date;
  id: string;
}

const cursorSchema = z.object({ c: z.iso.datetime(), i: z.uuid() });

export function encodeCursor(cursor: ImageCursor): string {
  const payload = { c: cursor.createdAt.toISOString(), i: cursor.id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(value: string): ImageCursor {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return { createdAt: new Date(parsed.c), id: parsed.i };
  } catch {
    throw new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);
  }
}
