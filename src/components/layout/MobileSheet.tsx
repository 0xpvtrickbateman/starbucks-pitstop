"use client";

import { ChevronDown, PanelTopClose } from "lucide-react";
import { cn } from "@/components/utils/cn";

interface MobileSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function MobileSheet({
  open,
  title,
  subtitle,
  onClose,
  className,
  children,
}: MobileSheetProps) {
  return (
    <div className="lg:hidden">
      <section
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[1600px] px-3 pb-3 pt-0 transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-[calc(100%-4.25rem)]",
          className,
        )}
      >
        <div className="glass-panel overflow-hidden rounded-t-[2rem] rounded-b-[1.75rem]">
          <div className="flex items-center justify-between gap-3 border-b border-brand-primary/10 px-4 py-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-primary/10 bg-white/80 text-text-secondary transition hover:bg-white hover:text-brand-primary-dark"
              aria-label={open ? "Collapse details" : "Expand details"}
              onClick={onClose}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="font-functional text-[0.66rem] tracking-[0.3em] text-brand-primary-dark/70">
                {subtitle ?? "Detail sheet"}
              </p>
              <h2 className="truncate font-display text-[1.15rem] text-brand-primary-dark">
                {title}
              </h2>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-primary/10 bg-white/80 text-text-secondary transition hover:bg-white hover:text-brand-primary-dark"
              aria-label="Close panel"
              onClick={onClose}
            >
              <PanelTopClose className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(78dvh-4.75rem)] overflow-y-auto px-4 py-4">
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
