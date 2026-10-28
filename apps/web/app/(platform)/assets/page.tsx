import { ModulePreview } from "@/components/shell/module-preview";
export default function Assets() {
  return <ModulePreview title="Asset management" description="Lifecycle inventory and maintenance."
    planned={["Asset registry and serial tracking", "User assignments", "Warranty and maintenance alerts", "Asset-linked incidents"]}/>;
}
