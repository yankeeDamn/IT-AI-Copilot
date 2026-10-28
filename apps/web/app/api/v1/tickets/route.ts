import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireContext, ticketVisibility, AccessError } from "@/lib/access";
import { prisma } from "@/lib/db";
import { handleError, requireSameOrigin } from "@/lib/http";
import { listQuerySchema, ticketCreateSchema } from "@/lib/ticket-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext("tickets.read");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    // Do not allow a cross-tenant cursor to influence pagination.
    if (query.cursor) {
      const valid = await prisma.ticket.findFirst({
        where: { id: query.cursor, organizationId: ctx.organizationId, deletedAt: null,
          ...ticketVisibility(ctx) }, select: { id: true }
      });
      if (!valid) throw new AccessError(403, "Invalid cursor");
    }
    const where: Prisma.TicketWhereInput = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...ticketVisibility(ctx),
      ...(query.status ? { status: query.status } : {})
    };
    const rows = await prisma.ticket.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true, number: true, title: true, priority: true, status: true,
        createdAt: true, updatedAt: true,
        assignee: { select: { name: true } },
        requester: { select: { name: true } }
      }
    });
    const more = rows.length > query.limit;
    const data = rows.slice(0, query.limit);
    return NextResponse.json({
      data, nextCursor: more ? data.at(-1)?.id ?? null : null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const ctx = await requireContext("tickets.create");
    const input = ticketCreateSchema.parse(await request.json());
    const created = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: ctx.organizationId },
        data: { nextTicketNumber: { increment: 1 } },
        select: { nextTicketNumber: true }
      });
      const ticket = await tx.ticket.create({
        data: {
          organizationId: ctx.organizationId,
          number: organization.nextTicketNumber - 1,
          title: input.title,
          description: input.description,
          priority: input.priority,
          requesterId: ctx.userId,
          createdById: ctx.userId
        },
        select: { id: true, number: true, title: true, status: true, priority: true }
      });
      await tx.ticketHistory.create({
        data: {
          organizationId: ctx.organizationId, ticketId: ticket.id,
          actorId: ctx.userId, action: "TICKET_CREATED"
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId, actorId: ctx.userId,
          action: "tickets.create", entityType: "Ticket", entityId: ticket.id,
          outcome: "SUCCESS"
        }
      });
      return ticket;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
