import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ status: "alive", service: "itsm-web" },
    { headers: { "Cache-Control": "no-store" } });
}
