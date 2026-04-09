import { NextResponse } from "next/server";

export function withSupabaseMiddleware() {
  return NextResponse.next();
}
