/**
 * Functional Result Pattern for Deterministic Error Handling
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T; readonly error?: never }
  | { readonly success: false; readonly data?: never; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}
