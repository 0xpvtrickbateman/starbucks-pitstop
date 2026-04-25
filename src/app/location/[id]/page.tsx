import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPinned, ShieldCheck, Sparkles } from "lucide-react";

import { LogoMark } from "@/components/brand/LogoMark";
import { isLocalMockBackendEnabled } from "@/lib/config";
import { fetchMockStoreById } from "@/lib/mock-backend";
import { formatActiveEntrySummary } from "@/lib/restroom-entry";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchStoreById } from "@/lib/store-data";
import { CodeDisplay } from "@/components/store/CodeDisplay";

async function loadStore(id: string) {
  if (isLocalMockBackendEnabled()) {
    return fetchMockStoreById(id);
  }

  const supabase = createServiceRoleClient();
  return fetchStoreById(supabase, id);
}

interface LocationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: LocationPageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const store = await loadStore(id);

    if (!store) {
      return {};
    }

    return {
      title: `${store.name} restroom entries`,
      description: `User-reported restroom access reports for ${store.name} in ${store.city}, ${store.state}.`,
    };
  } catch {
    return {};
  }
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { id } = await params;
  let store;

  try {
    store = await loadStore(id);
  } catch {
    notFound();
  }

  if (!store) {
    notFound();
  }

  const activeCodes = store.codes
    .filter((code) => code.isActive)
    .sort((left, right) => right.confidenceScore - left.confidenceScore);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-[var(--space-page)] py-8 sm:py-10">
      <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <LogoMark size={60} priority />
            <div className="min-w-0">
              <p className="font-functional text-[0.68rem] tracking-[0.28em] text-brand-primary-dark/70">
                Starbucks Pitstop
              </p>
              <h1 className="mt-2 font-display text-[2rem] leading-tight text-brand-primary-dark sm:text-[2.4rem]">
                {store.name}
              </h1>
              <p className="mt-3 text-[0.96rem] leading-7 text-text-secondary">
                {store.address}, {store.city}, {store.state} {store.zip}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/10 bg-white/82 px-3 py-1.5 text-[0.75rem] font-semibold text-brand-primary-dark">
                  <Sparkles className="h-3.5 w-3.5" />
                  {formatActiveEntrySummary(activeCodes.length)}
                </span>
                {store.ownershipType ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/10 bg-white/82 px-3 py-1.5 text-[0.75rem] text-text-secondary">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand-primary-dark" />
                    {store.ownershipType}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/10 bg-white/82 px-3 py-1.5 text-[0.75rem] text-text-secondary">
                  <MapPinned className="h-3.5 w-3.5 text-brand-primary-dark" />
                  Read-only share page
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-brand-primary/12 bg-white/84 px-4 py-2.5 text-[0.82rem] font-semibold text-brand-primary-dark shadow-[0_12px_24px_rgba(22,54,46,0.1)] transition hover:-translate-y-0.5 hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Open the live map
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <div className="surface-card rounded-[1.9rem] p-5 sm:p-6">
            <p className="font-functional text-[0.66rem] tracking-[0.32em] text-brand-primary-dark/65">
              CURRENT CANDIDATE ENTRIES
            </p>
            <h2 className="mt-2 font-display text-[1.55rem] text-brand-primary-dark">
              Read the strongest user-reported access reports first.
            </h2>
            <p className="mt-3 text-[0.92rem] leading-7 text-text-secondary">
              This page is optimized for quick verification and sharing. Votes
              and submissions stay inside the interactive app.
            </p>
          </div>

          {activeCodes.length > 0 ? (
            activeCodes.map((code, index) => (
              <CodeDisplay
                key={code.id}
                code={{
                  id: code.id,
                  display: code.codeDisplay,
                  normalized: code.codeDisplay,
                  upvotes: code.upvotes,
                  downvotes: code.downvotes,
                  confidenceScore: code.confidenceScore,
                  isActive: code.isActive,
                  isTop: index === 0,
                }}
              />
            ))
          ) : (
            <div className="surface-card rounded-[1.9rem] p-5 sm:p-6">
              <p className="font-functional text-[0.66rem] tracking-[0.32em] text-brand-primary-dark/65">
                NOTHING CONFIRMED YET
              </p>
              <h2 className="mt-2 font-display text-[1.5rem] text-brand-primary-dark">
                No active entry has stuck for this store.
              </h2>
              <p className="mt-3 text-[0.92rem] leading-7 text-text-secondary">
                Open the live map to report a fresh code, mark a store as no
                code required, vote on a candidate, or browse nearby stores
                with stronger signal.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="surface-card rounded-[1.8rem] p-5">
            <p className="font-functional text-[0.66rem] tracking-[0.32em] text-brand-primary-dark/65">
              WHAT THIS PAGE IS FOR
            </p>
            <p className="mt-3 text-[0.9rem] leading-7 text-text-secondary">
              Share this link when someone needs a quick read-only answer. Use
              the live map when you need to search, submit, vote, or compare
              nearby stores.
            </p>
          </div>

          <div className="rounded-[1.8rem] border border-brand-primary/10 bg-white/78 px-5 py-4 text-[0.84rem] leading-6 text-text-secondary shadow-[0_12px_30px_rgba(22,54,46,0.08)]">
            This project is not affiliated with Starbucks. Restroom entries are
            user-reported, can change without notice, and should be verified in
            person when possible.
          </div>
        </aside>
      </section>
    </main>
  );
}
