import { ACCEPTED_FILE_EXTENSIONS, ACCEPTED_MIME_TYPES, IMAGE_RULES } from '@image-intake/shared';
import { useId, useState, type DragEvent } from 'react';
import { Spinner } from './icons';

const ACCEPT = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_FILE_EXTENSIONS].join(',');
const MAX_MB = IMAGE_RULES.bytes.max / (1024 * 1024);

interface DropZoneProps {
  disabled: boolean;
  uploading: boolean;
  onFiles: (files: File[]) => void;
}

export function DropZone({ disabled, uploading, onFiles }: DropZoneProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || uploading;

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!blocked && event.dataTransfer.files.length > 0) onFiles([...event.dataTransfer.files]);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={handleDrop}
      className={[
        'flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
        dragging ? 'border-brand bg-brand-tint' : 'border-line bg-white',
      ].join(' ')}
    >
      <label
        htmlFor={inputId}
        className={[
          'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand',
          blocked
            ? 'cursor-not-allowed bg-brand/60'
            : 'cursor-pointer bg-brand hover:bg-brand-strong',
        ].join(' ')}
      >
        {uploading && <Spinner className="size-4" />}
        {uploading ? 'Uploading…' : 'Upload photos'}
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={blocked}
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            // reset so picking the same file again still fires a change
            event.target.value = '';
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">Click to upload or drag and drop</p>
        <p className="text-sm text-muted">PNG, JPG, HEIC up to {MAX_MB}MB</p>
      </div>
    </div>
  );
}
