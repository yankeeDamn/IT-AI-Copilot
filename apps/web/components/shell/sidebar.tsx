"use client";

import {
  Activity, BookOpen, Bot, Boxes, ChartNoAxesCombined,
  LayoutDashboard, Menu, Settings, Ticket, X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/copilot", label: "AI Copilot", icon: Bot },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombined },
  { href: "/admin", label: "Administration", icon: Settings }
];

export function Sidebar({ organization, role }: { organization: string; role: string }) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  return (
    <>
      <header className="flex items-center justify-between border-b border-[var(--border)] p-3 lg:hidden">
        <strong>IT-AI-Copilot</strong>
        <Button variant="outline" aria-label="Open navigation menu" onClick={toggleSidebar}><Menu className="size-5" /></Button>
      </header>
      {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close menu" onClick={closeSidebar} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--card)] p-4 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold tracking-tight text-blue-600">IT-AI-Copilot</div>
            <div className="mt-1 text-xs muted">Enterprise IT Workspace</div>
          </div>
          <Button variant="ghost" className="lg:hidden" aria-label="Close navigation" onClick={closeSidebar}><X className="size-4" /></Button>
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} onClick={closeSidebar}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                  active ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                    : "muted hover:bg-slate-100 dark:hover:bg-slate-800")}>
                <Icon aria-hidden="true" className="size-4" />{label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          <div className="truncate text-sm font-medium">{organization}</div>
          <div className="text-xs muted capitalize">{role.replace("_", " ")}</div>
          <ThemeSwitcher />
        </div>
      </aside>
    </>
  );
}
