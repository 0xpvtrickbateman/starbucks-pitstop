import { createHmac } from "node:crypto";

import { getServerConfig } from "@/lib/config";
import {
  NO_CODE_REQUIRED_DISPLAY,
  NO_CODE_REQUIRED_NORMALIZED,
  type RestroomEntryType,
} from "@/lib/restroom-entry";

export function normalizeCodeInput(
  rawCode: string,
  entryType: RestroomEntryType = "code",
) {
  if (entryType === "no-code-required") {
    return {
      display: NO_CODE_REQUIRED_DISPLAY,
      normalized: NO_CODE_REQUIRED_NORMALIZED,
    };
  }

  const trimmed = rawCode.trim().toUpperCase();
  const normalized = trimmed.replace(/[\s-]+/g, "").replace(/[^A-Z0-9#]/g, "");

  return {
    display: normalized,
    normalized,
  };
}

export function hashDeviceId(deviceId: string) {
  const { RATE_LIMIT_SECRET } = getServerConfig();

  if (!RATE_LIMIT_SECRET) {
    throw new Error("RATE_LIMIT_SECRET is required for device hashing");
  }

  return createHmac("sha256", RATE_LIMIT_SECRET).update(deviceId).digest("hex");
}
