import { ACCEPTED_SET_SIZE } from '@image-intake/shared';
import { useId, useState } from 'react';
import type { IntakeItem } from '../intake-reducer';
import { ChevronDownIcon } from './icons';
import { PhotoGrid } from './PhotoGrid';

interface RejectedPanelProps {
  items: IntakeItem[];
  acceptedCount: number;
  onRemove: (key: string) => void;
}

function guidance(acceptedCount: number): string {
  const { minimum } = ACCEPTED_SET_SIZE;
  if (acceptedCount >= minimum) {
    return `You can move to the next step since you've uploaded ${acceptedCount} good photos. Replacing these is optional.`;
  }
  const missing = minimum - acceptedCount;
  return `You need ${missing} more good ${missing === 1 ? 'photo' : 'photos'}. Replace these with ones that follow the requirements below.`;
}

export function RejectedPanel({ items, acceptedCount, onRemove }: RejectedPanelProps) {
  const [open, setOpen] = useState(true);
  const contentId = useId();

  return (
    <section className="rounded-2xl border border-reject-line bg-reject-tint p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Some photos didn't meet our guidelines</h2>
          <p className="text-sm text-muted">{guidance(acceptedCount)}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={open ? 'Hide photos that need replacing' : 'Show photos that need replacing'}
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="-m-1.5 shrink-0 rounded-lg p-1.5 hover:bg-reject-line focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ChevronDownIcon className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div id={contentId} hidden={!open} className="mt-5">
        <PhotoGrid items={items} label="Photos that need replacing" onRemove={onRemove} />
      </div>
    </section>
  );
}
