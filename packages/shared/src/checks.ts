export const CHECK_CODES = [
  'file_size',
  'format',
  'resolution',
  'blur',
  'face_count',
  'face_size',
  'similarity',
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

export const CHECK_OUTCOMES = ['passed', 'failed', 'skipped'] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number];

export const REJECTION_REASONS = [
  'file_too_small',
  'file_too_large',
  'unsupported_format',
  'unreadable_image',
  'resolution_too_low',
  'resolution_too_high',
  'blurry',
  'no_face',
  'multiple_faces',
  'face_too_small',
  'too_similar',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** Short enough to sit under a thumbnail; the full message explains how to fix it. */
export const REJECTION_LABELS: Record<RejectionReason, string> = {
  file_too_small: 'File is too small',
  file_too_large: 'File is too large',
  unsupported_format: 'Unsupported file type',
  unreadable_image: "Couldn't open this file",
  resolution_too_low: 'Resolution is too low',
  resolution_too_high: 'Image is too large to process',
  blurry: 'Blurry face detected',
  no_face: 'No face detected',
  multiple_faces: 'More than one face',
  face_too_small: 'Face is too far away',
  too_similar: 'Too similar to another upload',
};

export const REJECTION_MESSAGES: Record<RejectionReason, string> = {
  file_too_small: 'The file is too small to be a usable photo.',
  file_too_large: 'The file is larger than 25 MB.',
  unsupported_format: 'Only JPEG, PNG and HEIC photos are supported.',
  unreadable_image: "The file looks like an image but couldn't be opened.",
  resolution_too_low: 'The photo needs to be at least 512 pixels on its shortest side.',
  resolution_too_high: 'The photo has too many pixels to process.',
  blurry: 'The photo is too blurry.',
  no_face: "We couldn't find a face in this photo.",
  multiple_faces: 'More than one face is visible. Use a photo of just you.',
  face_too_small: 'Your face is too small in the frame. Try a closer shot.',
  too_similar: "This photo is almost identical to one you've already added.",
};
