import Link from "next/link";

export default function NotFound() {
  return <main className="p-8"><h1 className="text-2xl font-bold">Not found</h1>
    <p className="my-4 muted">This resource is unavailable or you do not have access.</p>
    <Link href="/dashboard" className="text-blue-600 underline">Return to dashboard</Link>
  </main>;
}
