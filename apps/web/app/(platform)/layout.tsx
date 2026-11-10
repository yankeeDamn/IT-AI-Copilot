import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shell/sidebar";
import { AccessError, requireContext } from "@/lib/access";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  let context: Awaited<ReturnType<typeof requireContext>>;
  try {
    context = await requireContext();
  } catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect("/sign-in");
    if (error instanceof AccessError && error.status === 403) {
      return <main id="main" className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">Organization access required</h1>
        <p className="mt-4 muted">Your account has no active membership. Ask an IT administrator to provision your organization access.</p>
      </main>;
    }
    throw error;
  }
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar organization={context.organization.name} role={context.role} />
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-7 xl:p-10">{children}</main>
    </div>
  );
}
