"use client";

import { LoaderCircle, SendHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/components/utils/cn";

interface CodeSubmitFormProps {
  storeName?: string;
  disabled?: boolean;
  onSubmit?: (code: string) => string | void | Promise<string | void>;
  className?: string;
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function CodeSubmitForm({
  storeName,
  disabled = false,
  onSubmit,
  className,
}: CodeSubmitFormProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalized = useMemo(() => normalizeCode(value), [value]);
  const canSubmit = normalized.length >= 3 && normalized.length <= 8 && !disabled;

  return (
    <form
      className={cn("surface-card rounded-[1.6rem] p-4", className)}
      onSubmit={async (event) => {
        event.preventDefault();

        if (!canSubmit) {
          setStatus("Enter a 3-8 character alphanumeric code.");
          return;
        }

        if (!onSubmit) {
          setStatus("Code entry is staged for the secure API route.");
          return;
        }

        setIsSubmitting(true);
        setStatus(null);
        try {
          const result = await onSubmit(normalized);
          setValue("");
          setStatus(result ?? "Code saved. Thanks for helping the next person.");
        } catch {
          setStatus("Could not save that code right now.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
            SUBMIT A CODE
          </p>
          <h3 className="mt-2 font-display text-[1.15rem] text-brand-primary-dark">
            {storeName ? `For ${storeName}` : "Add a keypad code"}
          </h3>
        </div>
        {isSubmitting ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-primary-dark" />
        ) : null}
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-[0.8rem] font-medium text-text-secondary">
          Code
        </span>
        <input
          aria-label="Code"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. 4839"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          disabled={disabled}
          className="h-12 w-full rounded-[1.1rem] border border-brand-primary/12 bg-white/90 px-4 text-[0.98rem] tracking-[0.24em] text-brand-primary-dark outline-none transition placeholder:tracking-normal placeholder:text-text-tertiary focus:border-brand-primary/30 focus:ring-2 focus:ring-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3 text-[0.78rem] text-text-secondary">
        <p>3-8 alphanumeric characters, normalized and deduped server-side.</p>
        <p className="font-medium text-brand-primary-dark">{normalized || " "}</p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-[0.82rem] font-semibold text-white shadow-[0_16px_30px_rgba(22,54,46,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:bg-brand-primary/45"
      >
        <SendHorizontal className="h-4 w-4" />
        Submit code
      </button>

      {status ? (
        <p className="mt-3 text-[0.78rem] text-text-secondary">{status}</p>
      ) : null}
    </form>
  );
}
