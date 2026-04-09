"use client";

import { Clock3, MapPinned, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { MobileSheet } from "@/components/layout/MobileSheet";
import type { StoreDetailData } from "@/components/home/types";
import { CodeDisplay } from "@/components/store/CodeDisplay";
import { CodeSubmitForm } from "@/components/store/CodeSubmitForm";
import { CodeVoteButtons } from "@/components/store/CodeVoteButtons";
import { StoreCard } from "@/components/store/StoreCard";
import { cn } from "@/components/utils/cn";

interface StoreDetailPanelProps {
  store: StoreDetailData | null;
  open: boolean;
  variant: "sheet" | "sidebar";
  onSubmitCode?: (code: string) => string | void | Promise<string | void>;
  onVote?: (
    codeId: string,
    vote: "up" | "down",
  ) => string | void | Promise<string | void>;
  onClose?: () => void;
}

function EmptyState() {
  return (
    <div className="space-y-4">
      <div className="surface-card rounded-[1.8rem] p-5">
        <p className="font-functional text-[0.62rem] tracking-[0.34em] text-brand-primary-dark/65">
          GET STARTED
        </p>
        <h3 className="mt-2 font-display text-[1.4rem] text-brand-primary-dark">
          Pick a Starbucks near you.
        </h3>
        <p className="mt-3 text-[0.95rem] leading-7 text-text-secondary">
          Grant location access, search by city or ZIP, or tap a clustered pin
          to open the detail panel. Codes, votes, and restroom hints are all
          designed for standing-at-the-counter use.
        </p>
      </div>

      <div className="grid gap-3">
        {[
          {
            title: "Fast lookup",
            body: "Search the map or use the near-me button from a phone in hand.",
          },
          {
            title: "Safe by default",
            body: "Anonymous browsing, server-mediated writes, and conservative filtering.",
          },
          {
            title: "Mobile first",
            body: "Bottom sheet on phones, side panel on larger screens, jumbo code cards.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-[1.4rem] border border-brand-primary/10 bg-white/80 p-4"
          >
            <p className="font-medium text-brand-primary-dark">{item.title}</p>
            <p className="mt-1 text-[0.86rem] leading-6 text-text-secondary">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelContent({
  store,
  onSubmitCode,
  onVote,
}: {
  store: StoreDetailData | null;
  onSubmitCode?: (code: string) => string | void | Promise<string | void>;
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
              ACTIVE CODES
            </p>
            <h4 className="mt-1 font-display text-[1.18rem] text-brand-primary-dark">
              {activeCodes.length ? "Current candidate codes" : "No active code yet"}
            </h4>
          </div>
          {inactiveCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowOldCodes((value) => !value)}
              className="rounded-full border border-brand-primary/10 bg-white/85 px-3 py-2 text-[0.72rem] font-semibold text-brand-primary-dark transition hover:bg-brand-primary-soft/60"
            >
              {showOldCodes ? "Hide old codes" : "Show old codes"} ({inactiveCount})
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
            No active codes have been attached to this store yet. Be the first
            to report one for the next person in line.
          </div>
        )}

        {showOldCodes && inactiveCount > 0 ? (
          <div className="space-y-3 rounded-[1.6rem] border border-brand-primary/10 bg-white/70 p-4">
            <p className="text-[0.9rem] text-text-secondary">
              Old codes stay in history for context. Treat them as backup only.
            </p>
            {inactiveCodes.map((code) => (
              <CodeDisplay key={code.id} code={code} />
            ))}
          </div>
        ) : null}
      </section>

      <CodeSubmitForm
        storeName={store.name}
        onSubmit={onSubmitCode}
      />

      <p className="rounded-[1.3rem] border border-brand-primary/10 bg-white/75 px-4 py-3 text-[0.78rem] leading-6 text-text-secondary">
        This project is not affiliated with Starbucks. Restroom codes are
        user-reported and can change without notice.
      </p>
    </div>
  );
}

export function StoreDetailPanel({
  store,
  open,
  variant,
  onSubmitCode,
  onVote,
  onClose,
}: StoreDetailPanelProps) {
  const content = (
    <PanelContent store={store} onSubmitCode={onSubmitCode} onVote={onVote} />
  );

  if (variant === "sheet") {
    return (
      <MobileSheet
        open={open}
        title={store?.name ?? "Find a Starbucks"}
        subtitle={store ? "Selected location" : "Start nearby"}
        onClose={onClose}
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
