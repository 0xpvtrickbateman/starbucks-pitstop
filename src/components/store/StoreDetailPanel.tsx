"use client";

import { Clock3, MapPinned, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  MobileSheet,
  type MobileSheetState,
} from "@/components/layout/MobileSheet";
import type { StoreDetailData } from "@/components/home/types";
import { CodeDisplay } from "@/components/store/CodeDisplay";
import {
  CodeSubmitForm,
  type CodeSubmitDraft,
} from "@/components/store/CodeSubmitForm";
import { CodeVoteButtons } from "@/components/store/CodeVoteButtons";
import { StoreCard } from "@/components/store/StoreCard";
import { cn } from "@/components/utils/cn";

interface StoreDetailPanelProps {
  store: StoreDetailData | null;
  open: boolean;
  sheetState?: MobileSheetState;
  variant: "sheet" | "sidebar";
  peekContent?: React.ReactNode;
  onSubmitEntry?: (draft: CodeSubmitDraft) => string | void | Promise<string | void>;
  onVote?: (
    codeId: string,
    vote: "up" | "down",
  ) => string | void | Promise<string | void>;
  onToggle?: () => void;
  onClose?: () => void;
  onSheetStateChange?: (state: MobileSheetState) => void;
}

function EmptyState() {
  return (
    <div className="space-y-4">
      <div className="surface-card rounded-[1.8rem] p-5">
        <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
          READY WHEN YOU ARE
        </p>
        <h3 className="mt-2 font-display text-[1.45rem] leading-tight text-brand-primary-dark">
          Search, tap a pin, then confirm the best code.
        </h3>
        <p className="mt-3 text-[0.95rem] leading-7 text-text-secondary">
          The right-hand panel stays intentionally quiet until you choose a
          store, so the map keeps center stage. Once a location is selected,
          this space becomes the code brief, history, and submit surface.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {[
          "Fast lookup on the map",
          "Anonymous, server-mediated writes",
          "Conservative store inclusion",
        ].map((item) => (
          <div
            key={item}
            className="rounded-[1.3rem] border border-brand-primary/10 bg-white/78 px-4 py-3 text-[0.84rem] font-medium text-text-secondary"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelContent({
  store,
  onSubmitEntry,
  onVote,
}: {
  store: StoreDetailData | null;
  onSubmitEntry?: (draft: CodeSubmitDraft) => string | void | Promise<string | void>;
  onVote?: (
    codeId: string,
    vote: "up" | "down",
  ) => string | void | Promise<string | void>;
}) {
  const [showOldCodes, setShowOldCodes] = useState(false);

  if (!store) {
    return <EmptyState />;
  }

  const activeCodes = store.codes.filter((code) => code.isActive);
  const inactiveCodes = store.codes.filter((code) => !code.isActive);
  const inactiveCount = store.inactiveCodeCount ?? inactiveCodes.length;

  return (
    <div className="space-y-4">
      <StoreCard store={store} selected className="cursor-default" />

      <div className="flex flex-wrap items-center gap-2 text-[0.76rem] text-text-secondary">
        {store.hoursLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {store.hoursLabel}
          </span>
        ) : null}
        {store.ownershipType ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            {store.ownershipType}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/10 bg-white/85 px-3 py-1.5">
          <MapPinned className="h-3.5 w-3.5" />
          {store.featureNames?.length ? store.featureNames[0] : "Qualifying store"}
        </span>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
              ACTIVE ENTRIES
            </p>
            <h4 className="mt-1 font-display text-[1.18rem] text-brand-primary-dark">
              {activeCodes.length
                ? "Current restroom access reports"
                : "No active entry yet"}
            </h4>
          </div>
          {inactiveCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowOldCodes((value) => !value)}
              className="rounded-full border border-brand-primary/10 bg-white/85 px-3 py-2 text-[0.72rem] font-semibold text-brand-primary-dark transition hover:bg-brand-primary-soft/60"
            >
              {showOldCodes ? "Hide old entries" : "Show old entries"} ({inactiveCount})
            </button>
          ) : null}
        </div>

        {activeCodes.length ? (
          <div className="space-y-3">
            {activeCodes.map((code) => (
              <div key={code.id} className="space-y-3">
                <CodeDisplay code={code} />
                <CodeVoteButtons
                  upvotes={code.upvotes}
                  downvotes={code.downvotes}
                  onVote={
                    onVote
                      ? (vote) => onVote(code.id, vote)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-brand-primary/15 bg-white/70 px-4 py-6 text-[0.92rem] leading-7 text-text-secondary">
            No active restroom entry has been attached to this store yet. Be
            the first to report a working code or mark it as no code required.
          </div>
        )}

        {showOldCodes && inactiveCount > 0 ? (
          <div className="space-y-3 rounded-[1.6rem] border border-brand-primary/10 bg-white/70 p-4">
            <p className="text-[0.9rem] text-text-secondary">
              Old entries stay in history for context. Treat them as backup
              only.
            </p>
            {inactiveCodes.map((code) => (
              <CodeDisplay key={code.id} code={code} />
            ))}
          </div>
        ) : null}
      </section>

      <CodeSubmitForm
        storeName={store.name}
        onSubmit={onSubmitEntry}
      />

      <p className="rounded-[1.3rem] border border-brand-primary/10 bg-white/75 px-4 py-3 text-[0.78rem] leading-6 text-text-secondary">
        This project is not affiliated with Starbucks. Restroom entries are
        user-reported, can change without notice, and may include no-code
        entries.
      </p>
    </div>
  );
}

export function StoreDetailPanel({
  store,
  open,
  sheetState = open ? "open" : "collapsed",
  variant,
  peekContent,
  onSubmitEntry,
  onVote,
  onToggle,
  onClose,
  onSheetStateChange,
}: StoreDetailPanelProps) {
  const content = (
    <PanelContent store={store} onSubmitEntry={onSubmitEntry} onVote={onVote} />
  );

  if (variant === "sheet") {
    return (
      <MobileSheet
        state={sheetState}
        title={store?.name ?? "Find a Starbucks"}
        subtitle={store ? "Selected location" : "Start nearby"}
        peekContent={peekContent}
        onToggle={onToggle}
        onClose={onClose}
        onDragStateChange={onSheetStateChange}
      >
        {content}
      </MobileSheet>
    );
  }

  return (
    <aside
      className={cn(
        "glass-panel hidden h-full min-h-[48rem] w-full max-w-[31rem] flex-col overflow-hidden rounded-[2rem] lg:flex",
        open ? "opacity-100" : "opacity-95",
      )}
    >
      <div className="border-b border-brand-primary/10 px-5 py-4">
        <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
          STORE DETAILS
        </p>
        <h2 className="mt-2 font-display text-[1.5rem] text-brand-primary-dark">
          {store?.name ?? "Choose a location on the map"}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">{content}</div>
    </aside>
  );
}
