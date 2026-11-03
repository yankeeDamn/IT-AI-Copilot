import Link from "next/link";
import { ArrowUpRight, Bot, ShieldCheck, Workflow, Layers } from "lucide-react";

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-header"><div className="brand"><span className="brand-glyph"><Layers size={21} /></span> IT-AI <span>Copilot</span></div><Link className="button button-light" href="/login">Sign in <ArrowUpRight size={16}/></Link></header>
      <section className="hero"><div className="eyebrow"><span className="pulse-dot"/> BUILT FOR IT OPERATIONS TEAMS</div><h1>Your IT operations.<br/><span>One intelligent workspace.</span></h1><p>Turn tickets into clear actions. Classify incidents, find trusted knowledge, review AI troubleshooting and keep humans in control.</p><div className="hero-actions"><Link className="button button-primary" href="/login">Open workspace <ArrowUpRight size={17}/></Link><span>Organization SSO · Human-reviewed AI · Scoped access</span></div><div className="feature-grid"><article><Bot/><h3>AI-powered triage</h3><p>ML categories and grounded troubleshooting.</p></article><article><ShieldCheck/><h3>Secure by design</h3><p>OIDC identities and tenant-aware permissions.</p></article><article><Workflow/><h3>Controlled actions</h3><p>Separate-person automation approvals.</p></article></div></section>
    </main>
  );
}
