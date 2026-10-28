import type { Metadata } from "next";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div>
          <div className="text-sm font-bold text-blue-600">IT-AI-Copilot</div>
          <h1 className="mt-2 text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm muted">Sign in with your organization&apos;s managed identity. MFA enforcement is configured by your identity provider.</p>
        </div>
        <form action={async () => { "use server"; await signIn("microsoft-entra-id", { redirectTo: "/dashboard" }); }}>
          <Button type="submit" className="w-full">Continue with Microsoft Entra ID</Button>
        </form>
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
          <Button type="submit" variant="outline" className="w-full">Continue with Google</Button>
        </form>
        <p className="text-xs muted">Password login and self-service reset are not enabled until MFA, lockout, and recovery security reviews are complete.</p>
      </Card>
    </main>
  );
}
