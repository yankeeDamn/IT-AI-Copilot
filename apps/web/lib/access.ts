import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type Permission =
  | "tickets.read" | "tickets.create" | "tickets.assign" | "tickets.close"
  | "assets.read" | "assets.manage" | "knowledge.read" | "knowledge.manage"
  | "reports.view" | "users.manage" | "ai.use" | "settings.manage";

const matrix: Record<string, readonly Permission[]> = {
  admin: ["tickets.read", "tickets.create", "tickets.assign", "tickets.close", "assets.read", "assets.manage", "knowledge.read", "knowledge.manage", "reports.view", "users.manage", "ai.use", "settings.manage"],
  it_manager: ["tickets.read", "tickets.create", "tickets.assign", "tickets.close", "assets.read", "assets.manage", "knowledge.read", "knowledge.manage", "reports.view", "ai.use"],
  technician: ["tickets.read", "tickets.create", "tickets.close", "assets.read", "knowledge.read", "ai.use"],
  employee: ["tickets.read", "tickets.create", "knowledge.read"],
  auditor: ["tickets.read", "assets.read", "knowledge.read", "reports.view"]
};

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

// Phase 5A: choose the first active membership deterministically.
// A dedicated org switcher with pinned org context is a Phase 5B requirement.
// All reads still scope to the verified membership's organizationId.
export async function requireContext(permission?: Permission) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new AccessError(401, "Sign in required");
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      active: true,
      organization: { deletedAt: null },
      user: { deletedAt: null }
    },
    include: { role: true, organization: true },
    orderBy: { createdAt: "asc" }
  });
  if (!membership) throw new AccessError(403, "Organization membership required");
  if (permission && !(matrix[membership.role.key] ?? []).includes(permission)) {
    throw new AccessError(403, "Permission denied");
  }
  return {
    userId,
    organizationId: membership.organizationId,
    organization: membership.organization,
    role: membership.role.key,
    session
  };
}

export function ticketVisibility(ctx: { userId: string; role: string }) {
  if (ctx.role === "employee") return { requesterId: ctx.userId };
  if (ctx.role === "technician") {
    return { OR: [{ assigneeId: ctx.userId }, { requesterId: ctx.userId }, { assigneeId: null }] };
  }
  return {};
}
