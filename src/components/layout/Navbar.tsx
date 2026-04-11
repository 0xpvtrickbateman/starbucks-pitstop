"use client";

import { AlertCircle, Coffee, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/components/utils/cn";

interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  return (
    <header
      className={cn(
        "safe-area-top sticky top-0 z-40 border-b border-white/40",
        className,
      )}
    >
      <div className="glass-panel mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-[var(--space-page)] py-3">
        <div className="flex items-center gap-4">
          <LogoMark size={56} priority />
          <div className="min-w-0">
            <p className="font-functional text-[0.68rem] leading-none tracking-[0.28em] text-brand-primary-dark/70">
              Starbucks Pitstop
            </p>
            <h1 className="font-display text-[1.1rem] leading-tight text-brand-primary-dark sm:text-[1.2rem]">
              Fast restroom code lookup for people on the go.
            </h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary-soft px-3 py-1.5 text-[0.72rem] font-medium text-brand-primary-dark">
            <ShieldCheck className="h-3.5 w-3.5" />
            Anonymous by design
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-accent/10 px-3 py-1.5 text-[0.72rem] font-medium text-brand-primary-dark">
            <Coffee className="h-3.5 w-3.5" />
            User reported
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-white/70 px-3 py-1.5 text-[0.72rem] font-medium text-text-secondary">
            <AlertCircle className="h-3.5 w-3.5" />
            Not affiliated with Starbucks
          </span>
        </div>
      </div>
    </header>
  );
}
