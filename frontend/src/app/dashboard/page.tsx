import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ChooseOrganization() {
  const session = await auth();
  if (!session) redirect("/login");
  return <main className="org-select"><div className="org-panel"><div className="eyebrow">ORGANIZATION WORKSPACE</div><h1>Open your command center</h1><p>Enter the numeric organization ID assigned by your administrator. The backend verifies your membership on every request—entering another ID does not grant access.</p><form action={async (formData) => { "use server"; const id = String(formData.get("organization") || ""); if (!/^[1-9][0-9]{0,8}$/.test(id)) return; redirect("/dashboard/" + id); }}><label htmlFor="organization">Organization ID</label><input name="organization" id="organization" inputMode="numeric" pattern="[1-9][0-9]*" required placeholder="e.g. 1" /><button className="button button-primary" type="submit">Open dashboard</button></form><Link href="/">← Back to home</Link></div></main>;
}
