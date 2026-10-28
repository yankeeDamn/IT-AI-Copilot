import type { Metadata } from "next";
import { Activity, AlertTriangle, Boxes, CheckCircle2, Ticket } from "lucide-react";

import { Card } from "@/components/ui/card";
import { StatusChart } from "@/features/dashboard/status-chart";
import { requireContext, ticketVisibility } from "@/lib/access";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Overview" };

export default async function Dashboard() {
  const ctx = await requireContext("tickets.read");
  const scope = {
    organizationId: ctx.organizationId, deletedAt: null, ...ticketVisibility(ctx)
  };
  const [total, open, critical, resolved, assets, breakdown] = await prisma.$transaction([
    prisma.ticket.count({ where: scope }),
    prisma.ticket.count({ where: { ...scope, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING"] } } }),
    prisma.ticket.count({ where: { ...scope, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count({ where: { ...scope, status: { in: ["RESOLVED", "CLOSED"] } } }),
    prisma.asset.count({ where: { organizationId: ctx.organizationId, deletedAt: null } }),
    prisma.ticket.groupBy({ by: ["status"], where: scope, _count: { _all: true } })
  ]);
  const cards = [
    { label: "Total tickets", value: total, icon: Ticket },
    { label: "Open tickets", value: open, icon: Activity },
    { label: "Critical incidents", value: critical, icon: AlertTriangle },
    { label: "Resolved tickets", value: resolved, icon: CheckCircle2 },
    { label: "Active inventory records", value: assets, icon: Boxes }
  ];
  return <div className="space-y-8">
    <header><span className="text-sm font-semibold text-blue-600">Service operations</span>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Overview</h1>
      <p className="mt-2 text-sm muted">Live tenant-scoped operational data for {ctx.organization.name}.</p></header>
    <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon }) => <Card key={label} className="space-y-4">
        <div className="flex items-center justify-between text-sm muted"><span>{label}</span><Icon className="size-4" aria-hidden="true" /></div>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
      </Card>)}
    </section>
    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <Card><h2 className="mb-3 text-lg font-bold">Ticket status distribution</h2>
        <StatusChart data={breakdown.map(item => ({ status: item.status, count: item._count._all }))}/>
      </Card>
      <Card className="space-y-5"><h2 className="text-lg font-bold">Resolution overview</h2>
        <p className="text-4xl font-bold">{total ? `${(resolved / total * 100).toFixed(1)}%` : "—"}</p>
        <p className="text-sm muted">Resolved or closed divided by all tickets. Not an AI-resolution metric.</p>
        <div className="border-t border-[var(--border)] pt-4 text-sm">
          <p className="font-semibold">More analytics coming</p>
          <p className="mt-2 muted">SLA violations, MTTR and AI effectiveness require verified event and outcome data. No sample metrics are presented as real performance.</p>
        </div>
      </Card>
    </div>
  </div>;
}
