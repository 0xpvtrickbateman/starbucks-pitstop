"use client";

import { LoaderCircle, SendHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/components/utils/cn";
import {
  NO_CODE_REQUIRED_DISPLAY,
  type RestroomEntryType,
} from "@/lib/restroom-entry";

export interface CodeSubmitDraft {
  entryType: RestroomEntryType;
  code?: string;
}

interface CodeSubmitFormProps {
  storeName?: string;
  disabled?: boolean;
  onSubmit?: (draft: CodeSubmitDraft) => string | void | Promise<string | void>;
  className?: string;
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^A-Z0-9#]/g, "")
    .slice(0, 8);
}

export function CodeSubmitForm({
  storeName,
  disabled = false,
  onSubmit,
  className,
}: CodeSubmitFormProps) {
  const [entryType, setEntryType] = useState<RestroomEntryType>("code");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalized = useMemo(() => normalizeCode(value), [value]);
  const canSubmit =
    !disabled &&
    (entryType === "no-code-required" ||
      (normalized.length >= 3 && normalized.length <= 8));

  return (
    <form
      className={cn("surface-card rounded-[1.6rem] p-4", className)}
      onSubmit={async (event) => {
        event.preventDefault();

        if (!canSubmit) {
          setStatus("Enter a 3-8 character code using letters, numbers, or #.");
          return;
        }

        if (!onSubmit) {
          setStatus("Restroom entry is staged for the secure API route.");
          return;
        }

        setIsSubmitting(true);
        setStatus(null);
        try {
          const result = await onSubmit(
            entryType === "code"
              ? {
                  entryType,
                  code: normalized,
                }
              : {
                  entryType,
                },
          );
          setValue("");
          setEntryType("code");
          setStatus(
            result ??
              (entryType === "code"
                ? "Entry saved. Thanks for helping the next person."
                : "Marked as no code required. Thanks for helping the next person."),
          );
        } catch {
          setStatus("Could not save that entry right now.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
            SUBMIT AN ENTRY
          </p>
          <h3 className="mt-2 font-display text-[1.15rem] text-brand-primary-dark">
            {storeName ? `For ${storeName}` : "Add restroom access info"}
          </h3>
        </div>
        {isSubmitting ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-primary-dark" />
        ) : null}
      </div>

      <fieldset className="mt-4 space-y-3">
        <legend className="text-[0.8rem] font-medium text-text-secondary">
          Entry type
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              value: "code" as const,
              title: "Code",
              body: "Report the keypad code shown on the restroom door.",
            },
            {
              value: "no-code-required" as const,
              title: NO_CODE_REQUIRED_DISPLAY,
              body: "Use this when the restroom door opens without a keypad code.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={cn(
                "rounded-[1.2rem] border bg-white/78 px-4 py-3 transition",
                entryType === option.value
                  ? "border-brand-primary/30 bg-brand-primary-soft/35"
                  : "border-brand-primary/10 hover:bg-white/92",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="entryType"
                value={option.value}
                checked={entryType === option.value}
                onChange={() => {
                  setEntryType(option.value);
                  setStatus(null);
                }}
                disabled={disabled}
                className="sr-only"
              />
              <span className="block text-[0.88rem] font-semibold text-brand-primary-dark">
                {option.title}
              </span>
              <span className="mt-1 block text-[0.78rem] leading-6 text-text-secondary">
                {option.body}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {entryType === "code" ? (
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
      ) : (
        <div className="mt-4 rounded-[1.3rem] border border-brand-primary/12 bg-brand-primary-soft/24 px-4 py-4 text-[0.84rem] leading-6 text-text-secondary">
          This store can be reported as having restroom access without a keypad
          code. Other visitors can still vote on the entry afterward.
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-[0.78rem] text-text-secondary">
        <p>
          {entryType === "code"
            ? "3-8 characters, # allowed, normalized and deduped server-side."
            : "No-code reports are deduped server-side just like keypad codes."}
        </p>
        <p className="font-medium text-brand-primary-dark">
          {entryType === "code" ? normalized || " " : NO_CODE_REQUIRED_DISPLAY}
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-[0.82rem] font-semibold text-white shadow-[0_16px_30px_rgba(22,54,46,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:bg-brand-primary/45"
      >
        <SendHorizontal className="h-4 w-4" />
        Submit entry
      </button>

      {status ? (
        <p className="mt-3 text-[0.78rem] text-text-secondary">{status}</p>
      ) : null}
    </form>
  );
}
