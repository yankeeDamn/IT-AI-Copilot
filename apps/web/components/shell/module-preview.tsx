import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ModulePreview({ title, description, planned }: {
  title: string; description: string; planned: string[];
}) {
  return <div className="max-w-4xl space-y-6">
    <header><div className="mb-3"><Badge>Planned module</Badge></div>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm muted">{description}</p>
    </header>
    <Card className="space-y-4">
      <h2 className="font-semibold">Delivery scope</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {planned.map(item => <li className="rounded-lg border border-[var(--border)] p-3 text-sm" key={item}>{item}</li>)}
      </ul>
      <p className="text-sm muted">This module is not enabled yet. No dummy production data or unsafe actions are exposed.</p>
    </Card>
  </div>;
}
