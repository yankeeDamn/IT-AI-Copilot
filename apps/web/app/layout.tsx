import type { Metadata } from "next";

import "@/app/globals.css";
import { AppProviders } from "@/providers/app-providers";

export const metadata: Metadata = {
  title: { default: "IT-AI-Copilot", template: "%s | IT-AI-Copilot" },
  description: "Tenant-aware IT operations and AI-assisted service management."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <a className="skip-link" href="#main">Skip to content</a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
