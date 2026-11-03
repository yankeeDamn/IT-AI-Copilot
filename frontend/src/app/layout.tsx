import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT-AI Copilot | Operations command center",
  description: "Secure, organization-scoped IT incident and AI support workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
