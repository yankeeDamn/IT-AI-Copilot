import { signIn } from "@/auth";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck, Layers } from "lucide-react";

export default function LoginPage() {
  const configured = Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET);
  return <main className="login-page">
    <div className="login-card"><Link href="/" className="brand"><span className="brand-glyph"><Layers size={20}/></span> IT-AI <span>Copilot</span></Link>
      <div className="login-icon"><LockKeyhole size={28}/></div>
      <span className="eyebrow">SECURE ACCESS</span><h1>Welcome back</h1><p>Use your organization's identity provider to access tickets, analytics, and human-reviewed AI guidance.</p>
      {configured ? <form action={async () => { "use server"; await signIn("corporate-oidc", { redirectTo: "/dashboard" }); }}><button className="button button-primary button-full" type="submit">Continue with organization SSO <ArrowRight size={17}/></button></form>
        : <div className="notice">SSO has not been configured. Set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET and the corresponding API audience before signing in.</div>}
      <p className="login-note"><ShieldCheck size={15}/> Protected by OIDC. No passwords stored by the dashboard.</p>
    </div></main>;
}
