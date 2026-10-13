import type { IntakeItem } from '../intake-reducer';
import { sectionOf } from '../intake-reducer';
import { CheckCircleIcon, CrossCircleIcon, PhotoIcon, Spinner } from './icons';

const SECTION_ICON = {
  inProgress: { Icon: null, label: 'In progress', className: 'text-brand' },
  accepted: { Icon: CheckCircleIcon, label: 'Accepted', className: 'text-accept' },
  rejected: { Icon: CrossCircleIcon, label: 'Not accepted', className: 'text-reject' },
} as const;

export function UploadList({ items }: { items: IntakeItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">It can take up to a minute to check each photo</p>
      <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {items.map((item) => {
          const { Icon, label, className } = SECTION_ICON[sectionOf(item.phase)];
          return (
            <li key={item.key} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted">
                <PhotoIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm leading-snug break-all">{item.filename}</span>
              <span className={`shrink-0 ${className}`} title={label}>
                {Icon ? <Icon className="size-5" /> : <Spinner className="size-4.5" />}
                <span className="sr-only">{label}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
