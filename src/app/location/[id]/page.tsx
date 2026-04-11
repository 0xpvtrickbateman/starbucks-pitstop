import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocalMockBackendEnabled } from "@/lib/config";
import { fetchMockStoreById } from "@/lib/mock-backend";
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
      title: `${store.name} restroom codes | Starbucks Pitstop`,
      description: `User-reported restroom keypad codes for ${store.name} in ${store.city}, ${store.state}.`,
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
          Starbucks Pitstop
        </p>
        <h1 className="text-3xl font-semibold text-brand-primary-dark">
          {store.name}
        </h1>
        <p className="text-neutral-600">
          {store.address}, {store.city}, {store.state} {store.zip}
        </p>
      </div>
      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-medium text-brand-primary-dark">
          Current candidate codes
        </h2>
        <div className="mt-4 space-y-3">
          {store.codes.filter((code) => code.isActive).length > 0 ? (
            store.codes
              .filter((code) => code.isActive)
              .sort((left, right) => right.confidenceScore - left.confidenceScore)
              .map((code, index) => (
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
            <p className="text-neutral-600">No active codes yet for this location.</p>
          )}
        </div>
      </section>

      <p className="rounded-3xl border border-black/5 bg-white/80 px-5 py-4 text-sm leading-6 text-neutral-600 shadow-sm">
        This project is not affiliated with Starbucks. Restroom codes are
        user-reported and may change.
      </p>
    </main>
  );
}
