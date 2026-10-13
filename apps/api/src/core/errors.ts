export interface ErrorIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly issues?: ErrorIssue[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'not_found');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'conflict') {
    super(message, 409, code);
  }
}

export class ValidationError extends AppError {
  constructor(issues: ErrorIssue[], message = 'Request validation failed') {
    super(message, 422, 'validation_failed', issues);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Start a session first') {
    super(message, 401, 'unauthorized');
  }
}
