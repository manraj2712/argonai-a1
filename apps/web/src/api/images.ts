import {
  createImagesResponseSchema,
  imageResponseSchema,
  listImagesResponseSchema,
  sessionResponseSchema,
  type CreateImagesRequest,
  type ImageStatus,
} from '@image-intake/shared';
import { requestEmpty, requestJson } from './http';

export function startSession() {
  return requestJson('/api/sessions', sessionResponseSchema, { method: 'POST' });
}

export async function createUploadSlots(files: CreateImagesRequest['files']) {
  const { items } = await requestJson('/api/images', createImagesResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ files } satisfies CreateImagesRequest),
  });
  return items;
}

export async function completeUpload(imageId: string) {
  const { image } = await requestJson(`/api/images/${imageId}/complete`, imageResponseSchema, {
    method: 'POST',
  });
  return image;
}

export async function getImage(imageId: string) {
  const { image } = await requestJson(`/api/images/${imageId}`, imageResponseSchema);
  return image;
}

export function listImages(
  options: { statuses?: ImageStatus[]; limit?: number; cursor?: string | null } = {},
) {
  const query = new URLSearchParams();
  if (options.statuses) query.set('status', options.statuses.join(','));
  if (options.limit) query.set('limit', String(options.limit));
  if (options.cursor) query.set('cursor', options.cursor);
  return requestJson(`/api/images?${query.toString()}`, listImagesResponseSchema);
}

export function deleteImage(imageId: string) {
  return requestEmpty(`/api/images/${imageId}`, { method: 'DELETE' });
}
