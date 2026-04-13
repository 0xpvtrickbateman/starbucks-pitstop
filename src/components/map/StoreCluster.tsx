"use client";

import { cn } from "@/components/utils/cn";

interface StoreClusterProps {
  pointCount: number;
  label?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function StoreCluster({
  pointCount,
  label,
  selected = false,
  onClick,
}: StoreClusterProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full border border-brand-primary/10 bg-brand-primary text-white shadow-[0_18px_30px_rgba(22,54,46,0.2)] transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-accent/70",
        selected && "scale-110 ring-2 ring-brand-accent ring-offset-2",
      )}
      aria-label={label ?? `Expand cluster with ${pointCount} stores`}
    >
      <span className="font-functional text-[0.72rem] font-bold tracking-[0.24em]">
        {pointCount}
      </span>
    </button>
  );
}
