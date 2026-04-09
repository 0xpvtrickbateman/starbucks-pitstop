import { createHmac } from "node:crypto";

import { getServerConfig } from "@/lib/config";

export function normalizeCodeInput(rawCode: string) {
  const trimmed = rawCode.trim().toUpperCase();
  const alphanumeric = trimmed.replace(/[^A-Z0-9]/g, "");

  return {
    display: alphanumeric,
    normalized: alphanumeric,
  };
}

export function hashDeviceId(deviceId: string) {
  const { RATE_LIMIT_SECRET } = getServerConfig();

  if (!RATE_LIMIT_SECRET) {
    throw new Error("RATE_LIMIT_SECRET is required for device hashing");
  }

  return createHmac("sha256", RATE_LIMIT_SECRET).update(deviceId).digest("hex");
}
