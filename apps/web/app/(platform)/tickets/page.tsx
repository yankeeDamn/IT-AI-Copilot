import type { Metadata } from "next";
import { TicketBoard } from "@/features/tickets/ticket-board";
import { requireContext } from "@/lib/access";

export const metadata: Metadata = { title: "Tickets" };
export default async function TicketsPage() {
  const ctx = await requireContext("tickets.read");
  return <TicketBoard canCreate={ctx.role !== "auditor"} />;
}
