"use client";

import { Crosshair, Search, X } from "lucide-react";
import { cn } from "@/components/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onNearMe: () => void;
  onClear?: () => void;
  helperText?: string;
  statusText?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onNearMe,
  onClear,
  helperText = "Search by city, ZIP, address, or store name.",
  statusText,
  className,
  disabled = false,
}: SearchBarProps) {
  return (
    <form
      className={cn("space-y-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="glass-panel flex items-center gap-2 rounded-[1.5rem] px-3 py-3">
        <Search className="h-5 w-5 shrink-0 text-brand-primary-dark/70" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search a Starbucks location"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="search"
          disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent text-[0.98rem] outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60"
        />
        {value.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-primary/10 bg-white/90 text-text-secondary transition hover:-translate-y-0.5 hover:text-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNearMe}
          disabled={disabled}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary-soft px-4 text-[0.78rem] font-semibold text-brand-primary-dark transition hover:-translate-y-0.5 hover:bg-brand-primary-soft/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Crosshair className="h-4 w-4" />
          Near me
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[0.78rem] text-text-secondary">
        <p>{helperText}</p>
        {statusText ? (
          <p className="font-medium text-brand-primary-dark">{statusText}</p>
        ) : null}
      </div>
    </form>
  );
}
