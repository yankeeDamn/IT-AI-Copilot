import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireContext, ticketVisibility, AccessError } from "@/lib/access";
import { prisma } from "@/lib/db";
import { handleError, requireSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional()
}).strict().refine((v) => Object.keys(v).length > 0, "No fields supplied");

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const ctx = await requireContext("tickets.read");
    const id = z.string().uuid().parse((await params).id);
    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null, ...ticketVisibility(ctx) },
      select: {
        id: true, number: true, title: true, description: true,
        status: true, priority: true, createdAt: true, updatedAt: true,
        requester: { select: { name: true } }, assignee: { select: { name: true } },
        comments: { where: { deletedAt: null, internal: false }, select: {
          id: true, body: true, createdAt: true, author: { select: { name: true } }
        }, orderBy: { createdAt: "asc" } }
      }
    });
    if (!ticket) throw new AccessError(403, "Ticket not accessible");
    return NextResponse.json({ data: ticket }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    requireSameOrigin(request);
    const ctx = await requireContext("tickets.close");
    const id = z.string().uuid().parse((await params).id);
    const update = updateSchema.parse(await request.json());
    if (ctx.role === "employee" || ctx.role === "auditor") {
      throw new AccessError(403, "Only IT staff may update tickets");
    }
    const updated = await prisma.$transaction(async tx => {
      const existing = await tx.ticket.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null, ...ticketVisibility(ctx) }
      });
      if (!existing) throw new AccessError(403, "Ticket not accessible");
      const ticket = await tx.ticket.update({
        where: { id },
        data: {
          ...update, updatedById: ctx.userId,
          ...(update.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
          ...(update.status === "CLOSED" ? { closedAt: new Date() } : {})
        },
        select: { id: true, status: true, priority: true, updatedAt: true }
      });
      await tx.ticketHistory.create({
        data: { organizationId: ctx.organizationId, ticketId: id,
          actorId: ctx.userId, action: "TICKET_UPDATED", metadata: update }
      });
      await tx.auditLog.create({
        data: { organizationId: ctx.organizationId, actorId: ctx.userId,
          action: "tickets.update", entityType: "Ticket", entityId: id,
          outcome: "SUCCESS" }
      });
      return ticket;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleError(error);
  }
}
