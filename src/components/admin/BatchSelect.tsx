"use client";

import { useRouter } from "next/navigation";

type Batch = { id: string; name: string; status: string };

// The one filter row of the dashboard: scopes every number and chart below it.
export function BatchSelect({ batches, value, basePath = "/admin" }: { batches: Batch[]; value: string; basePath?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3">
      <span className="admin-label">Batch</span>
      <select value={value} onChange={(e) => router.replace(`${basePath}?batch=${e.target.value}`)} className="input !min-h-11 !w-auto min-w-44 !py-1">
        <option value="all">All batches</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.status})
          </option>
        ))}
      </select>
    </label>
  );
}
