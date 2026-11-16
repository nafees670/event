import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { z } from "zod";

import { ApiError, errorMessage } from "@/lib/api/client";

export const emailSchema = z.string().trim().min(1, "Email is required.").email("Enter a valid email address.");
export const passwordSchema = z.string().min(8, "Use at least 8 characters.");

/** Only allow same-site relative redirects (blocks `//evil.com` and absolute URLs). */
export function safeNext(value: string | null, fallback = "/dashboard"): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * Copy backend field errors onto the form; returns the message for anything
 * that isn't tied to a known field.
 */
export function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: Path<T>[]): string | null {
  if (!(error instanceof ApiError)) return errorMessage(error);
  let matched = false;
  for (const field of fields) {
    const message = error.fieldError(field);
    if (message) {
      setError(field, { type: "server", message });
      matched = true;
    }
  }
  return matched ? null : error.message;
}
