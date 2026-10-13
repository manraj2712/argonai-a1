import { ACCEPTED_SET_SIZE } from '@image-intake/shared';

export function AcceptedCounter({ accepted }: { accepted: number }) {
  const { minimum, target } = ACCEPTED_SET_SIZE;
  const fill = Math.min(accepted / target, 1);

  return (
    <div className="space-y-2">
      <div className="relative flex items-end justify-between">
        <h2 className="text-base font-semibold">Uploaded images</h2>
        <span
          className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center text-xs font-medium text-muted"
          style={{ left: `${(minimum / target) * 100}%` }}
          aria-hidden="true"
        >
          {minimum}
          <span className="h-1.5 w-px bg-subtle" />
        </span>
        <p className="text-sm font-semibold">
          {accepted} <span className="font-normal text-muted">of</span> {target}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={`Accepted photos, ${minimum} needed`}
        aria-valuenow={accepted}
        aria-valuemin={0}
        aria-valuemax={target}
        className="h-2 overflow-hidden rounded-full bg-surface"
      >
        <div
          className="h-full rounded-full bg-accept transition-[width] duration-500 ease-out"
          style={{ width: `${fill * 100}%` }}
        />
      </div>
    </div>
  );
}
