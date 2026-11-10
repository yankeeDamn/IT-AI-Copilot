import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium", className)}>{children}</span>;
}
