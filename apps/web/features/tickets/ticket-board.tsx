"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ticketCreateSchema, type TicketCreateInput } from "@/lib/ticket-contract";

type TicketSummary = {
  id: string; number: number; title: string; priority: string; status: string;
  createdAt: string; requester: { name: string | null };
  assignee: { name: string | null } | null;
};
type ListResponse = { data: TicketSummary[]; nextCursor: string | null };

async function readTickets(): Promise<ListResponse> {
  const response = await fetch("/api/v1/tickets?limit=25", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to read tickets");
  return response.json() as Promise<ListResponse>;
}

async function createTicket(input: TicketCreateInput) {
  const response = await fetch("/api/v1/tickets", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Unable to create ticket");
  }
  return response.json();
}

export function TicketBoard({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["tickets", "first-page"], queryFn: readTickets
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<TicketCreateInput>({
      resolver: zodResolver(ticketCreateSchema),
      defaultValues: { title: "", description: "", priority: "MEDIUM" }
    });
  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      reset();
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="mt-2 text-sm muted">Classify, prioritize and resolve your team's incidents.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()} aria-label="Refresh tickets">
            <RefreshCw className="size-4" aria-hidden="true"/> Refresh
          </Button>
          {canCreate && <Button onClick={() => setShowForm(v => !v)}>
            <Plus className="size-4" aria-hidden="true" /> New ticket
          </Button>}
        </div>
      </div>
      {showForm && canCreate && <Card className="max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">Create incident</h2>
        <form onSubmit={handleSubmit(input => mutation.mutate(input))} className="space-y-4">
          <div><label htmlFor="ticket-title" className="mb-1 block text-sm font-medium">Title</label>
            <input id="ticket-title" className="input-field" maxLength={200} {...register("title")} />
            {errors.title && <p role="alert" className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>
          <div><label htmlFor="ticket-description" className="mb-1 block text-sm font-medium">Description</label>
            <textarea id="ticket-description" rows={4} maxLength={4000}
              className="input-field" {...register("description")} />
            {errors.description && <p role="alert" className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
          </div>
          <div><label htmlFor="ticket-priority" className="mb-1 block text-sm font-medium">Priority</label>
            <select id="ticket-priority" className="input-field" {...register("priority")}>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option><option value="CRITICAL">Critical</option>
            </select>
          </div>
          {mutation.error && <p role="alert" className="text-sm text-red-500">{mutation.error.message}</p>}
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>Save ticket</Button>
        </form>
      </Card>}
      <Card className="overflow-hidden p-0">
        {isLoading && <p role="status" className="p-6 muted">Loading tickets…</p>}
        {error && <p role="alert" className="p-6 text-red-500">Unable to load tickets. Try refreshing.</p>}
        {data && data.data.length === 0 && <div className="p-10 text-center">
          <h2 className="font-semibold">No tickets yet</h2><p className="mt-1 text-sm muted">New incidents will appear here.</p>
        </div>}
        {data && data.data.length > 0 && <div className="table-wrap">
          <table className="responsive-table">
            <thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Created</th><th><span className="sr-only">View</span></th></tr></thead>
            <tbody>{data.data.map(ticket => <tr key={ticket.id}>
              <td><span className="text-xs muted">#{ticket.number}</span><div className="font-medium">{ticket.title}</div></td>
              <td><Badge>{ticket.status.replaceAll("_", " ")}</Badge></td>
              <td>{ticket.priority}</td>
              <td><time dateTime={ticket.createdAt}>{new Date(ticket.createdAt).toLocaleDateString()}</time></td>
              <td><Link aria-label={`View ticket #${ticket.number}`} href={`/tickets/${ticket.id}`}
                className="inline-flex items-center gap-1 text-blue-600">Open <ArrowRight className="size-4" /></Link></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </Card>
      {data?.nextCursor && <p className="text-sm muted">Showing the latest 25 tickets. Full cursor pagination is a Phase 5B UI task; the API already supports it.</p>}
    </div>
  );
}
