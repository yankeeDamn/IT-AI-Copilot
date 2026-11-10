import { ModulePreview } from "@/components/shell/module-preview";
export default function Copilot() {
  return <ModulePreview title="AI troubleshooting Copilot" description="Grounded AI recommendations with technician oversight."
    planned={["Ticket-aware chat", "Azure OpenAI GPT-4o integration", "Knowledge citations", "Human-reviewed diagnostic flows"]}/>;
}
