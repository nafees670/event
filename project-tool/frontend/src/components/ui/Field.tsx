import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

export const controlClass =
  "block w-full rounded-lg border bg-surface px-3 text-sm text-fg shadow-card transition-colors placeholder:text-subtle " +
  "hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted";

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  id: string;
  children: ReactNode;
}

function FieldWrapper({ label, error, hint, id, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="animate-fade-in text-[13px] text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldWrapper label={label} error={error} hint={hint} id={inputId}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(controlClass, "h-9", error ? "border-red-400 dark:border-red-500/60" : "border-border", className)}
        {...props}
      />
    </FieldWrapper>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, id, className, children, ...props },
  ref,
) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <FieldWrapper label={label} error={error} hint={hint} id={selectId}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "h-9 appearance-none pr-9", error ? "border-red-400" : "border-border", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
      </div>
    </FieldWrapper>
  );
});

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, id, className, rows = 3, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldWrapper label={label} error={error} hint={hint} id={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(controlClass, "py-2", error ? "border-red-400" : "border-border", className)}
        {...props}
      />
    </FieldWrapper>
  );
});

/** A row of colour swatches acting as a radio group. */
export function ColorField({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  colors: string[];
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-fg">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {colors.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              onClick={() => onChange(color)}
              className={cn(
                "h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110",
                selected && "ring-2 ring-fg",
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
