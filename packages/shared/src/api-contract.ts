import { z } from 'zod';
import { CHECK_CODES, CHECK_OUTCOMES, REJECTION_REASONS } from './checks.js';
import { ACCEPTED_MIME_TYPES, IMAGE_FORMATS, IMAGE_RULES } from './image-rules.js';
import { IMAGE_STATUSES } from './image-status.js';

export const imageStatusSchema = z.enum(IMAGE_STATUSES);

export const createImagesRequestSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(255),
        mimeType: z.enum(ACCEPTED_MIME_TYPES),
        sizeBytes: z.number().int().min(IMAGE_RULES.bytes.min).max(IMAGE_RULES.bytes.max),
      }),
    )
    .min(1)
    .max(IMAGE_RULES.maxFilesPerRequest),
});
export type CreateImagesRequest = z.infer<typeof createImagesRequestSchema>;

export const imageIdParamsSchema = z.object({ id: z.uuid() });

export const listImagesQuerySchema = z.object({
  status: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.array(imageStatusSchema).min(1))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});
export type ListImagesQuery = z.infer<typeof listImagesQuerySchema>;

export const checkResultDtoSchema = z.object({
  code: z.enum(CHECK_CODES),
  outcome: z.enum(CHECK_OUTCOMES),
  reason: z.enum(REJECTION_REASONS).nullable(),
  measurement: z.record(z.string(), z.unknown()),
});
export type CheckResultDto = z.infer<typeof checkResultDtoSchema>;

export const imageDtoSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  status: imageStatusSchema,
  format: z.enum(IMAGE_FORMATS).nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  thumbnailUrl: z.string().nullable(),
  checks: z.array(checkResultDtoSchema),
  createdAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
});
export type ImageDto = z.infer<typeof imageDtoSchema>;

export const presignedUploadSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});
export type PresignedUpload = z.infer<typeof presignedUploadSchema>;

export const createImagesResponseSchema = z.object({
  items: z.array(z.object({ image: imageDtoSchema, upload: presignedUploadSchema })),
});
export type CreateImagesResponse = z.infer<typeof createImagesResponseSchema>;

export const imageResponseSchema = z.object({ image: imageDtoSchema });
export type ImageResponse = z.infer<typeof imageResponseSchema>;

export const listImagesResponseSchema = z.object({
  items: z.array(imageDtoSchema),
  nextCursor: z.string().nullable(),
});
export type ListImagesResponse = z.infer<typeof listImagesResponseSchema>;

export const sessionResponseSchema = z.object({ ownerId: z.uuid() });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const STATUS_EVENT_NAME = 'image.status';

export const statusEventSchema = z.object({
  imageId: z.uuid(),
  status: imageStatusSchema,
});
export type StatusEvent = z.infer<typeof statusEventSchema>;

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
