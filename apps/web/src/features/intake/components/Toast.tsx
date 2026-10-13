import { useEffect } from 'react';
import { CheckCircleIcon, CloseIcon } from './icons';

const VISIBLE_MS = 5000;

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-30 flex justify-end sm:inset-x-6"
    >
      {message && (
        <div className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-lg">
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-accept" />
          <p className="flex-1 text-sm font-semibold">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-m-1 rounded-md p-1 text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
