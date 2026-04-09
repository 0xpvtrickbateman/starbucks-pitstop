"use client";

import { useEffect, useState } from "react";

import type { LocationsResponse, PublicStore } from "@/types";

export function useStores(queryString: string) {
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!queryString) {
      return;
    }

    const controller = new AbortController();

    async function loadStores() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/locations?${queryString}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load stores");
        }

        const payload = (await response.json()) as LocationsResponse;
        setStores(payload.stores);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          fetchError instanceof Error ? fetchError.message : "Unable to load stores",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadStores();

    return () => controller.abort();
  }, [queryString]);

  return {
    stores,
    isLoading,
    error,
  };
}
