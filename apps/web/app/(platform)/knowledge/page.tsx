import { ModulePreview } from "@/components/shell/module-preview";
export default function Knowledge() {
  return <ModulePreview title="Knowledge management" description="Versioned, reviewed technical documentation."
    planned={["Article authoring and revisions", "Review and publishing workflow", "Role-aware keyword search", "pgvector knowledge retrieval"]}/>;
}
