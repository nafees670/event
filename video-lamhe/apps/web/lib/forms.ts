import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api/client';

/**
 * Maps an API error onto a react-hook-form: VALIDATION_ERROR details go to their fields,
 * everything else to `root.server`. Returns the message shown.
 */
export function applyServerError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fieldCodes: Partial<Record<string, Path<T>>> = {},
): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
      for (const d of err.details as { path: string; message: string }[]) {
        setError(d.path as Path<T>, { type: 'server', message: d.message });
      }
      return err.message;
    }
    const field = fieldCodes[err.code];
    if (field) {
      setError(field, { type: 'server', message: err.message });
      return err.message;
    }
    setError('root.server' as Path<T>, { type: 'server', message: err.message });
    return err.message;
  }
  const message = 'Network error — check your connection and try again.';
  setError('root.server' as Path<T>, { type: 'server', message });
  return message;
}
