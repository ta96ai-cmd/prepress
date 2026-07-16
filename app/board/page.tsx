// app/board/page.tsx
// Board — the kanban home screen. Shows tickets as cards grouped by status.
// Reads from prepress.v_ticket_board (via the authenticated client).

"use client";

import { useEffect, useState, useMemo } from "react";
import { AppGuard } from "@/components/AppGuard";
import { pp } from "@/lib/supabase";
import { BoardTicket, TicketStatus, STATUS_LABEL } from "@/lib/types";

const COLUMNS: TicketStatus[] = [
  "RECEIVED",
  "IN_DESIGN",
  "WITH_CLIENT",
  "APPROVED",
  "RELEASED",
];

function BoardInner() {
  const [tickets, setTickets] = useState<BoardTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await pp
        .from("v_ticket_board")
        .select(
          "id,ticket_no,job_name,client_code,client_name,complexity,job_type,is_confidential,status,assigned_designer,due_date,status_changed_at,days_in_stage,is_stuck"
        )
        .order("status_changed_at", { ascending: false });
      if (error) setError(error.message);
      else setTickets((data as BoardTicket[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.ticket_no?.toLowerCase().includes(q) ||
        t.job_name?.toLowerCase().includes(q) ||
        t.client_name?.toLowerCase().includes(q) ||
        t.client_code?.toLowerCase().includes(q)
    );
  }, [tickets, search]);

  const byStatus = useMemo(() => {
    const map: Record<string, BoardTicket[]> = {};
    for (const col of COLUMNS) map[col] = [];
    for (const t of filtered) if (map[t.status]) map[t.status].push(t);
    return map;
  }, [filtered]);

  const heldOrCancelled = useMemo(
    () => filtered.filter((t) => t.status === "ON_HOLD" || t.status === "CANCELLED"),
    [filtered]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ticket board</h1>
          <p className="text-sm text-gray-600">
            {loading ? "Loading..." : `${filtered.length} tickets`}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket / job / client..."
            className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <a
            href="/intake"
            className="bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors whitespace-nowrap"
          >
            + New ticket
          </a>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-gray-900 font-medium">No tickets yet</p>
          <p className="text-sm text-gray-600 mt-1">Create your first ticket to see it here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {COLUMNS.map((col) => (
          <div key={col} className="min-w-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {STATUS_LABEL[col]}
              </span>
              <span className="text-xs text-gray-400">{byStatus[col].length}</span>
            </div>
            <div className="space-y-2">
              {byStatus[col].map((t) => (
                <TicketCard key={t.id} t={t} />
              ))}
              {byStatus[col].length === 0 && (
                <div className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-md">
                  —
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {heldOrCancelled.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            On hold / cancelled
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {heldOrCancelled.map((t) => (
              <TicketCard key={t.id} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ t }: { t: BoardTicket }) {
  return (
    <a
      href={`/ticket/${t.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm hover:border-gray-300 transition-all"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-900">{t.ticket_no}</span>
        <div className="flex items-center gap-1">
          {t.is_stuck && <span className="stuck-dot" title="Stuck over 2 days" />}
          <span className="badge badge-complexity">{t.complexity}</span>
        </div>
      </div>
      <div className="text-sm text-gray-900 font-medium leading-tight mb-1 truncate">
        {t.job_name}
      </div>
      <div className="text-xs text-gray-500 truncate">
        {t.client_code} · {t.client_name}
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{t.job_type}</span>
        {t.is_confidential && (
          <span className="text-[9px] font-semibold text-red-600 bg-red-50 rounded px-1.5 py-0.5">CONFIDENTIAL</span>
        )}
        {t.due_date && (
          <span className="text-[9px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 ml-auto whitespace-nowrap">Due {t.due_date}</span>
        )}
      </div>
    </a>
  );
}

export default function BoardPage() {
  return (
    <AppGuard>
      <BoardInner />
    </AppGuard>
  );
}