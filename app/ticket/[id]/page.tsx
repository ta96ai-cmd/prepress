// app/ticket/[id]/page.tsx
// Ticket Detail — view a ticket, move its status, see files/processes/history,
// and copy the next canonical filename. Reads/writes via prepress RPCs.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppGuard } from "@/components/AppGuard";
import { useAuth } from "@/hooks/useAuth";
import { pp } from "@/lib/supabase";
import { ReleaseGate } from "@/components/ReleaseGate";
import { Ticket, TicketStatus, STATUS_LABEL, FileRole } from "@/lib/types";


const NEXT_MOVES: Partial<Record<TicketStatus, { to: TicketStatus; label: string }[]>> = {
  RECEIVED: [{ to: "IN_DESIGN", label: "Start design" }],
  IN_DESIGN: [{ to: "WITH_CLIENT", label: "Send to client" }],
  WITH_CLIENT: [
    { to: "APPROVED", label: "Client approved" },
    { to: "IN_DESIGN", label: "Client wants changes" },
  ],
  APPROVED: [],
};

const FILE_ROLES: FileRole[] = ["INPUT", "PROOF", "APPROVED", "PRODUCTION"];

interface TicketFile {
  id: string;
  file_role: FileRole;
  version: number;
  canonical_name: string;
  storage_path: string | null;
  created_at: string;
}
interface StatusLog {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
}

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const { canRelease } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [files, setFiles] = useState<TicketFile[]>([]);
  const [history, setHistory] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: f }, { data: h }] = await Promise.all([
      pp.from("tickets").select("*").eq("id", id).single(),
      pp.from("ticket_files").select("id,file_role,version,canonical_name,storage_path,created_at").eq("ticket_id", id).order("created_at", { ascending: false }),
      pp.from("ticket_status_log").select("id,from_status,to_status,note,changed_at").eq("ticket_id", id).order("changed_at", { ascending: false }),
    ]);
    setTicket((t as Ticket) ?? null);
    setFiles((f as TicketFile[]) ?? []);
    setHistory((h as StatusLog[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function move(to: TicketStatus) {
    setBusy(true); setError(null);
    const { error } = await pp.rpc("transition_ticket", { p_ticket_id: id, p_to: to, p_note: null });
    setBusy(false);
    if (error) setError(error.message);
    else load();
  }

  async function copyNextName(role: FileRole) {
    setError(null);
    const ext = role === "INPUT" ? "cdr" : "pdf";
    const { data, error } = await pp.rpc("reserve_file", {
      p_ticket_id: id, p_file_role: role, p_ext: ext, p_original_name: null, p_will_upload: false,
    });
    if (error) { setError(error.message); return; }
    const name = (data as { canonical_name: string })?.canonical_name;
    if (name) {
      await navigator.clipboard.writeText(name);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 2500);
      load();
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!ticket) return <p className="text-sm text-gray-600">Ticket not found.</p>;

  const moves = NEXT_MOVES[ticket.status] ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <a href="/board" className="text-sm text-gray-500 hover:text-gray-900">&larr; Board</a>

      <div className="flex items-start justify-between mt-2 mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{ticket.ticket_no}</h1>
            <span className={`badge badge-status-${ticket.status}`}>{STATUS_LABEL[ticket.status]}</span>
            <span className="badge badge-complexity">{ticket.complexity}</span>
            {ticket.is_confidential && <span className="text-[10px] text-red-600 font-semibold">CONFIDENTIAL</span>}
          </div>
          <div className="text-gray-900 font-medium mt-1">{ticket.job_name}</div>
          <div className="text-sm text-gray-500">{ticket.client_code} · {ticket.client_name} · {ticket.job_type}</div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</div>}

      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Move ticket</h2>
        <div className="flex flex-wrap gap-2">
          {moves.map((m) => (
            <button key={m.to} onClick={() => move(m.to)} disabled={busy}
              className="bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors">
              {m.label}
            </button>
          ))}
          {ticket.status === "APPROVED" && (
            <span className="text-sm text-gray-500 py-2">
              {canRelease ? "Ready to release — use the Release gate." : "Waiting for a manager to release."}
            </span>
          )}
          {ticket.status === "RELEASED" && <span className="text-sm text-green-700 py-2 font-medium">Released.</span>}
          {ticket.status !== "RELEASED" && ticket.status !== "CANCELLED" && (
            <>
              <button onClick={() => move("ON_HOLD")} disabled={busy}
                className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-md px-4 py-2 transition-colors">
                Hold
              </button>
              <button onClick={() => move("CANCELLED")} disabled={busy}
                className="border border-gray-200 hover:bg-gray-50 text-red-600 text-sm font-semibold rounded-md px-4 py-2 transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </section>

      {ticket.status === "APPROVED" && canRelease && (
        <section className="bg-white border border-green-200 rounded-lg p-4 mb-4">
          <h2 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">Release gate</h2>
          <ReleaseGate ticketId={ticket.id} complexity={ticket.complexity} onReleased={load} />
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Files</h2>
        <p className="text-xs text-gray-500 mb-3">Get the correct filename — the system names it for you. Copy it, then save your local file with that exact name.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {FILE_ROLES.map((r) => (
            <button key={r} onClick={() => copyNextName(r)}
              className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md px-3 py-2 transition-colors">
              Copy next {r} name
            </button>
          ))}
        </div>
        {copiedName && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3">
            Copied: {copiedName}
          </div>
        )}
        {files.length === 0 ? (
          <p className="text-sm text-gray-400">No files reserved yet.</p>
        ) : (
          <div className="space-y-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-sm border-b border-gray-100 last:border-0 py-1.5">
                <span className="text-gray-900 font-mono text-xs">{f.canonical_name}</span>
                <span className="text-[10px] text-gray-400">{f.storage_path ? "uploaded" : "local"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No changes yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="text-gray-400 text-xs">{new Date(h.changed_at).toLocaleString()}</span>
                <span>{h.from_status ? `${h.from_status} -> ` : ""}{h.to_status}</span>
                {h.note && <span className="text-gray-400">· {h.note}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <AppGuard>
      <DetailInner />
    </AppGuard>
  );
}