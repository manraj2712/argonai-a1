import { REJECTION_LABELS, REJECTION_MESSAGES } from '@image-intake/shared';
import type { IntakeItem } from '../intake-reducer';

interface Reason {
  label: string;
  detail: string;
}

export function reasonsFor(item: IntakeItem): Reason[] {
  if (item.phase === 'failed') {
    return [
      {
        label: "Couldn't check this photo",
        detail:
          'Something went wrong on our side, not with your photo. Remove it and upload it again.',
      },
    ];
  }
  if (item.phase === 'upload_failed') {
    return [{ label: 'Upload failed', detail: item.error ?? 'Remove it and upload it again.' }];
  }

  const codes = item.clientRejection
    ? [item.clientRejection]
    : item.checks.flatMap((check) => (check.reason ? [check.reason] : []));
  return codes.map((code) => ({ label: REJECTION_LABELS[code], detail: REJECTION_MESSAGES[code] }));
}

export function RejectionReasons({ item }: { item: IntakeItem }) {
  const reasons = reasonsFor(item);
  if (reasons.length === 0) return null;

  return (
    <ul className="space-y-0.5 text-center">
      {reasons.map(({ label, detail }) => (
        <li key={label} className="text-sm leading-snug">
          <span
            title={detail}
            className="underline decoration-subtle decoration-1 underline-offset-4"
          >
            {label}
          </span>
          <span className="sr-only">: {detail}</span>
        </li>
      ))}
    </ul>
  );
}
