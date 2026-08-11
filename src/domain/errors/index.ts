/**
 * Domain error types.
 *
 * These are the only errors the application layer is allowed to throw for
 * business-rule violations. The presentation layer maps them to HTTP status
 * codes — the domain itself knows nothing about HTTP.
 */

export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "DEMO_RESTRICTED";

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  /** Machine-readable detail for the client (field errors, conflicting ids, …). */
  readonly details?: Record<string, unknown>;

  protected constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

/** The input is structurally or semantically invalid. */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION" as const;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** The referenced aggregate does not exist (or is soft-deleted). */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND" as const;

  constructor(entity: string, identifier?: string) {
    super(
      identifier ? `${entity} "${identifier}" was not found.` : `${entity} was not found.`,
      { entity, identifier },
    );
  }
}

/** The operation conflicts with existing state (overlapping shift, duplicate code, …). */
export class ConflictError extends DomainError {
  readonly code = "CONFLICT" as const;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** The actor is authenticated but not allowed to perform this action. */
export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
  }
}

/** No (valid) actor on the request. */
export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "Authentication is required.") {
    super(message);
  }
}

/**
 * The action is legitimate but blocked because the app is running in public
 * demo mode (see §6 of the spec: demo guardrails).
 */
export class DemoRestrictedError extends DomainError {
  readonly code = "DEMO_RESTRICTED" as const;

  constructor(action: string) {
    super(
      `"${action}" is disabled on the public demo. Clone the repo and run it locally to try it.`,
      { action },
    );
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
