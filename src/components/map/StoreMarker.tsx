"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/components/utils/cn";
import type { StoreCodeHealth } from "@/components/home/types";

interface StoreMarkerProps {
  health?: StoreCodeHealth;
  label?: string;
  selected?: boolean;
  active?: boolean;
  onClick?: () => void;
}

const HEALTH_STYLES: Record<StoreCodeHealth, string> = {
  empty: "border-brand-primary/20 bg-white/92 text-brand-primary-dark",
  mixed: "border-brand-accent/35 bg-brand-accent/15 text-brand-primary-dark",
  confident: "border-brand-primary/20 bg-brand-primary text-white",
};

export function StoreMarker({
  health = "empty",
  label,
  selected = false,
  active = true,
  onClick,
}: StoreMarkerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_16px_28px_rgba(22,54,46,0.18)] transition duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-accent/70",
        HEALTH_STYLES[health],
        selected && "scale-110 ring-2 ring-brand-accent ring-offset-2 ring-offset-transparent",
        !active && "opacity-60",
      )}
      aria-label={label ?? "Open store details"}
    >
      <MapPin className="h-5 w-5" />
      <span
        className={cn(
          "absolute -bottom-1 h-3 w-3 rotate-45 rounded-[0.4rem] border-b border-r",
          health === "confident"
            ? "border-brand-primary bg-brand-primary"
            : health === "mixed"
              ? "border-brand-accent bg-brand-accent/20"
              : "border-brand-primary/20 bg-white",
        )}
      />
      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/35" />
    </button>
  );
}
