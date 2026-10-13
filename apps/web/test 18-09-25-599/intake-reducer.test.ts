import type { ImageDto } from '@image-intake/shared';
import { describe, expect, it } from 'vitest';
import {
  initialIntakeState,
  intakeReducer,
  sectionOf,
  type IntakeAction,
  type IntakeItem,
  type IntakeState,
} from '../src/features/intake/intake-reducer';

const IMAGE_ID = '0d8f6a52-8c1b-4f2e-9b7a-1f4c3e2d5a6b';

function localItem(overrides: Partial<IntakeItem> = {}): IntakeItem {
  return {
    key: 'local-1',
    imageId: null,
    filename: 'me.jpg',
    phase: 'queued',
    progress: 0,
    localPreviewUrl: 'blob:preview',
    thumbnailUrl: null,
    checks: [],
    clientRejection: null,
    error: null,
    createdAt: '2026-10-13T10:00:00.000Z',
    ...overrides,
  };
}

function serverImage(overrides: Partial<ImageDto> = {}): ImageDto {
  return {
    id: IMAGE_ID,
    filename: 'me.jpg',
    status: 'pending',
    format: null,
    width: null,
    height: null,
    thumbnailUrl: null,
    checks: [],
    createdAt: '2026-10-13T10:00:00.000Z',
    processedAt: null,
    ...overrides,
  };
}

function run(...actions: IntakeAction[]): IntakeState {
  return actions.reduce(intakeReducer, initialIntakeState);
}

describe('intakeReducer', () => {
  it('follows a file from the browser through to a server verdict', () => {
    const state = run(
      { type: 'filesAdded', items: [localItem()] },
      { type: 'slotGranted', key: 'local-1', image: serverImage({ status: 'awaiting_upload' }) },
      { type: 'uploadProgressed', key: 'local-1', progress: 0.5 },
      { type: 'imageUpdated', image: serverImage({ status: 'pending' }) },
      { type: 'statusChanged', imageId: IMAGE_ID, status: 'processing' },
      {
        type: 'imageUpdated',
        image: serverImage({ status: 'accepted', thumbnailUrl: 'https://thumb' }),
      },
    );

    expect(state.order).toEqual(['local-1']);
    expect(state.items['local-1']).toMatchObject({
      imageId: IMAGE_ID,
      phase: 'accepted',
      thumbnailUrl: 'https://thumb',
      localPreviewUrl: 'blob:preview',
    });
  });

  it('ignores a stale status that arrives after a newer one', () => {
    const state = run(
      { type: 'filesAdded', items: [localItem()] },
      { type: 'slotGranted', key: 'local-1', image: serverImage({ status: 'awaiting_upload' }) },
      { type: 'statusChanged', imageId: IMAGE_ID, status: 'processing' },
      // the response to "complete" can land after the worker already picked the image up
      { type: 'imageUpdated', image: serverImage({ status: 'pending' }) },
    );

    expect(state.items['local-1']?.phase).toBe('processing');
  });

  it('adds images it has not seen before, newest first', () => {
    const state = run(
      {
        type: 'pageLoaded',
        images: [serverImage({ id: 'a', status: 'accepted' })],
        nextCursor: 'next',
      },
      { type: 'imageUpdated', image: serverImage({ id: 'b', status: 'rejected' }) },
    );

    expect(state.order).toEqual(['b', 'a']);
    expect(state.nextCursor).toBe('next');
  });

  it('marks a failed upload with its message', () => {
    const state = run(
      { type: 'filesAdded', items: [localItem()] },
      { type: 'uploadFailed', key: 'local-1', message: 'Network error' },
    );

    expect(state.items['local-1']).toMatchObject({
      phase: 'upload_failed',
      error: 'Network error',
    });
  });

  it('forgets everything about a removed item', () => {
    const state = run(
      { type: 'filesAdded', items: [localItem()] },
      { type: 'slotGranted', key: 'local-1', image: serverImage() },
      { type: 'itemRemoved', key: 'local-1' },
      { type: 'statusChanged', imageId: IMAGE_ID, status: 'accepted' },
    );

    expect(state).toEqual({ ...initialIntakeState });
  });
});

describe('sectionOf', () => {
  it.each([
    ['queued', 'inProgress'],
    ['processing', 'inProgress'],
    ['upload_failed', 'rejected'],
    ['accepted', 'accepted'],
    ['rejected', 'rejected'],
    ['client_rejected', 'rejected'],
    ['failed', 'rejected'],
  ] as const)('puts %s in %s', (phase, section) => {
    expect(sectionOf(phase)).toBe(section);
  });
});
