import { NextResponse } from "next/server";
import { requireContext } from "@/lib/access";
import { prisma } from "@/lib/db";
import { handleError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireContext("reports.view");
    const where = { organizationId: ctx.organizationId, deletedAt: null };
    const [total, open, critical, resolved, assets] = await prisma.$transaction([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING"] } } }),
      prisma.ticket.count({ where: { ...where, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.ticket.count({ where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } } }),
      prisma.asset.count({ where: { organizationId: ctx.organizationId, deletedAt: null } })
    ]);
    const breakdown = await prisma.ticket.groupBy({ by: ["status"], orderBy: { status: "asc" }, where, _count: { _all: true } });
    return NextResponse.json({
      data: {
        total, open, critical, resolved, assets,
        resolutionRate: total > 0 ? Number((resolved / total * 100).toFixed(1)) : null,
        byStatus: breakdown.map(item => ({ status: item.status, count: item._count._all })),
        slaViolations: null, mttrHours: null, aiResolutionRate: null
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}
