// app/link/page.tsx
// Link JC — connect a RELEASED prepress ticket to a BOS job number.
// Calls prepress.link_jc, which READS public.jobs (never writes BOS) and
// returns the ticket's production files + tools for BOS to display.

"use client";

import { useState, useEffect, useCallback } from "react";
import { AppGuard } from "@/components/AppGuard";
import { pp } from "@/lib/supabase";
import { BoardTicket } from "@/lib/types";

interface LinkResult {
  ticket_no: string;
  job_name: string;
  client_code: string;
  production_files: { name: string; version: number; storage_path: string | null }[];
  tools: { tool_no: string; type: string; description: string | null; rack: string | null }[];
}

interface ExistingLink {
  id: string;
  ticket_id: string;
  job_no: string;
  linked_at: string;
}

function LinkInner() {
  const [released, setReleased] = useState<BoardTicket[]>([]);
  const [ticketNo, setTicketNo] = useState("");
  const [jobNo, setJobNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [links, setLinks] = useState<ExistingLink[]>([]);

  const load = useCallback(async () => {
    const [{ data: rel }, { data: lk }] = await Promise.all([
      pp.from("v_ticket_board").select("id,ticket_no,job_name,client_code,client_name,complexity,job_type,is_confidential,status,assigned_designer,due_date,status_changed_at,days_in_stage,is_stuck").eq("status", "RELEASED").order("status_changed_at", { ascending: false }),
      pp.from("jc_links").select("id,ticket_id,job_no,linked_at").order("linked_at", { ascending: false }),
    ]);
    setReleased((rel as BoardTicket[]) ?? []);
    setLinks((lk as ExistingLink[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doLink() {
    setError(null); setResult(null);
    if (!ticketNo.trim()) { setError("Pick or type a released ticket number."); return; }
    if (!jobNo.trim()) { setError("Enter the JC / job number."); return; }
    setBusy(true);
    const { data, error } = await pp.rpc("link_jc", {
      p_ticket_no: ticketNo.trim(),
      p_job_no: jobNo.trim(),
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setResult(data as LinkResult);
    setJobNo("");
    load();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Link to job card</h1>
      <p className="text-sm text-gray-600 mb-5">
        Connect a released ticket to its BOS job number. This pulls the production files and tools onto the job.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Released ticket</label>
            <select
              value={ticketNo}
              onChange={(e) => setTicketNo(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a ticket...</option>
              {released.map((t) => (
                <option key={t.id} value={t.ticket_no}>
                  {t.ticket_no} — {t.job_name} ({t.client_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">JC / Job number</label>
            <input
              value={jobNo}
              onChange={(e) => setJobNo(e.target.value)}
              placeholder="e.g. 2607002"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">{error}</div>}
        <button
          onClick={doLink}
          disabled={busy}
          className="mt-4 bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-semibold rounded-md px-5 py-2.5 transition-colors"
        >
          {busy ? "Linking..." : "Link ticket to JC"}
        </button>
      </div>

      {/* Link result — what BOS will show on the job */}
      {result && (
        <div className="bg-white border border-green-200 rounded-lg p-5 mb-5">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Linked</div>
          <div className="text-sm text-gray-900 font-medium mb-3">
            {result.ticket_no} · {result.job_name} · {result.client_code}
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Production files</div>
            {result.production_files.length === 0 ? (
              <p className="text-sm text-gray-400">None yet.</p>
            ) : (
              <ul className="text-sm text-gray-900 font-mono">
                {result.production_files.map((f, i) => (
                  <li key={i}>{f.name}{f.storage_path ? "" : " (local)"}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Tools</div>
            {result.tools.length === 0 ? (
              <p className="text-sm text-gray-400">None linked.</p>
            ) : (
              <ul className="text-sm text-gray-900">
                {result.tools.map((tl, i) => (
                  <li key={i}>
                    <span className="font-bold">{tl.tool_no}</span> — {tl.type}
                    {tl.description ? ` · ${tl.description}` : ""}{tl.rack ? ` · ${tl.rack}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Existing links */}
      <div>
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Existing links</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-400">No links yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-4 py-2">Ticket</th>
                  <th className="px-4 py-2">JC / Job</th>
                  <th className="px-4 py-2">Linked</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const t = released.find((r) => r.id === l.ticket_id);
                  return (
                    <tr key={l.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 font-bold text-gray-900">{t?.ticket_no ?? l.ticket_id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-gray-900">{l.job_no}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{new Date(l.linked_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LinkPage() {
  return (
    <AppGuard>
      <LinkInner />
    </AppGuard>
  );
}