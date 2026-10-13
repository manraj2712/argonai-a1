import { BrandMark } from './icons';

interface AppHeaderProps {
  /** Share of this session's photos that have finished uploading and checking, 0..1. */
  progress: number;
}

export function AppHeader({ progress }: AppHeaderProps) {
  const percent = Math.round(progress * 100);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <a
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-brand"
        >
          <BrandMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Aragon.ai</span>
        </a>
        <div
          role="progressbar"
          aria-label="Photos uploaded and checked"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mx-auto hidden h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-line sm:block"
        >
          <div
            className="h-full rounded-full bg-brand-progress transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </header>
  );
}
