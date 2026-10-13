export const IMAGE_FORMATS = ['jpeg', 'png', 'heic'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const MIME_TYPE_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
} as const satisfies Record<ImageFormat, string>;

export const ACCEPTED_MIME_TYPES = Object.values(MIME_TYPE_BY_FORMAT);
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// Browsers report an empty MIME type for HEIC, so the file picker filters by extension too.
export const ACCEPTED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'] as const;

export const IMAGE_RULES = {
  bytes: { min: 10 * 1024, max: 25 * 1024 * 1024 },
  minShortSide: 512,
  maxPixels: 70_000_000,
  maxFilesPerRequest: 20,
} as const;

/** How many accepted images an owner needs before moving on, and how many we ask for. */
export const ACCEPTED_SET_SIZE = { minimum: 6, target: 10 } as const;
