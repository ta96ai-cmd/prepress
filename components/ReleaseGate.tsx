// components/ReleaseGate.tsx
// The Release Gate — shows the condensed checklist for a ticket's complexity,
// requires all items checked, then calls release_ticket (which also fires the
// tool auto-update). Used on the ticket detail page and the /release queue.

"use client";

import { useEffect, useState, useCallback } from "react";
import { pp } from "@/lib/supabase";
import { GateItem, Complexity } from "@/lib/types";

interface Props {
  ticketId: string;
  complexity: Complexity;
  onReleased: () => void;
}

export function ReleaseGate({ ticketId, complexity, onReleased }: Props) {
  const [items, setItems] = useState<GateItem[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await pp
      .from("gate_items")
      .select("id,complexity,seq,item_text,active")
      .eq("complexity", complexity)
      .eq("active", true)
      .order("seq");
    setItems((data as GateItem[]) ?? []);
    setLoading(false);
  }, [complexity]);

  useEffect(() => { load(); }, [load]);

  const allChecked = items.length > 0 && items.every((i) => checked[i.id]);

  async function release() {
    setError(null);
    if (!allChecked) { setError("Tick every item before releasing."); return; }
    setBusy(true);
    const payload = items.map((i) => ({ id: i.id, checked: !!checked[i.id] }));
    const { error } = await pp.rpc("release_ticket", {
      p_ticket_id: ticketId,
      p_items: payload,
      p_note: null,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onReleased();
  }

  if (loading) return <p className="text-sm text-gray-400">Loading checklist...</p>;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Confirm each item, then release. Releasing stamps the tools used and logs them out.
      </p>
      <div className="space-y-1.5 mb-4">
        {items.map((i) => (
          <label key={i.id} className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={!!checked[i.id]}
              onChange={(e) => setChecked((c) => ({ ...c, [i.id]: e.target.checked }))}
              className="w-4 h-4 mt-0.5 shrink-0"
            />
            <span>{i.item_text}</span>
          </label>
        ))}
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</div>}
      <button
        onClick={release}
        disabled={busy || !allChecked}
        className="bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-sm font-semibold rounded-md px-5 py-2.5 transition-colors"
      >
        {busy ? "Releasing..." : `Release ticket (${items.filter((i) => checked[i.id]).length}/${items.length})`}
      </button>
    </div>
  );
}