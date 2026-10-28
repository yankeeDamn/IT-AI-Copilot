import { ModulePreview } from "@/components/shell/module-preview";
export default function Reports() {
  return <ModulePreview title="Analytics & reports" description="Operational insights with auditable definitions."
    planned={["SLA and MTTR reports", "Technician workload analytics", "CSV/Excel/PDF exports", "Scheduled delivery"]}/>;
}
