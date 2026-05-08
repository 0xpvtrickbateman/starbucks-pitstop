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
  const pixelSize = compact ? Math.max(40, Math.round(size * 0.86)) : size;
  const renderedImageSize = Math.ceil(pixelSize * 1.2);

  return (
    <div
      className={cn(
        "relative isolate shrink-0 overflow-hidden rounded-[24%] bg-white shadow-[0_18px_42px_rgba(22,54,46,0.16),inset_0_0_0_1px_rgba(22,54,46,0.06)] ring-1 ring-white/90",
        className,
      )}
      style={{ width: pixelSize, height: pixelSize }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_34%_24%,rgba(255,255,255,0.98),rgba(245,241,232,0.72)_58%,rgba(220,233,224,0.36))]" />
      <Image
        src="/brand/pitstop-mark.png"
        alt=""
        fill
        priority={priority}
        sizes={`${renderedImageSize}px`}
        className="scale-[1.18] object-contain drop-shadow-[0_6px_10px_rgba(22,54,46,0.12)]"
      />
    </div>
  );
}
