"use client";

import { LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/components/utils/cn";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onNearMe: () => void;
  nearMeStatus?: string;
  className?: string;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  onNearMe,
  nearMeStatus,
  className,
}: MapControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2",
        className,
      )}
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-[1.3rem] border border-brand-primary/10 bg-white/86 shadow-[0_16px_32px_rgba(22,54,46,0.14)] backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomIn}
          className="inline-flex h-11 w-11 items-center justify-center border-b border-brand-primary/10 text-brand-primary-dark transition hover:bg-brand-primary-soft/70"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="inline-flex h-11 w-11 items-center justify-center text-brand-primary-dark transition hover:bg-brand-primary-soft/70"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onRecenter}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-primary/10 bg-white/88 px-4 text-[0.76rem] font-semibold text-brand-primary-dark shadow-[0_16px_32px_rgba(22,54,46,0.14)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white"
        >
          <RotateCcw className="h-4 w-4" />
          Recenter
        </button>
        <button
          type="button"
          onClick={onNearMe}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary px-4 text-[0.76rem] font-semibold text-white shadow-[0_16px_32px_rgba(22,54,46,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-primary-dark"
        >
          <LocateFixed className="h-4 w-4" />
          Near me
        </button>
      </div>

      {nearMeStatus ? (
        <p className="max-w-[13rem] rounded-full border border-white/60 bg-white/82 px-3 py-1.5 text-right text-[0.72rem] text-text-secondary shadow-[0_12px_24px_rgba(22,54,46,0.1)] backdrop-blur-md">
          {nearMeStatus}
        </p>
      ) : null}
    </div>
  );
}
