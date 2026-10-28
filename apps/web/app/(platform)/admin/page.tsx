import { ModulePreview } from "@/components/shell/module-preview";
import { requireContext } from "@/lib/access";
export default async function Admin() {
  await requireContext("settings.manage");
  return <ModulePreview title="Administration" description="Govern organizational policies, roles and integrations."
    planned={["Departments and categories", "Role and permission editor", "SLA policies", "AI budgets, security and integrations"]}/>;
}
