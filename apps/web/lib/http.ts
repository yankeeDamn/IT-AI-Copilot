import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccessError } from "@/lib/access";

export function handleError(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({
      error: "Invalid request",
      issues: error.issues.map(({ path, message }) => ({ path, message }))
    }, { status: 422 });
  }
  console.error("API request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function requireSameOrigin(request: NextRequest) {
  const configuredOrigin = process.env.APP_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configuredOrigin) {
    throw new AccessError(403, "Server origin not configured");
  }
  const expected = new URL(configuredOrigin ?? request.url).origin;
  const actual = request.headers.get("origin");
  if (!actual || actual !== expected) throw new AccessError(403, "Invalid origin");
}
