import { problemDetailsSchema, type ProblemDetails } from '@image-intake/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: ProblemDetails['issues'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requestJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  init: RequestInit = {},
): Promise<z.infer<Schema>> {
  const response = await send(path, init);
  return schema.parse(await response.json());
}

export async function requestEmpty(path: string, init: RequestInit = {}): Promise<void> {
  await send(path, init);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) throw await toApiError(response);
  return response;
}

async function toApiError(response: Response): Promise<ApiError> {
  const problem = problemDetailsSchema.safeParse(await response.json().catch(() => null));
  return problem.success
    ? new ApiError(response.status, problem.data.code, problem.data.title, problem.data.issues)
    : new ApiError(response.status, 'unknown', `Request failed with status ${response.status}`);
}
