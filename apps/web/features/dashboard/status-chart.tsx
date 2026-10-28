"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function StatusChart({ data }: { data: Array<{ status: string; count: number }> }) {
  if (!data.length) return <p className="py-16 text-center text-sm muted">No incidents to chart.</p>;
  return <div role="img" aria-label="Bar chart of ticket counts by status" className="h-72 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.16}/>
        <XAxis dataKey="status" tick={{ fontSize: 11 }} tickFormatter={v => String(v).replaceAll("_", " ")} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#4c78e8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
    <ul className="sr-only">{data.map(item => <li key={item.status}>{item.status}: {item.count}</li>)}</ul>
  </div>;
}
