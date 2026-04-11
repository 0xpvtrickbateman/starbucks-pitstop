"use client";

import Image from "next/image";
import { cn } from "@/components/utils/cn";

interface LogoMarkProps {
  className?: string;
  size?: number;
  priority?: boolean;
  compact?: boolean;
}

export function LogoMark({
  className,
  size = 44,
  priority = false,
  compact = false,
}: LogoMarkProps) {
  const pixelSize = compact ? Math.max(32, Math.round(size * 0.8)) : size;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[22%] border border-white/70 bg-surface-elevated shadow-[0_12px_26px_rgba(22,54,46,0.12)]",
        className,
      )}
      style={{ width: pixelSize, height: pixelSize }}
      aria-hidden="true"
    >
      <Image
        src="/brand/pitstop-mark.png"
        alt=""
        fill
        priority={priority}
        sizes={`${pixelSize}px`}
        className="object-contain"
      />
    </div>
  );
}
