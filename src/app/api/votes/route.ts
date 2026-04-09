import { NextResponse } from "next/server";

import { hashDeviceId } from "@/lib/crypto";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fetchCodesByStoreIds } from "@/lib/store-data";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { voteSubmissionSchema } from "@/lib/validators";
import type { VoteResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = voteSubmissionSchema.parse(body);
    const supabase = createServiceRoleClient();
    const hashedDeviceId = hashDeviceId(parsed.deviceId);
    const rateLimit = await enforceRateLimit({
      scope: "vote_submission",
      hashedDeviceId,
      supabase,
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: "Vote rate limit exceeded. Please wait before voting again.",
        },
        { status: 429 },
      );
    }

    const { data: targetCode, error: targetCodeError } = await supabase
      .from("codes")
      .select("store_id")
      .eq("id", parsed.codeId)
      .maybeSingle();

    if (targetCodeError) {
      throw targetCodeError;
    }

    if (!targetCode) {
      return NextResponse.json(
        {
          error: "Code not found",
        },
        { status: 404 },
      );
    }

    const { error } = await supabase.rpc("vote_on_code", {
      p_code_id: parsed.codeId,
      p_voter_hash: hashedDeviceId,
      p_vote_type: parsed.voteType,
    });

    if (error) {
      if (error.message.includes("duplicate_vote")) {
        return NextResponse.json(
          {
            error: "You have already voted on this code.",
          },
          { status: 409 },
        );
      }

      throw error;
    }

    const codesByStore = await fetchCodesByStoreIds(supabase, [targetCode.store_id], true);

    return NextResponse.json({
      codes: codesByStore.get(targetCode.store_id) ?? [],
    } satisfies VoteResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to submit vote",
      },
      { status: 400 },
    );
  }
}
