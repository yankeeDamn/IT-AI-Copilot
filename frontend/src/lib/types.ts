export type Role = "viewer" | "technician" | "admin";
export type ActiveTab = "overview" | "tickets" | "knowledge" | "approvals";
export type Ticket = {
  id: number;
  organization_id: number;
  title: string;
  description: string;
  category: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignee: string | null;
  created_at: string;
  resolved_at: string | null;
};
export type Me = { organization_id: number; subject: string; role: Role };
export type Summary = {
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  average_resolution_hours: number | null;
  note: string;
};
export type Prediction = { label: string; confidence: number; needs_review: boolean; category_saved: boolean };
export type Suggestion = { provider: string; suggestion: string; sources: string[]; requires_human_review: boolean };
export type Knowledge = { source: string; excerpt: string; score: number };
export type Audit = { action: string; actor: string; detail: string; created_at: string };

export function canModify(role: Role | null): boolean { return role === "technician" || role === "admin"; }
export function canApprove(role: Role | null): boolean { return role === "admin"; }
