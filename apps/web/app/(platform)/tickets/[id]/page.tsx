import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireContext, ticketVisibility } from "@/lib/access";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Ticket detail" };

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("tickets.read");
  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();
  const ticket = await prisma.ticket.findFirst({
    where: { id, organizationId: ctx.organizationId, deletedAt: null, ...ticketVisibility(ctx) },
    include: {
      requester: { select: { name: true, email: true } },
      assignee: { select: { name: true } },
      comments: { where: ctx.role === "employee" ? { internal: false, deletedAt: null } : { deletedAt: null },
        include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } }
    }
  });
  if (!ticket) notFound();
  return <div className="max-w-4xl space-y-6">
    <Link href="/tickets" className="text-sm text-blue-600 hover:underline">← Back to tickets</Link>
    <div><div className="mb-2 flex items-center gap-2"><span className="text-sm muted">INC-{ticket.number}</span>
      <Badge>{ticket.status.replaceAll("_", " ")}</Badge></div>
      <h1 className="text-3xl font-bold">{ticket.title}</h1></div>
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
      <Card className="space-y-5">
        <h2 className="font-bold">Description</h2>
        <p className="whitespace-pre-wrap">{ticket.description}</p>
        <h3 className="border-t border-[var(--border)] pt-4 font-semibold">Comments</h3>
        {ticket.comments.length === 0 && <p className="text-sm muted">No comments yet.</p>}
        {ticket.comments.map(comment => <div key={comment.id} className="border-b border-[var(--border)] pb-3">
          <p className="text-sm font-semibold">{comment.author.name || "Technician"}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
        </div>)}
      </Card>
      <Card className="h-fit space-y-4">
        <h2 className="font-bold">Details</h2>
        <dl className="space-y-3 text-sm">
          <div><dt className="muted">Priority</dt><dd className="font-semibold">{ticket.priority}</dd></div>
          <div><dt className="muted">Requester</dt><dd>{ticket.requester.name || ticket.requester.email}</dd></div>
          <div><dt className="muted">Assignee</dt><dd>{ticket.assignee?.name || "Unassigned"}</dd></div>
          <div><dt className="muted">Opened</dt><dd><time dateTime={ticket.createdAt.toISOString()}>{ticket.createdAt.toLocaleString()}</time></dd></div>
        </dl>
      </Card>
    </div>
  </div>;
}
