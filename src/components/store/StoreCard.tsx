"use client";

import { ChevronRight, MapPin, Navigation2, Sparkles } from "lucide-react";
import { cn } from "@/components/utils/cn";
import type { StoreSummary } from "@/components/home/types";
import { formatActiveEntrySummary } from "@/lib/restroom-entry";

interface StoreCardProps {
  store: StoreSummary;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StoreCard({
  store,
  selected = false,
  onClick,
  className,
}: StoreCardProps) {
  const classes = cn(
    "surface-card group w-full rounded-[1.6rem] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(22,54,46,0.16)]",
    selected && "border-brand-primary/25 bg-brand-primary-soft/25",
    className,
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
            STARBUCKS LOCATION
          </p>
          <h3 className="mt-2 truncate font-display text-[1.18rem] text-brand-primary-dark">
            {store.name}
          </h3>
          <p className="mt-1 flex items-start gap-2 text-[0.9rem] leading-6 text-text-secondary">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-dark/70" />
            <span className="block">
              {store.address}
              <br />
              {store.city}, {store.state} {store.zip}
            </span>
          </p>
        </div>

        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-primary/10 bg-white/85 text-brand-primary-dark transition group-hover:bg-brand-primary-soft/60">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {store.activeCodeCount ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1.5 text-[0.72rem] font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" />
            {formatActiveEntrySummary(store.activeCodeCount)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5 text-[0.72rem] font-semibold text-text-secondary">
            No active entry yet
          </span>
        )}

        {store.distanceMiles != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5 text-[0.72rem] font-semibold text-text-secondary">
            <Navigation2 className="h-3.5 w-3.5" />
            {store.distanceMiles.toFixed(1)} mi away
          </span>
        ) : null}
      </div>
    </>
  );

  if (!onClick) {
    return <article className={classes}>{content}</article>;
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
