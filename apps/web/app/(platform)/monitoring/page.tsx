import { ModulePreview } from "@/components/shell/module-preview";
export default function Monitoring() {
  return <ModulePreview title="Monitoring & alerts" description="Signed integrations with event deduplication and incident correlation."
    planned={["Azure Monitor integration", "Prometheus/Grafana adapters", "Alert-to-ticket workflows", "Notification rules"]}/>;
}
