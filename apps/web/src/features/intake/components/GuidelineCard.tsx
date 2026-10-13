import type { ReactNode } from 'react';
import { ChevronDownIcon } from './icons';

interface GuidelineCardProps {
  tone: 'accept' | 'reject';
  icon: ReactNode;
  title: string;
  items: string[];
}

const TONES = {
  accept: 'border-accept-line bg-accept-tint',
  reject: 'border-reject-line bg-reject-tint',
} as const;

export function GuidelineCard({ tone, icon, title, items }: GuidelineCardProps) {
  return (
    <details className={`group rounded-2xl border ${TONES[tone]}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 font-semibold focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDownIcon className="size-5 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="space-y-2 px-5 pb-5 pl-12 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="list-disc marker:text-subtle">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}
