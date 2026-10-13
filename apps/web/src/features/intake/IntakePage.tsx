import { useCallback, useMemo, useState } from 'react';
import { AcceptedCounter } from './components/AcceptedCounter';
import { AppHeader } from './components/AppHeader';
import { DropZone } from './components/DropZone';
import { GuidelineCard } from './components/GuidelineCard';
import { BanIcon, CheckCircleIcon } from './components/icons';
import { PhotoGrid } from './components/PhotoGrid';
import { RejectedPanel } from './components/RejectedPanel';
import { Toast } from './components/Toast';
import { UploadList } from './components/UploadList';
import { isSettled } from './intake-reducer';
import { useImageIntake, type UploadSummary } from './use-image-intake';

const REQUIREMENTS = [
  'Just you, with your face clearly visible',
  'Sharp and in focus, in good light',
  'Close enough that your face fills a good part of the frame',
  'A mix of angles, outfits and backgrounds',
  'At least 512 pixels on the shortest side',
];

const RESTRICTIONS = [
  'No group photos or other people in the frame',
  'No blurry, dark or heavily filtered photos',
  'No shots taken from far away',
  'No duplicates or near-identical shots',
  'Only JPG, PNG and HEIC files',
];

function summaryMessage({ uploaded, failed }: UploadSummary): string | null {
  if (uploaded === 0) return null;
  const photos = uploaded === 1 ? 'Your photo has' : `${uploaded} photos have`;
  const failures = failed > 0 ? ` ${failed} couldn't be uploaded.` : '';
  return `${photos} been uploaded. We're checking them now.${failures}`;
}

export function IntakePage() {
  const intake = useImageIntake();
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const { inProgress, accepted, rejected } = intake.sections;
  // only photos added in this visit belong in the sidebar list and the header progress
  const sessionItems = useMemo(
    () => intake.items.filter((item) => item.localPreviewUrl !== null),
    [intake.items],
  );
  const settled = sessionItems.filter((item) => isSettled(item.phase)).length;
  const uploading = sessionItems.some(
    (item) => item.phase === 'queued' || item.phase === 'uploading',
  );
  const workingSet = [...inProgress, ...accepted];

  const handleFiles = (files: File[]) => {
    void intake.addFiles(files).then((summary) => {
      setToast(summaryMessage(summary));
    });
  };

  return (
    <>
      <AppHeader progress={sessionItems.length > 0 ? settled / sessionItems.length : 0} />

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr] lg:gap-0 lg:py-8">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start lg:border-r lg:border-line lg:pr-8">
          <DropZone disabled={!intake.ready} uploading={uploading} onFiles={handleFiles} />
          <UploadList items={sessionItems} />
        </aside>

        <div className="min-w-0 space-y-6 lg:pl-10">
          <AcceptedCounter accepted={accepted.length} />

          {intake.error && (
            <p
              role="alert"
              className="rounded-xl border border-reject-line bg-reject-tint px-4 py-3 text-sm text-reject"
            >
              {intake.error}
            </p>
          )}

          {workingSet.length > 0 ? (
            <section
              aria-label="Accepted photos"
              className="rounded-2xl border border-accept-line bg-accept-tint p-5 sm:p-6"
            >
              <PhotoGrid
                items={workingSet}
                label="Accepted and in-progress photos"
                onRemove={(key) => void intake.removeItem(key)}
              />
            </section>
          ) : (
            <div className="flex min-h-36 items-center justify-center rounded-2xl bg-surface px-6 text-center text-sm text-muted">
              {intake.ready
                ? 'Photos that pass our checks will show up here.'
                : 'Loading your photos…'}
            </div>
          )}

          {rejected.length > 0 && (
            <RejectedPanel
              items={rejected}
              acceptedCount={accepted.length}
              onRemove={(key) => void intake.removeItem(key)}
            />
          )}

          <GuidelineCard
            tone="accept"
            icon={<CheckCircleIcon className="size-5 text-accept-ink" />}
            title="Photo requirements"
            items={REQUIREMENTS}
          />
          <GuidelineCard
            tone="reject"
            icon={<BanIcon className="size-5 text-reject" />}
            title="Photo restrictions"
            items={RESTRICTIONS}
          />

          {intake.hasMore && (
            <button
              type="button"
              onClick={() => void intake.loadMore()}
              className="mx-auto block rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
            >
              Load older photos
            </button>
          )}
        </div>
      </main>

      <Toast message={toast} onDismiss={dismissToast} />
      <div aria-live="polite" className="sr-only">
        {intake.announcement}
      </div>
    </>
  );
}
