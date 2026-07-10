"use client";

import { clsx } from "clsx";

/**
 * Form primitives in the house style: mono uppercase labels, underline
 * inputs that sharpen to the foreground color on focus. One place to keep
 * every form in the app identical.
 */

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
    >
      {children}
    </label>
  );
}

const inputClass =
  "mt-2 w-full border-b border-line bg-transparent pb-2 text-fluid-base outline-none transition-colors focus:border-fg placeholder:text-muted/60";

export function TextField({
  id,
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input id={id} className={inputClass} {...rest} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  options,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select id={id} className={clsx(inputClass, "cursor-pointer appearance-none rounded-none")} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string }) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea id={id} className={clsx(inputClass, "resize-y leading-relaxed")} {...rest} />
    </div>
  );
}

export function SubmitButton({
  busy,
  children,
  className,
}: {
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-fg px-6 py-3 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85 disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-fluid-xs text-muted">
      {error}
    </p>
  );
}
