/**
 * Typed errors for @dusrel/image-core.
 *
 * Every public error is a DusrelImageError with a stable string `code`
 * (docs/API_DESIGN.md section 1, docs/ARCHITECTURE.md section 5). Raw
 * DOMExceptions and platform errors never cross the public API.
 */
export type DusrelErrorCode =
  | "aborted"
  | "decode-failed"
  | "encode-failed"
  | "invalid-input"
  | "invalid-options"
  | "platform-unsupported"
  | "plugin-failed"
  | "unsupported-format";

export class DusrelImageError extends Error {
  readonly code: DusrelErrorCode;

  constructor(code: DusrelErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "DusrelImageError";
    this.code = code;
    if (options && "cause" in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isDusrelImageError(value: unknown): value is DusrelImageError {
  return value instanceof DusrelImageError;
}

/** Throws the typed `aborted` error when the signal has fired. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DusrelImageError("aborted", "The operation was aborted.");
  }
}

/** Wraps an unknown platform failure in a typed error, preserving the cause. */
export function wrapError(
  code: DusrelErrorCode,
  message: string,
  cause: unknown,
): DusrelImageError {
  if (cause instanceof DusrelImageError) return cause;
  return new DusrelImageError(code, message, { cause });
}
