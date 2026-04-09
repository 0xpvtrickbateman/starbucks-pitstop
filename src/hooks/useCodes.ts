"use client";

import { useState } from "react";

import type { PublicCode } from "@/types";

export function useCodes(initialCodes: PublicCode[] = []) {
  const [codes, setCodes] = useState<PublicCode[]>(initialCodes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    codes,
    setCodes,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
  };
}
