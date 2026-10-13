import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/core/errors.js';
import { decodeCursor, encodeCursor } from '../../src/modules/images/image-cursor.js';

describe('image cursor', () => {
  it('round-trips', () => {
    const cursor = {
      createdAt: new Date('2026-10-13T10:00:00.123Z'),
      id: '6f1c7a5e-6d5b-4a8e-9c7d-3b2a1f0e9d8c',
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each(['not-base64!', Buffer.from('{"c":"yesterday","i":"x"}').toString('base64url')])(
    'rejects %s',
    (value) => {
      expect(() => decodeCursor(value)).toThrow(ValidationError);
    },
  );
});
