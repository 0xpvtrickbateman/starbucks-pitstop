"use client";

import { ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/components/utils/cn";
import type { ReportedCodeSummary } from "@/components/home/types";

interface CodeDisplayProps {
  code: ReportedCodeSummary;
  className?: string;
}

export function CodeDisplay({ code, className }: CodeDisplayProps) {
  const score = Math.max(0, Math.min(100, Math.round(code.confidenceScore * 100)));

  return (
    <article
      className={cn(
        "surface-card overflow-hidden rounded-[1.6rem] p-4",
        code.isTop && "border-brand-primary/20 bg-brand-primary-soft/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
            {code.isActive ? "ACTIVE CODE" : "OLD CODE"}
          </p>
          <p className="mt-2 font-mono text-[2rem] font-semibold tracking-[0.32em] text-brand-primary-dark">
            {code.display}
          </p>
        </div>
        {code.isTop && code.isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary px-3 py-1 text-[0.68rem] font-semibold text-white">
            <ShieldCheck className="h-3.5 w-3.5" />
            Top pick
          </span>
        ) : null}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-primary-soft">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.82rem] text-text-secondary">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5">
          <ThumbsUp className="h-3.5 w-3.5" />
          {code.upvotes} upvotes
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5">
          <ThumbsDown className="h-3.5 w-3.5" />
          {code.downvotes} downvotes
        </span>
        <span className="font-medium text-brand-primary-dark">
          Confidence {score}%
        </span>
      </div>
    </article>
  );
}
