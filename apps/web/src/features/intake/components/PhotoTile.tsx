import { useState } from 'react';
import type { IntakeItem } from '../intake-reducer';
import { PhotoIcon, Spinner, TrashIcon } from './icons';
import { RejectionReasons } from './RejectionReasons';

interface PhotoTileProps {
  item: IntakeItem;
  onRemove: (key: string) => void;
}

function progressLabel(item: IntakeItem): string | null {
  switch (item.phase) {
    case 'queued':
      return 'Waiting';
    case 'uploading':
    case 'awaiting_upload':
      return `Uploading ${Math.round(item.progress * 100)}%`;
    case 'pending':
    case 'processing':
      return 'Checking';
    default:
      return null;
  }
}

export function PhotoTile({ item, onRemove }: PhotoTileProps) {
  // the server thumbnail is upright and always renders; the local preview may be a HEIC
  // this browser can't display
  const previewUrl = item.thumbnailUrl ?? item.localPreviewUrl;
  const busy = progressLabel(item);

  return (
    <li className="flex flex-col gap-2.5">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface">
        <Preview key={previewUrl} url={previewUrl} alt={item.filename} />
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/65 text-sm font-medium backdrop-blur-[2px]">
            <Spinner className="size-6 text-brand" />
            <span>{busy}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onRemove(item.key);
          }}
          aria-label={`Remove ${item.filename}`}
          className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-white text-ink shadow-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
      <RejectionReasons item={item} />
    </li>
  );
}

function Preview({ url, alt }: { url: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className="flex size-full items-center justify-center text-subtle">
        <PhotoIcon className="size-10" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        setBroken(true);
      }}
      className="size-full object-cover"
    />
  );
}
