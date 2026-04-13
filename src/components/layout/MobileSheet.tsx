"use client";

import { ChevronDown, GripHorizontal, PanelTopClose } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/components/utils/cn";

export type MobileSheetState = "peek" | "open" | "collapsed";
export const MOBILE_SHEET_DRAG_THRESHOLD = 72;

export function getMobileSheetPositionClass(state: MobileSheetState) {
  if (state === "open") {
    return "translate-y-0";
  }

  if (state === "peek") {
    return "translate-y-[calc(100%-7.75rem)]";
  }

  return "translate-y-[calc(100%-4.25rem)]";
}

export function resolveDraggedSheetState(
  state: MobileSheetState,
  deltaY: number,
) {
  if (Math.abs(deltaY) < MOBILE_SHEET_DRAG_THRESHOLD) {
    return state;
  }

  if (deltaY < 0) {
    if (state === "collapsed") {
      return "peek";
    }

    return "open";
  }

  if (state === "open") {
    return "peek";
  }

  return "collapsed";
}

interface MobileSheetProps {
  state: MobileSheetState;
  title: string;
  subtitle?: string;
  peekContent?: React.ReactNode;
  onToggle?: () => void;
  onClose?: () => void;
  onDragStateChange?: (state: MobileSheetState) => void;
  className?: string;
  children: React.ReactNode;
}

export function MobileSheet({
  state,
  title,
  subtitle,
  peekContent,
  onToggle,
  onClose,
  onDragStateChange,
  className,
  children,
}: MobileSheetProps) {
  const gestureStartYRef = useRef<number | null>(null);

  function clearGesture() {
    gestureStartYRef.current = null;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!onDragStateChange) {
      return;
    }

    gestureStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const startY = gestureStartYRef.current;

    if (startY == null || !onDragStateChange) {
      clearGesture();
      return;
    }

    onDragStateChange(resolveDraggedSheetState(state, event.clientY - startY));
    clearGesture();
  }

  const bodyContent =
    state === "open" ? children : state === "peek" ? peekContent ?? children : null;

  return (
    <div className="lg:hidden">
      <section
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[1600px] px-3 pb-3 pt-0 transition-transform duration-300 ease-out motion-reduce:transition-none",
          getMobileSheetPositionClass(state),
          className,
        )}
      >
        <div className="glass-panel overflow-hidden rounded-t-[2rem] rounded-b-[1.75rem]">
          <div
            className="flex cursor-grab justify-center border-b border-brand-primary/10 px-4 pb-2 pt-3 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={clearGesture}
          >
            <span className="inline-flex h-6 w-12 items-center justify-center rounded-full bg-brand-primary-soft/70 text-brand-primary-dark/55">
              <GripHorizontal className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-primary/10 bg-white/80 text-text-secondary transition hover:bg-white hover:text-brand-primary-dark"
              aria-label={state === "open" ? "Collapse details" : "Expand details"}
              onClick={onToggle ?? onClose}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  state === "open" && "rotate-180",
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
          {bodyContent ? (
            <div className="max-h-[calc(74dvh-5rem)] overflow-y-auto border-t border-brand-primary/10 px-4 py-4">
              {bodyContent}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
