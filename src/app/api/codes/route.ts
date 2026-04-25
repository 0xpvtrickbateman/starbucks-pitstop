import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-errors";
import { hashDeviceId, normalizeCodeInput } from "@/lib/crypto";
import { isLocalMockBackendEnabled } from "@/lib/config";
import { submitMockCode } from "@/lib/mock-backend";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fetchCodesByStoreIds } from "@/lib/store-data";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { codeSubmissionSchema } from "@/lib/validators";
import type { CodesResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = codeSubmissionSchema.parse(body);
    const { display, normalized } = normalizeCodeInput(
      parsed.code ?? "",
      parsed.entryType,
    );

    if (
      parsed.entryType === "code" &&
      (normalized.length < 3 || normalized.length > 8)
    ) {
      return NextResponse.json(
        {
          error: "Codes must be 3-8 characters using letters, numbers, or #",
        },
        { status: 400 },
      );
    }

    if (isLocalMockBackendEnabled()) {
      const result = submitMockCode({
        storeId: parsed.storeId,
        codeDisplay: display,
        codeNormalized: normalized,
      });

      return NextResponse.json({
        ...result,
      } satisfies CodesResponse);
    }

    const supabase = createServiceRoleClient();
    const hashedDeviceId = hashDeviceId(parsed.deviceId);
    const rateLimit = await enforceRateLimit({
      scope: "code_submission",
      hashedDeviceId,
      supabase,
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: "Submission rate limit exceeded. Please wait before posting again.",
        },
        { status: 429 },
      );
    }

    const { data: existing } = await supabase
      .from("codes")
      .select("id")
      .eq("store_id", parsed.storeId)
      .eq("code_normalized", normalized)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.rpc("submit_code_report", {
        p_store_id: parsed.storeId,
        p_code_display: display,
        p_code_normalized: normalized,
        p_submitted_by_hash: hashedDeviceId,
      });

      if (error) {
        throw error;
      }
    }

    const codesByStore = await fetchCodesByStoreIds(supabase, [parsed.storeId], true);

    return NextResponse.json({
      existing: Boolean(existing),
      codes: codesByStore.get(parsed.storeId) ?? [],
    } satisfies CodesResponse);
  } catch (error) {
    return apiErrorResponse(error, "codes");
  }
}
