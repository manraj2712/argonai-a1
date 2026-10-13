import type { PresignedUpload } from '@image-intake/shared';

export class StorageUploadError extends Error {
  constructor(readonly status: number) {
    super(
      status === 0 ? 'Network error while uploading' : `Storage rejected the upload (${status})`,
    );
    this.name = 'StorageUploadError';
  }
}

/**
 * Sends the file straight to object storage with the presigned POST policy. XHR rather than
 * fetch because fetch still can't report upload progress.
 */
export function uploadToStorage(
  upload: PresignedUpload,
  file: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  // S3 ignores every field after the file, so it has to go last
  form.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', upload.url);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new StorageUploadError(xhr.status));
    });
    xhr.addEventListener('error', () => {
      reject(new StorageUploadError(0));
    });
    xhr.send(form);
  });
}
