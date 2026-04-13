"use client";

import { ArrowUpRight, Crosshair, Search, X } from "lucide-react";
import type {
  SearchCandidate,
  SearchPhase,
} from "@/components/home/types";
import { cn } from "@/components/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onNearMe: () => void;
  onClear?: () => void;
  onResultSelect?: (storeId: string) => void;
  results?: SearchCandidate[];
  selectedResultId?: string | null;
  helperText?: string;
  statusText?: string;
  label?: string;
  searchState?: SearchPhase;
  className?: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onNearMe,
  onClear,
  onResultSelect,
  results = [],
  selectedResultId,
  helperText = "Search by city, ZIP, address, or store name.",
  statusText,
  label = "Search a Starbucks location",
  searchState = "idle",
  className,
  disabled = false,
}: SearchBarProps) {
  const helperId = "store-search-helper";
  const statusId = "store-search-status";
  const inputId = "store-search-input";
  const hasResults = results.length > 0;

  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      <div className="glass-panel rounded-[1.7rem] p-2.5">
        <div className="flex items-center gap-2">
          <Search className="ml-1 h-5 w-5 shrink-0 text-brand-primary-dark/70" />
          <input
            id={inputId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search a Starbucks location"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="search"
            aria-describedby={`${helperId} ${statusId}`}
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
            type="submit"
            disabled={disabled}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-white shadow-[0_16px_30px_rgba(22,54,46,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:bg-brand-primary/45"
            aria-label="Search"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNearMe}
            disabled={disabled}
            className="hidden h-10 items-center justify-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary-soft px-4 text-[0.78rem] font-semibold text-brand-primary-dark transition hover:-translate-y-0.5 hover:bg-brand-primary-soft/80 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
          >
            <Crosshair className="h-4 w-4" />
            Near me
          </button>
        </div>

        {hasResults ? (
          <div className="mt-3 border-t border-brand-primary/10 pt-3">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <p className="font-functional text-[0.62rem] tracking-[0.28em] text-brand-primary-dark/65">
                PICK A LOCATION
              </p>
              <p className="text-[0.74rem] text-text-secondary">
                {results.length} possible match{results.length === 1 ? "" : "es"}
              </p>
            </div>
            <div className="grid gap-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => onResultSelect?.(result.id)}
                  className={cn(
                    "surface-card rounded-[1.3rem] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-brand-primary/20 hover:bg-white",
                    selectedResultId === result.id &&
                      "border-brand-primary/25 bg-brand-primary-soft/25",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-primary-dark">
                        {result.name}
                      </p>
                      <p className="mt-1 text-[0.82rem] leading-6 text-text-secondary">
                        {result.subtitle}
                      </p>
                    </div>
                    <span className="rounded-full border border-brand-primary/10 bg-white/85 px-2.5 py-1 text-[0.68rem] font-semibold text-brand-primary-dark">
                      {result.badge}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[0.78rem] text-text-secondary">
        <p id={helperId}>{helperText}</p>
        <p
          id={statusId}
          aria-live="polite"
          className={cn(
            "font-medium",
            searchState === "error"
              ? "text-state-warning"
              : "text-brand-primary-dark",
          )}
        >
          {statusText ?? " "}
        </p>
      </div>
    </form>
  );
}
