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

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});
