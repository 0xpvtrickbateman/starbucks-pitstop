import { NextResponse } from "next/server";

import { hashDeviceId, normalizeCodeInput } from "@/lib/crypto";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fetchCodesByStoreIds } from "@/lib/store-data";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { codeSubmissionSchema } from "@/lib/validators";
import type { CodesResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = codeSubmissionSchema.parse(body);
    const { display, normalized } = normalizeCodeInput(parsed.code);

    if (normalized.length < 3 || normalized.length > 8) {
      return NextResponse.json(
        {
          error: "Codes must be 3-8 alphanumeric characters",
        },
        { status: 400 },
      );
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to submit code",
      },
      { status: 400 },
    );
  }
}
