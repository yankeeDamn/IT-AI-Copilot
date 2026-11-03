import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";

export default async function OrganizationDashboard({ params }: { params: Promise<{ organizationId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { organizationId } = await params;
  if (!/^[1-9][0-9]{0,8}$/.test(organizationId)) notFound();
  return <Dashboard organizationId={organizationId} displayName={session.user?.name || session.user?.email || "Team member"}/>;
}
