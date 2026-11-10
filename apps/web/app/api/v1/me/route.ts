import { NextResponse } from "next/server";
import { requireContext } from "@/lib/access";
import { handleError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireContext();
    return NextResponse.json({
      data: {
        userId: ctx.userId, organizationId: ctx.organizationId,
        organizationName: ctx.organization.name, role: ctx.role
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}
