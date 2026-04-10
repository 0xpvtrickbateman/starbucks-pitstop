import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiClientError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiClientError";
  }
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || undefined,
    message: issue.message,
  }));
}

export function apiErrorResponse(error: unknown, context: string) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: formatZodIssues(error) },
      { status: 400 },
    );
  }

  if (error instanceof ApiClientError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // A SyntaxError at this layer almost always means `await request.json()`
  // failed on a malformed client body. Treat it as a client error rather
  // than a server fault so callers see a clear 400 instead of a noisy 500.
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 },
    );
  }

  // Anything else is an internal failure. Log the real error server-side and
  // return a generic 500 so we don't leak DB internals to the client.
  console.error(`[api:${context}] internal error`, error);

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}

