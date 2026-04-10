import { z } from "zod";

const deviceIdSchema = z.uuid();

export const locationsQuerySchema = z
  .object({
    bbox: z.string().optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius: z.coerce.number().min(0.1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .superRefine((value, context) => {
    const hasBbox = Boolean(value.bbox);
    const hasRadiusQuery =
      typeof value.lat === "number" &&
      typeof value.lng === "number" &&
      typeof value.radius === "number";

    if (!hasBbox && !hasRadiusQuery) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either bbox or lat/lng/radius",
      });
    }
  });

export const codeSubmissionSchema = z.object({
  storeId: z.string().min(1),
  code: z
    .string()
    .trim()
    .min(3)
    .max(16)
    .regex(/^[a-zA-Z0-9 -]+$/, "Codes must be alphanumeric"),
  deviceId: deviceIdSchema,
});

export const voteSubmissionSchema = z.object({
  codeId: z.uuid(),
  voteType: z.enum(["up", "down"]),
  deviceId: deviceIdSchema,
});

// Strip LIKE wildcard metacharacters so user input is treated as literal
// text by the downstream ILIKE-based RPC. Exported so callers that build a
// query outside this schema (e.g. tests, internal tooling) can stay aligned.
export function sanitizeSearchQuery(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "").replace(/\s+/g, " ").trim();
}

function countAlphanumeric(value: string): number {
  return (value.match(/[a-zA-Z0-9]/g) ?? []).length;
}

export const searchQuerySchema = z.object({
  // Bound the raw input before the transform so an attacker can't force us
  // to regex a 10MB string. Sanitization then strips wildcard metachars and
  // collapses whitespace, and the refinement rejects anything that would
  // resolve to an effectively empty ILIKE pattern — inputs like "__", "%%",
  // or "   " would otherwise pass the old min(2) check and trigger a full
  // table scan via `ILIKE '%%'`.
  q: z
    .string()
    .max(120)
    .transform(sanitizeSearchQuery)
    .refine((sanitized) => countAlphanumeric(sanitized) >= 2, {
      message:
        "Search query is too short or contains only special characters.",
    }),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});
