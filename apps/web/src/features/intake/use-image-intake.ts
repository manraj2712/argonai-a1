import {
  IMAGE_RULES,
  isTerminalStatus,
  type AcceptedMimeType,
  type StatusEvent,
} from '@image-intake/shared';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ApiError } from '../../api/http';
import {
  completeUpload,
  createUploadSlots,
  deleteImage,
  getImage,
  listImages,
  startSession,
} from '../../api/images';
import { uploadToStorage } from '../../api/upload-to-storage';
import { chunk } from '../../lib/chunk';
import { runWithConcurrency } from '../../lib/run-with-concurrency';
import {
  initialIntakeState,
  intakeReducer,
  sectionOf,
  type IntakeItem,
  type IntakeSection,
} from './intake-reducer';
import { precheckFile } from './precheck';
import { useStatusEvents } from './use-status-events';

const PAGE_SIZE = 60;
const PARALLEL_UPLOADS = 3;

type UploadSlot = Awaited<ReturnType<typeof createUploadSlots>>[number];

interface PendingUpload {
  key: string;
  file: File;
  mimeType: AcceptedMimeType;
}

export interface UploadSummary {
  uploaded: number;
  failed: number;
}

export interface ImageIntake {
  /** Newest first. */
  items: IntakeItem[];
  sections: Record<IntakeSection, IntakeItem[]>;
  ready: boolean;
  error: string | null;
  announcement: string;
  hasMore: boolean;
  addFiles: (files: File[]) => Promise<UploadSummary>;
  removeItem: (key: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useImageIntake(): ImageIntake {
  const [state, dispatch] = useReducer(intakeReducer, initialIntakeState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const objectUrls = useRef(new Map<string, string>());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    let cancelled = false;
    startSession()
      .then(() => listImages({ limit: PAGE_SIZE }))
      .then((page) => {
        if (cancelled) return;
        dispatch({ type: 'pageLoaded', images: page.items, nextCursor: page.nextCursor });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't reach the server. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  const refreshImage = useCallback(async (imageId: string) => {
    const image = await getImage(imageId).catch(() => null);
    if (!image) return;
    dispatch({ type: 'imageUpdated', image });
    if (isTerminalStatus(image.status)) {
      setAnnouncement(
        `${image.filename} was ${image.status === 'failed' ? 'not processed' : image.status}.`,
      );
    }
  }, []);

  useStatusEvents(ready, {
    onStatus: (event: StatusEvent) => {
      dispatch({ type: 'statusChanged', imageId: event.imageId, status: event.status });
      // the event only carries the status; results and the thumbnail come from the API
      if (isTerminalStatus(event.status)) void refreshImage(event.imageId);
    },
    onReconnect: () => {
      for (const item of Object.values(stateRef.current.items)) {
        if (item.imageId && (item.phase === 'pending' || item.phase === 'processing')) {
          void refreshImage(item.imageId);
        }
      }
    },
  });

  const uploadOne = useCallback(
    async (upload: PendingUpload, slot: UploadSlot): Promise<boolean> => {
      dispatch({ type: 'slotGranted', key: upload.key, image: slot.image });
      try {
        await uploadToStorage(slot.upload, upload.file, (progress) => {
          dispatch({ type: 'uploadProgressed', key: upload.key, progress });
        });
        dispatch({ type: 'imageUpdated', image: await completeUpload(slot.image.id) });
        return true;
      } catch (uploadError) {
        dispatch({ type: 'uploadFailed', key: upload.key, message: describe(uploadError) });
        return false;
      }
    },
    [],
  );

  const addFiles = useCallback(
    async (files: File[]): Promise<UploadSummary> => {
      const summary: UploadSummary = { uploaded: 0, failed: 0 };
      const now = new Date().toISOString();
      const prechecked = await Promise.all(
        files.map(async (file) => ({ file, result: await precheckFile(file) })),
      );

      const items: IntakeItem[] = [];
      const uploads: PendingUpload[] = [];
      for (const { file, result } of prechecked) {
        const key = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.set(key, previewUrl);
        items.push({
          key,
          imageId: null,
          filename: file.name,
          phase: result.ok ? 'queued' : 'client_rejected',
          progress: 0,
          localPreviewUrl: previewUrl,
          thumbnailUrl: null,
          checks: [],
          clientRejection: result.ok ? null : result.reason,
          error: null,
          createdAt: now,
        });
        if (result.ok) uploads.push({ key, file, mimeType: result.mimeType });
      }
      dispatch({ type: 'filesAdded', items });

      for (const batch of chunk(uploads, IMAGE_RULES.maxFilesPerRequest)) {
        let slots;
        try {
          slots = await createUploadSlots(
            batch.map(({ file, mimeType }) => ({
              filename: file.name.slice(0, 255) || 'photo',
              mimeType,
              sizeBytes: file.size,
            })),
          );
        } catch (slotError) {
          for (const { key } of batch)
            dispatch({ type: 'uploadFailed', key, message: describe(slotError) });
          summary.failed += batch.length;
          continue;
        }
        const pairs = batch.flatMap((upload, index) => {
          const slot = slots[index];
          return slot ? [{ upload, slot }] : [];
        });
        await runWithConcurrency(pairs, PARALLEL_UPLOADS, async ({ upload, slot }) => {
          if (await uploadOne(upload, slot)) summary.uploaded++;
          else summary.failed++;
        });
      }
      return summary;
    },
    [uploadOne],
  );

  const removeItem = useCallback(async (key: string) => {
    const item = stateRef.current.items[key];
    if (!item) return;
    if (item.imageId) {
      try {
        await deleteImage(item.imageId);
      } catch (deleteError) {
        if (!(deleteError instanceof ApiError && deleteError.status === 404)) {
          setError(`Couldn't remove ${item.filename}. Try again.`);
          return;
        }
      }
    }
    const url = objectUrls.current.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(key);
    }
    dispatch({ type: 'itemRemoved', key });
  }, []);

  const loadMore = useCallback(async () => {
    const cursor = stateRef.current.nextCursor;
    if (!cursor) return;
    const page = await listImages({ limit: PAGE_SIZE, cursor });
    dispatch({ type: 'pageLoaded', images: page.items, nextCursor: page.nextCursor });
  }, []);

  const items = useMemo(
    () => state.order.flatMap((key) => state.items[key] ?? []),
    [state.items, state.order],
  );

  const sections = useMemo(() => {
    const grouped: Record<IntakeSection, IntakeItem[]> = {
      inProgress: [],
      accepted: [],
      rejected: [],
    };
    for (const item of items) grouped[sectionOf(item.phase)].push(item);
    return grouped;
  }, [items]);

  return {
    items,
    sections,
    ready,
    error,
    announcement,
    hasMore: state.nextCursor !== null,
    addFiles,
    removeItem,
    loadMore,
  };
}

function describe(error: unknown): string {
  if (error instanceof ApiError && error.status === 429)
    return 'Too many uploads at once. Wait a moment and retry.';
  return error instanceof Error ? error.message : 'Upload failed';
}
