export const IMAGE_STATUSES = [
  'awaiting_upload',
  'pending',
  'processing',
  'accepted',
  'rejected',
  'failed',
] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

export const TERMINAL_STATUSES = ['accepted', 'rejected', 'failed'] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminalStatus(status: ImageStatus): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly ImageStatus[]).includes(status);
}
