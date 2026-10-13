import type { CheckResultDto, ImageDto, ImageStatus, RejectionReason } from '@image-intake/shared';

/** Phases that only exist in the browser, before or instead of the server knowing about a file. */
export type ClientPhase = 'queued' | 'uploading' | 'upload_failed' | 'client_rejected';
export type IntakePhase = ClientPhase | ImageStatus;

export interface IntakeItem {
  key: string;
  imageId: string | null;
  filename: string;
  phase: IntakePhase;
  progress: number;
  localPreviewUrl: string | null;
  thumbnailUrl: string | null;
  checks: CheckResultDto[];
  clientRejection: RejectionReason | null;
  error: string | null;
  createdAt: string;
}

export interface IntakeState {
  items: Record<string, IntakeItem>;
  /** Newest first. */
  order: string[];
  keyByImageId: Record<string, string>;
  nextCursor: string | null;
}

export type IntakeAction =
  | { type: 'filesAdded'; items: IntakeItem[] }
  | { type: 'slotGranted'; key: string; image: ImageDto }
  | { type: 'uploadProgressed'; key: string; progress: number }
  | { type: 'uploadFailed'; key: string; message: string }
  | { type: 'pageLoaded'; images: ImageDto[]; nextCursor: string | null }
  | { type: 'imageUpdated'; image: ImageDto }
  | { type: 'statusChanged'; imageId: string; status: ImageStatus }
  | { type: 'itemRemoved'; key: string };

export const initialIntakeState: IntakeState = {
  items: {},
  order: [],
  keyByImageId: {},
  nextCursor: null,
};

// Status events and HTTP responses race each other, so an update may arrive late.
// A phase never moves backwards; terminal phases share a rank because they never follow one another.
const PHASE_RANK: Record<IntakePhase, number> = {
  queued: 0,
  upload_failed: 1,
  uploading: 1,
  awaiting_upload: 1,
  pending: 2,
  processing: 3,
  accepted: 4,
  rejected: 4,
  failed: 4,
  client_rejected: 4,
};

function advance(current: IntakePhase, next: IntakePhase): IntakePhase {
  return PHASE_RANK[next] >= PHASE_RANK[current] ? next : current;
}

function upsertImage(state: IntakeState, image: ImageDto, prepend: boolean): IntakeState {
  const key = state.keyByImageId[image.id] ?? image.id;
  const existing = state.items[key];

  const item: IntakeItem = {
    key,
    imageId: image.id,
    filename: image.filename,
    phase: existing ? advance(existing.phase, image.status) : image.status,
    progress: existing?.progress ?? 1,
    localPreviewUrl: existing?.localPreviewUrl ?? null,
    thumbnailUrl: image.thumbnailUrl ?? existing?.thumbnailUrl ?? null,
    checks: image.checks.length > 0 ? image.checks : (existing?.checks ?? []),
    clientRejection: null,
    error: null,
    createdAt: image.createdAt,
  };

  return {
    ...state,
    items: { ...state.items, [key]: item },
    order: existing ? state.order : prepend ? [key, ...state.order] : [...state.order, key],
    keyByImageId: { ...state.keyByImageId, [image.id]: key },
  };
}

function updateItem(
  state: IntakeState,
  key: string,
  update: (item: IntakeItem) => IntakeItem,
): IntakeState {
  const item = state.items[key];
  return item ? { ...state, items: { ...state.items, [key]: update(item) } } : state;
}

export function intakeReducer(state: IntakeState, action: IntakeAction): IntakeState {
  switch (action.type) {
    case 'filesAdded': {
      const items = { ...state.items };
      for (const item of action.items) items[item.key] = item;
      return { ...state, items, order: [...action.items.map((item) => item.key), ...state.order] };
    }

    case 'slotGranted': {
      const granted = updateItem(state, action.key, (item) => ({
        ...item,
        imageId: action.image.id,
        phase: 'uploading',
        createdAt: action.image.createdAt,
      }));
      return {
        ...granted,
        keyByImageId: { ...granted.keyByImageId, [action.image.id]: action.key },
      };
    }

    case 'uploadProgressed':
      return updateItem(state, action.key, (item) => ({ ...item, progress: action.progress }));

    case 'uploadFailed':
      return updateItem(state, action.key, (item) => ({
        ...item,
        phase: 'upload_failed',
        error: action.message,
      }));

    case 'pageLoaded': {
      const loaded = action.images.reduce((next, image) => upsertImage(next, image, false), state);
      return { ...loaded, nextCursor: action.nextCursor };
    }

    case 'imageUpdated':
      return upsertImage(state, action.image, true);

    case 'statusChanged': {
      const key = state.keyByImageId[action.imageId];
      if (!key) return state;
      return updateItem(state, key, (item) => ({
        ...item,
        phase: advance(item.phase, action.status),
      }));
    }

    case 'itemRemoved': {
      const { [action.key]: removed, ...items } = state.items;
      if (!removed) return state;
      const keyByImageId = Object.fromEntries(
        Object.entries(state.keyByImageId).filter(([imageId]) => imageId !== removed.imageId),
      );
      return {
        ...state,
        items,
        order: state.order.filter((key) => key !== action.key),
        keyByImageId,
      };
    }
  }
}

export type IntakeSection = 'inProgress' | 'accepted' | 'rejected';

export function isSettled(phase: IntakePhase): boolean {
  return sectionOf(phase) !== 'inProgress';
}

export function sectionOf(phase: IntakePhase): IntakeSection {
  switch (phase) {
    case 'accepted':
      return 'accepted';
    case 'rejected':
    case 'failed':
    case 'client_rejected':
    case 'upload_failed':
      return 'rejected';
    default:
      return 'inProgress';
  }
}
