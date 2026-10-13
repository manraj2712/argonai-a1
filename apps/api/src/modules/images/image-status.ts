import type { ImageStatus } from '@image-intake/shared';

const ALLOWED_TRANSITIONS: Record<ImageStatus, readonly ImageStatus[]> = {
  awaiting_upload: ['pending'],
  pending: ['processing'],
  // processing → processing is a stale lease being reclaimed by another worker
  processing: ['processing', 'pending', 'accepted', 'rejected', 'failed'],
  accepted: [],
  rejected: [],
  failed: [],
};

export function canTransition(from: ImageStatus, to: ImageStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ImageStatus, to: ImageStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal image status transition ${from} → ${to}`);
  }
}
