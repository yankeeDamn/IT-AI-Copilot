"use client";

import { Button } from "@/components/ui/button";

export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="panel max-w-xl p-8">
    <h2 className="text-xl font-bold">Unable to load this workspace</h2>
    <p className="mt-2 muted">Try again. If the issue continues, contact your IT administrator.</p>
    <Button className="mt-5" onClick={reset}>Try again</Button>
  </div>;
}
