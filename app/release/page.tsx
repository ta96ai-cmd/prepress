// app/release/page.tsx
// Release queue — all APPROVED tickets awaiting release. Managers/owners only.
// Expand a ticket to run its gate inline.

"use client";

import { useEffect, useState, useCallback } from "react";
import { AppGuard } from "@/components/AppGuard";
import { useAuth } from "@/hooks/useAuth";
import { pp } from "@/lib/supabase";
import { ReleaseGate } from "@/components/ReleaseGate";
import { BoardTicket } from "@/lib/types";

function ReleaseInner() {
  const { canRelease, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<BoardTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await pp
      .from("v_ticket_board")
      .select("id,ticket_no,job_name,client_code,client_name,complexity,job_type,is_confidential,status,assigned_designer,due_date,status_changed_at,days_in_stage,is_stuck")
      .eq("status", "APPROVED")
      .order("status_changed_at", { ascending: true });
    setTickets((data as BoardTicket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!authLoading && !canRelease) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <h1 className="text-lg font-bold text-gray-900">Managers only</h1>
        <p className="text-sm text-gray-600 mt-2">Only a manager or owner can release tickets.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Release queue</h1>
      <p className="text-sm text-gray-600 mb-5">
        {loading ? "Loading..." : `${tickets.length} approved ticket${tickets.length === 1 ? "" : "s"} waiting`}
      </p>

      {!loading && tickets.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-gray-900 font-medium">Nothing waiting</p>
          <p className="text-sm text-gray-600 mt-1">Approved tickets appear here for release.</p>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map((t) => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenId(openId === t.id ? null : t.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            >
              <div>
                <span className="font-bold text-gray-900 text-sm">{t.ticket_no}</span>
                <span className="text-sm text-gray-700 ml-2">{t.job_name}</span>
                <span className="text-xs text-gray-500 ml-2">{t.client_code} · {t.client_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-complexity">{t.complexity}</span>
                <span className="text-gray-400 text-sm">{openId === t.id ? "▲" : "▼"}</span>
              </div>
            </button>
            {openId === t.id && (
              <div className="border-t border-gray-100 p-4">
                <ReleaseGate
                  ticketId={t.id}
                  complexity={t.complexity}
                  onReleased={() => { setOpenId(null); load(); }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReleasePage() {
  return (
    <AppGuard>
      <ReleaseInner />
    </AppGuard>
  );
}