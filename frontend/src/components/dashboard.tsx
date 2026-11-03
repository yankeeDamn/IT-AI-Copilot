"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowDownLeft, ArrowRight, BarChart3, Bell, BookOpen, Bot, Check,
  CheckCircle2, ChevronRight, CircleAlert, Clock3, Command, FileText, Filter,
  Layers, LayoutDashboard, Loader2, LogOut, Plus, RefreshCw, Search, Send,
  Settings2, ShieldCheck, Sparkles, Ticket as TicketIcon, Workflow, X,
} from "lucide-react";
import type { ActiveTab, Audit, Knowledge, Me, Prediction, Role, Suggestion, Summary, Ticket } from "@/lib/types";
import { canApprove, canModify } from "@/lib/types";

type Approval = { id: number; ticket_id: number; playbook: string; status: string; requested_by: string; reviewed_by: string | null; can_approve: boolean };
const nav: { key: ActiveTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "tickets", label: "All tickets", icon: TicketIcon },
  { key: "knowledge", label: "Knowledge base", icon: BookOpen },
  { key: "approvals", label: "Approvals", icon: ShieldCheck },
];
const priorities = ["low", "medium", "high", "critical"] as const;
const statuses = ["open", "in_progress", "resolved", "closed"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function callApi<T>(org: string, path: string, options: { method?: "GET" | "POST" | "PATCH"; body?: object } = {}): Promise<T> {
  const method = options.method || "GET";
  const response = await fetch(`/api/copilot/v1/organizations/${org}/${path}`, {
    method, cache: "no-store", credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json().catch(() => ({})) as { detail?: string; error?: string };
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your login has expired. Please sign in again.");
    if (response.status === 403) throw new Error("Your organization role does not allow this action.");
    if (response.status === 404) throw new Error("Resource not found or unavailable to your organization.");
    throw new Error(body.detail || body.error || `Request failed (${response.status})`);
  }
  return body as T;
}

export function Dashboard({ organizationId, displayName }: { organizationId: string; displayName: string }) {
  const [tab, setTab] = useState<ActiveTab>("overview");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [articles, setArticles] = useState<Knowledge[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const identity = await callApi<Me>(organizationId, "me");
      const [queue, metrics] = await Promise.all([
        callApi<Ticket[]>(organizationId, "tickets"),
        callApi<Summary>(organizationId, "dashboard/summary"),
      ]);
      setMe(identity); setTickets(queue); setSummary(metrics);
      if (identity.role === "admin") {
        setApprovals(await callApi<Approval[]>(organizationId, "automations"));
      } else {
        setApprovals([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the workspace.");
    } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { void refresh(); }, [refresh]);
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const matches = [ticket.title, ticket.description, ticket.category ?? "", String(ticket.id)].some((v) => v.toLowerCase().includes(search.toLowerCase()));
    return matches && (filter === "all" || ticket.status === filter);
  }), [tickets, search, filter]);
  const pending = approvals.filter((a) => a.status === "pending");
  const openTickets = (summary?.by_status.open ?? 0) + (summary?.by_status.in_progress ?? 0);
  const role: Role | null = me?.role ?? null;

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Action failed"); }
    finally { setBusy(false); }
  };
  const selectTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket); setNotice(""); setError("");
  };
  const searchArticles = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!knowledgeQuery.trim()) return;
    setKnowledgeLoading(true); setError("");
    try { setArticles(await callApi<Knowledge[]>(organizationId, `knowledge/search?q=${encodeURIComponent(knowledgeQuery)}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Knowledge search failed"); }
    finally { setKnowledgeLoading(false); }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand brand-sidebar" href="/"><span className="brand-glyph"><Layers size={20}/></span> IT-AI <span>Copilot</span></Link>
        <div className="workspace-switch"><div className="workspace-avatar">IT</div><div><strong>IT Operations</strong><small>Organization #{organizationId}</small></div><ChevronRight size={16}/></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} type="button" className={tab === item.key ? "nav-item active" : "nav-item"} onClick={() => { setTab(item.key); setError(""); }}>
              <Icon size={19}/><span>{item.label}</span>{item.key === "approvals" && pending.length > 0 ? <span className="nav-count">{pending.length}</span> : null}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom"><div className="ai-status"><span className="pulse-dot"/> AI Copilot <span>Human reviewed</span></div>
          <Link className="nav-item" href="/dashboard"><Settings2 size={18}/> Switch organization</Link>
          <form action="/api/auth/signout" method="post"><Link className="nav-item" href="/api/auth/signout"><LogOut size={18}/> Sign out</Link></form>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14}/> <strong>{nav.find((n) => n.key === tab)?.label}</strong></div>
          <div className="topbar-right"><span className="environment"><span className="pulse-dot"/> Secure workspace</span><button type="button" onClick={() => void refresh()} aria-label="Refresh data" title="Refresh data" className="icon-button"><RefreshCw size={18}/></button><div className="user-avatar" title={displayName}>{displayName.slice(0, 1).toUpperCase()}</div></div>
        </header>
        <main className="dashboard-main">
          {error && <div role="alert" className="alert error"><CircleAlert size={18}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15}/></button></div>}
          {notice && <div role="status" className="alert success"><Check size={18}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15}/></button></div>}
          {loading && !me ? <div className="loading-state"><Loader2 className="spin" size={30}/><p>Loading your secure workspace…</p></div> : me ? <>
            {tab === "overview" && <>
              <div className="page-title-row"><div><div className="eyebrow">OPERATIONS COMMAND CENTER</div><h1>Good to see you, {displayName.split(" ")[0]} <span className="wave">✳</span></h1><p>Here&apos;s what&apos;s happening across your team&apos;s support queue.</p></div><button className="button button-primary" disabled={!canModify(role)} onClick={() => setShowCreate(true)}><Plus size={17}/> New ticket</button></div>
              <div className="stat-grid">
                <Stat icon={TicketIcon} title="Total tickets" value={tickets.length} subtitle="Most recent 100 tickets"/>
                <Stat icon={Activity} title="Active incidents" value={openTickets} subtitle="Open + in progress"/>
                <Stat icon={CheckCircle2} title="Resolved" value={summary?.by_status.resolved ?? 0} subtitle="Completed incidents"/>
                <Stat icon={Clock3} title="Avg. resolution" value={summary?.average_resolution_hours == null ? "—" : `${summary.average_resolution_hours}h`} subtitle="Resolved tickets"/>
              </div>
              <div className="split-grid">
                <section className="panel"><div className="panel-heading"><div><h2>Recent incidents</h2><p>Latest tickets in your organization</p></div><button className="text-button" onClick={() => setTab("tickets")}>View all <ArrowRight size={15}/></button></div><TicketTable tickets={tickets.slice(0, 6)} onSelect={selectTicket}/></section>
                <section className="panel insights"><div className="panel-heading"><div><h2>Classification mix</h2><p>Current incident distribution</p></div><BarChart3 size={20}/></div>
                  {Object.entries(summary?.by_category ?? {}).length ? Object.entries(summary?.by_category ?? {}).map(([name, count]) => { const denominator = Object.values(summary?.by_category ?? {}).reduce((a,b)=>a+b,0)||1; return <div className="bar-row" key={name}><div><span>{name.replace(/_/g, " ")}</span><strong>{count}</strong></div><div className="bar-track"><div style={{ width: `${(count / denominator) * 100}%` }}/></div></div>; }) : <EmptyState title="No classified tickets yet" subtitle="Classify an incident to populate this view."/>}
                  <div className="insight-note"><Sparkles size={18}/><p>AI classifications are suggestions, not verified accuracy scores. Review uncertain predictions before acting.</p></div>
                </section>
              </div>
            </>}
            {tab === "tickets" && <>
              <div className="page-title-row"><div><div className="eyebrow">INCIDENT MANAGEMENT</div><h1>All tickets</h1><p>Track, prioritize, and resolve your team&apos;s incidents.</p></div><button className="button button-primary" disabled={!canModify(role)} onClick={() => setShowCreate(true)}><Plus size={17}/> Create ticket</button></div>
              <section className="panel"><div className="toolbar"><label className="search-field"><Search size={18}/><input aria-label="Search tickets" placeholder="Search tickets by ID, issue, category…" value={search} onChange={e => setSearch(e.target.value)}/></label><label className="select-wrap"><Filter size={17}/><select value={filter} aria-label="Filter by status" onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></label></div><TicketTable tickets={filteredTickets} onSelect={selectTicket}/></section>
            </>}
            {tab === "knowledge" && <>
              <div className="page-title-row"><div><div className="eyebrow">ORGANIZATIONAL KNOWLEDGE</div><h1>Knowledge base</h1><p>Find evidence before proposing troubleshooting steps.</p></div></div>
              <section className="panel knowledge-panel"><div className="knowledge-head"><BookOpen size={24}/><h2>Search trusted documentation</h2><p>Search currently indexes demonstration Markdown articles, not private company documents.</p></div>
                <form className="knowledge-search" onSubmit={searchArticles}><Search size={19}/><input aria-label="Knowledge query" value={knowledgeQuery} onChange={e=>setKnowledgeQuery(e.target.value)} placeholder="e.g. VPN connection drops or account lockout" minLength={2} required/><button className="button button-primary" type="submit" disabled={knowledgeLoading}>{knowledgeLoading ? <Loader2 size={17} className="spin"/> : <ArrowRight size={17}/>} Search</button></form>
                {articles.length ? <div className="results">{articles.map(article=><article className="knowledge-result" key={article.source}><div className="result-icon"><FileText size={19}/></div><div><h3>{article.source}</h3><p>{article.excerpt}</p><small>Source: {article.source} · Similarity {(article.score*100).toFixed(0)}%</small></div></article>)}</div> : <EmptyState title="Search the knowledge base" subtitle="Retrieved articles will show source names and relevant text here."/>}
              </section>
            </>}
            {tab === "approvals" && <>
              <div className="page-title-row"><div><div className="eyebrow">CONTROLLED AUTOMATION</div><h1>Approval center</h1><p>Human approvals only. No scripts or changes are executed by this application.</p></div></div>
              {canApprove(role) ? <section className="panel"><div className="panel-heading"><div><h2>Automation requests</h2><p>Only another administrator can approve a request.</p></div><span className="pill">{pending.length} pending</span></div><div className="approval-list">{approvals.length ? approvals.map(item=><article className="approval-item" key={item.id}><div className="approval-icon"><Workflow size={19}/></div><div className="approval-content"><h3>{item.playbook.replace(/_/g," ")}</h3><p>Ticket #{item.ticket_id} · Requested by {item.requested_by}</p><small>{item.status.toUpperCase()} · {item.reviewed_by ? `Reviewed by ${item.reviewed_by}` : "Awaiting review"}</small></div>{item.can_approve ? <button className="button button-subtle" disabled={busy} onClick={()=>void run(async()=>{await callApi(organizationId, `automations/${item.id}/approve`,{method:"POST"});}, "Approval recorded. No script executed.")}>Approve <Check size={15}/></button> : <span className="pill">{item.status === "pending" ? "Cannot self-approve" : item.status}</span>}</article>) : <EmptyState title="No automation requests" subtitle="Approved or pending requests will appear here."/>}</div></section>
              : <div className="panel restricted"><ShieldCheck size={28}/><h2>Administrator access required</h2><p>Only organization admins can review approval requests. Technicians can submit requests from ticket details.</p></div>}
            </>}
          </> : null}
          <footer className="footer"><span>© IT-AI Copilot · Organization #{organizationId}</span><span>Role: {me?.role ?? "Unverified"} · Human-in-the-loop operations</span></footer>
        </main>
      </div>
      {showCreate && <CreateTicket onClose={()=>setShowCreate(false)} disabled={busy} onCreate={async(payload)=>{await run(async()=>{const created=await callApi<Ticket>(organizationId,"tickets",{method:"POST",body:payload});setShowCreate(false);setActiveTicket(created);},"Ticket created successfully.");}}/>}
      {activeTicket && <TicketDrawer ticket={activeTicket} org={organizationId} role={role} busy={busy} onClose={()=>setActiveTicket(null)} onAction={run} onRefresh={async()=>{const latest=await callApi<Ticket>(organizationId,`tickets/${activeTicket.id}`);setActiveTicket(latest);}}/>}
    </div>
  );
}

function Stat({ icon: Icon, title, value, subtitle }: { icon: typeof TicketIcon; title: string; value: string | number; subtitle: string }) {
  return <article className="stat-card"><div className="stat-icon"><Icon size={21}/></div><p>{title}</p><strong>{value}</strong><small>{subtitle}</small></article>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-${value}`}><span/> {value.replace(/_/g," ")}</span>;
}

function TicketTable({ tickets, onSelect }: { tickets: Ticket[]; onSelect: (ticket: Ticket)=>void }) {
  return <div className="table-scroll"><table className="ticket-table"><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Created</th><th></th></tr></thead><tbody>{tickets.map(ticket=><tr key={ticket.id} onClick={()=>onSelect(ticket)} className="ticket-row" tabIndex={0} onKeyDown={e=>{ if(e.key==="Enter")onSelect(ticket); }}><td><span className="ticket-id">#{ticket.id.toString().padStart(4,"0")}</span><strong>{ticket.title}</strong><small>{ticket.category?.replace(/_/g, " ") ?? "Not classified"}</small></td><td><StatusPill value={ticket.status}/></td><td><span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span></td><td>{ticket.assignee || <span className="muted">Unassigned</span>}</td><td className="muted">{formatDate(ticket.created_at)}</td><td><ChevronRight size={17}/></td></tr>)}</tbody></table>{!tickets.length && <EmptyState title="No tickets found" subtitle="Create a ticket or change the search filters."/>}</div>;
}

function EmptyState({ title, subtitle }: {title:string;subtitle:string}) {
  return <div className="empty-state"><div className="empty-icon"><ArrowDownLeft size={22}/></div><h3>{title}</h3><p>{subtitle}</p></div>;
}

function CreateTicket({ onClose, onCreate, disabled }: { onClose:()=>void;onCreate:(body:object)=>Promise<void>;disabled:boolean }) {
  const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [priority,setPriority]=useState("medium");
  return <div className="overlay" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label="Create ticket" onMouseDown={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">NEW INCIDENT</span><h2>Create ticket</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></div><form onSubmit={async e=>{e.preventDefault();await onCreate({title,description,priority});}}><label>Ticket title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} minLength={3} placeholder="e.g. VPN disconnects during meetings" required /></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} minLength={3} rows={5} placeholder="Describe the symptoms, affected devices, and troubleshooting already tried" required/></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}>{priorities.map(p=><option key={p} value={p}>{p}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-subtle" onClick={onClose}>Cancel</button><button disabled={disabled} className="button button-primary" type="submit">{disabled ? <Loader2 size={18} className="spin"/> : <Plus size={18}/>} Create ticket</button></div></form></div></div>;
}

function TicketDrawer({ ticket,org,role,busy,onClose,onAction,onRefresh }: {
  ticket:Ticket;org:string;role:Role|null;busy:boolean;onClose:()=>void;
  onAction:(action:()=>Promise<void>,message:string)=>Promise<void>;onRefresh:()=>Promise<void>;
}) {
  const [status,setStatus]=useState(ticket.status);
  const [priority,setPriority]=useState(ticket.priority);
  const [assignee,setAssignee]=useState(ticket.assignee || "");
  const [prediction,setPrediction]=useState<Prediction|null>(null);
  const [suggestion,setSuggestion]=useState<Suggestion|null>(null);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [localError,setLocalError]=useState("");
  const editable=canModify(role);
  useEffect(()=>{ void callApi<Audit[]>(org,`tickets/${ticket.id}/audit`).then(setAudit).catch(()=>setAudit([])); },[org,ticket.id]);
  const action=async(fn:()=>Promise<void>,message:string)=>{
    setLocalError("");
    try {await onAction(fn,message);await onRefresh();setAudit(await callApi<Audit[]>(org,`tickets/${ticket.id}/audit`));}
    catch(e){setLocalError(e instanceof Error?e.message:"Action failed");}
  };
  return <div className="overlay overlay-drawer" onMouseDown={onClose} role="presentation"><aside className="drawer" role="dialog" aria-modal="true" aria-label={ticket.title} onMouseDown={e=>e.stopPropagation()}>
    <div className="drawer-head"><div><span className="eyebrow">INCIDENT #{ticket.id.toString().padStart(4,"0")}</span><h2>{ticket.title}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <div className="drawer-content">{localError && <div className="alert error">{localError}</div>}<div className="drawer-meta"><StatusPill value={ticket.status}/><span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span><span>{formatDate(ticket.created_at)}</span></div>
    <section className="drawer-section"><h3>Incident details</h3><p className="description">{ticket.description}</p></section>
    {editable && <section className="drawer-section"><h3>Manage incident</h3><div className="form-grid"><label>Status<select value={status} onChange={e=>setStatus(e.target.value as Ticket["status"])}>{statuses.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as Ticket["priority"])}>{priorities.map(p=><option key={p}>{p}</option>)}</select></label></div><label>Assigned technician<input value={assignee} onChange={e=>setAssignee(e.target.value)} maxLength={120} placeholder="Team member or queue"/></label><button className="button button-subtle" disabled={busy} onClick={()=>void action(async()=>{await callApi(org,`tickets/${ticket.id}`,{method:"PATCH",body:{status,priority,assignee:assignee||null}});},"Ticket updated.")}><Check size={16}/> Save changes</button></section>}
    <section className="drawer-section"><div className="section-heading"><h3><Bot size={18}/> ML classification</h3><span className="pill">{ticket.category || "Unclassified"}</span></div><p>Predict an incident category using the locally trained classifier. Low-confidence results require human review.</p>{editable&&<button className="button button-subtle" disabled={busy} onClick={()=>void action(async()=>{setPrediction(await callApi<Prediction>(org,`tickets/${ticket.id}/classify`,{method:"POST"}));},"Classification complete. Review model confidence.")}><Sparkles size={16}/> Classify ticket</button>}{prediction&&<div className="ai-answer"><strong>{prediction.label.replace(/_/g," ")}</strong> · Score {(prediction.confidence*100).toFixed(1)}%{prediction.needs_review&&<div className="warning-text"><CircleAlert size={15}/> Uncertain result — human review required</div>}</div>}</section>
    <section className="drawer-section"><h3><Sparkles size={18}/> AI resolution assistant</h3><p>Generate cautious troubleshooting suggestions using approved knowledge sources.</p>{editable&&<button className="button button-subtle" disabled={busy} onClick={()=>void action(async()=>{setSuggestion(await callApi<Suggestion>(org,`tickets/${ticket.id}/suggest`,{method:"POST"}));},"AI suggestion retrieved. Validate before following any steps.")}><Send size={16}/> Generate suggestions</button>}{suggestion&&<div className="ai-answer"><span className="pill">{suggestion.provider}</span><p>{suggestion.suggestion}</p><div><strong>Sources:</strong> {suggestion.sources.join(", ") || "None available"}</div><small>Human review required. No changes were executed.</small></div>}</section>
    {editable&&<section className="drawer-section"><h3><Workflow size={18}/> Request automation approval</h3><p>No script execution. Requests must be approved by a different organization administrator.</p><div className="automation-actions">{["collect_diagnostics","request_password_reset"].map(name=><button key={name} className="button button-subtle" disabled={busy} onClick={()=>void action(async()=>{await callApi(org,`tickets/${ticket.id}/automations`,{method:"POST",body:{playbook:name}});},"Automation approval requested. Nothing was executed.")}>{name.replace(/_/g," ")}</button>)}</div></section>}
    <section className="drawer-section"><h3><Clock3 size={18}/> Audit trail</h3>{audit.length ? <div className="audit-list">{audit.map((item,i)=><div key={i} className="audit-item"><span className="audit-dot"/><div><strong>{item.action.replace(/_/g," ")}</strong><small>{formatDate(item.created_at)} · {item.actor}</small></div></div>)}</div> : <p>No audit events loaded.</p>}</section>
    </div>
  </aside></div>;
}
