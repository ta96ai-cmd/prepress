// app/ticket/[id]/page.tsx
// Ticket Detail — view a ticket, move its status, edit job specs, see
// files/processes/history, and copy the next canonical filename.
// Reads/writes via prepress RPCs.

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

type ToolKey = "PLATE" | "PUNCH" | "SCREEN" | "BLOCK";

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

// Turn a free-text value into a safe filename token: no spaces, keep
// letters/digits/hyphen (and lowercase x for sizes like 12x18).
function token(s: string): string {
  return s.trim().replace(/\s+/g, "").replace(/[^A-Za-z0-9x\-]/g, "");
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

  // --- Job specs state ---
  const [paperSize, setPaperSize] = useState("");
  const [nColors, setNColors] = useState("");
  const [ups, setUps] = useState("");
  const [splEnabled, setSplEnabled] = useState(false);
  const [splColors, setSplColors] = useState<string[]>([""]);
  const [toolPlate, setToolPlate] = useState(false);
  const [toolPunch, setToolPunch] = useState(false);
  const [toolScreen, setToolScreen] = useState(false);
  const [toolBlock, setToolBlock] = useState(false);
  const [screenText, setScreenText] = useState("");
  const [blockText, setBlockText] = useState("");
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [specsSaved, setSpecsSaved] = useState(false);
  const [editingSpecs, setEditingSpecs] = useState(false);
  // Have specs ever been entered? If not, treat the form as always-editable
  // so the user doesn't need to click Edit for the first entry.
  const specsFilled =
    !!(ticket && (
      (ticket as unknown as { paper_size?: string | null }).paper_size ||
      (ticket as unknown as { n_colors?: number | null }).n_colors != null ||
      (ticket as unknown as { ups?: number | null }).ups != null ||
      (ticket as unknown as { tool_plate?: boolean }).tool_plate ||
      (ticket as unknown as { tool_punch?: boolean }).tool_punch ||
      (ticket as unknown as { tool_screen?: boolean }).tool_screen ||
      (ticket as unknown as { tool_block?: boolean }).tool_block
    ));
  const specsUnlocked = editingSpecs || !specsFilled;

  // Seed the spec form from a freshly-loaded ticket row.
  function initSpecs(t: Record<string, unknown>) {
    setPaperSize((t.paper_size as string) ?? "");
    setNColors(t.n_colors != null ? String(t.n_colors) : "");
    setUps(t.ups != null ? String(t.ups) : "");
    const spl = Array.isArray(t.spl_colors) ? (t.spl_colors as string[]) : [];
    setSplEnabled(spl.length > 0);
    setSplColors(spl.length > 0 ? spl.map(String) : [""]);
    setToolPlate(!!t.tool_plate);
    setToolPunch(!!t.tool_punch);
    setToolScreen(!!t.tool_screen);
    setToolBlock(!!t.tool_block);
    setScreenText((t.screen_text as string) ?? "");
    setBlockText((t.block_text as string) ?? "");
  }

  const load = useCallback(async () => {
    const [{ data: t }, { data: f }, { data: h }] = await Promise.all([
      pp.from("tickets").select("*").eq("id", id).single(),
      pp.from("ticket_files").select("id,file_role,version,canonical_name,storage_path,created_at").eq("ticket_id", id).order("created_at", { ascending: false }),
      pp.from("ticket_status_log").select("id,from_status,to_status,note,changed_at").eq("ticket_id", id).order("changed_at", { ascending: false }),
    ]);
    setTicket((t as Ticket) ?? null);
    if (t) initSpecs(t as unknown as Record<string, unknown>);
    setFiles((f as TicketFile[]) ?? []);
    setHistory((h as StatusLog[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function move(to: TicketStatus) {
    setBusy(true); setError(null);
    const { error } = await pp.rpc("transition_ticket", { p_ticket_id: id, p_to: to, p_note: null });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setEditingSpecs(false);
    await load();
  }

  async function saveSpecs() {
    setSavingSpecs(true); setError(null); setSpecsSaved(false);
    const cleanedSpl = splEnabled
      ? splColors.map((s) => s.trim()).filter(Boolean)
      : [];
    const { error } = await pp.rpc("update_ticket_specs", {
      p_ticket_id: id,
      p_paper_size: paperSize.trim() || null,
      p_n_colors: nColors ? parseInt(nColors, 10) : null,
      p_spl_colors: cleanedSpl,
      p_ups: ups ? parseInt(ups, 10) : null,
      p_tool_plate: toolPlate,
      p_tool_punch: toolPunch,
      p_tool_screen: toolScreen,
      p_tool_block: toolBlock,
      p_screen_text: toolScreen ? (screenText.trim() || null) : null,
      p_block_text: toolBlock ? (blockText.trim() || null) : null,
    });
    setSavingSpecs(false);
    if (error) { setError(error.message); return; }
    setSpecsSaved(true);
    setEditingSpecs(false);
    setTimeout(() => setSpecsSaved(false), 2500);
    load();
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

  async function copyText(name: string) {
    await navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2500);
  }

  // Base for tool files = "<clientCode>_<jobSlug>_<ticketNo>_v1".
  // Prefer stripping an existing reserved name (exact DB slug + version) when
  // one exists; otherwise build it from the ticket. Version defaults to v1 and
  // the designer updates it by hand (see the reminder note below).

  function jobSlug(name: string): string {
    return name
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
      .join("")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 40);
  }
  const toolBase: string | null = files.length
    ? files[0].canonical_name.replace(/_(INPUT|PROOF|APPROVED|PRODUCTION)\.[A-Za-z0-9]+$/i, "")
    : ticket
      ? `${ticket.client_code}_${jobSlug(ticket.job_name)}_${ticket.ticket_no}_v1`
      : null;

  function toolFileName(tool: ToolKey): string | null {
    if (!toolBase) return null;
    let parts: string[] = [];
    if (tool === "PLATE") {
      const spl = (splEnabled ? splColors : [])
        .map((c) => c.trim()).filter(Boolean).map((c) => "SPL-" + token(c));
      parts = [
        "PLATE",
        paperSize.trim() ? token(paperSize) : "",
        nColors ? `${nColors}C` : "",
        ...spl,
      ].filter(Boolean);
    } else if (tool === "PUNCH") {
      parts = ["PUNCH", ups ? `UPS${ups}` : ""].filter(Boolean);
    } else if (tool === "SCREEN") {
      parts = ["SCREEN", screenText.trim() ? token(screenText) : ""].filter(Boolean);
    } else if (tool === "BLOCK") {
      parts = ["BLOCK", blockText.trim() ? token(blockText) : ""].filter(Boolean);
    }
    return `${toolBase}_${parts.join("_")}.cdr`;
  }

  const activeTools: ToolKey[] = [
    toolPlate && "PLATE",
    toolPunch && "PUNCH",
    toolScreen && "SCREEN",
    toolBlock && "BLOCK",
  ].filter(Boolean) as ToolKey[];

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!ticket) return <p className="text-sm text-gray-600">Ticket not found.</p>;

  const moves = NEXT_MOVES[ticket.status] ?? [];
  const inputCls = "border border-gray-200 rounded-md px-2 py-1.5 text-sm w-full";
  const canEditSpecs = ticket.status !== "RELEASED" && ticket.status !== "CANCELLED";

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
        <div className="flex items-center gap-3 flex-wrap">
          <select
            disabled={busy || ticket.status === "RELEASED" || ticket.status === "CANCELLED"}
            value=""
            onChange={(e) => { const v = e.target.value; if (v) move(v as TicketStatus); }}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-white disabled:opacity-40 min-w-[220px]"
          >
            <option value="">Move to…</option>
            {moves.map((m) => (
              <option key={m.to} value={m.to}>{m.label}</option>
            ))}
            {ticket.status !== "RELEASED" && ticket.status !== "CANCELLED" && (
              <>
                <option value="ON_HOLD">Hold</option>
                <option value="CANCELLED">Cancel</option>
              </>
            )}
          </select>
          {ticket.status === "APPROVED" && (
            <span className="text-sm text-gray-500">
              {canRelease ? "Ready to release — use the Release gate." : "Waiting for a manager to release."}
            </span>
          )}
          {ticket.status === "RELEASED" && <span className="text-sm text-green-700 font-medium">Released.</span>}
        </div>
      </section>

      {/* --- JOB SPECS --- */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Job specs</h2>
          {canEditSpecs && !editingSpecs && specsFilled && (
            <button onClick={() => setEditingSpecs(true)}
              className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md px-3 py-1 transition-colors">
              Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Paper size</span>
            <input value={paperSize} onChange={(e) => setPaperSize(e.target.value)}
              
              placeholder="12x18" className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">No. of colors</span>
            <input type="number" min={0} value={nColors} onChange={(e) => setNColors(e.target.value)}
              
              placeholder="4" className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">UPS</span>
            <input type="number" min={0} value={ups} onChange={(e) => setUps(e.target.value)}
              
              placeholder="12" className={inputCls} />
          </label>
        </div>

        {/* Special colors */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={splEnabled} disabled={!canEditSpecs || !specsUnlocked}
              onChange={(e) => { setSplEnabled(e.target.checked); if (e.target.checked && splColors.length === 0) setSplColors([""]); }} />
            Special color(s)
          </label>
          {splEnabled && (
            <div className="mt-2 space-y-2">
              {splColors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c} disabled={!canEditSpecs || !specsUnlocked}
                    onChange={(e) => setSplColors(splColors.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder="color code (e.g. Pantone 485)"
                    className={`${inputCls} max-w-xs`} />
                  {splColors.length > 1 && (
                    <button type="button" disabled={!canEditSpecs || !specsUnlocked}
                      onClick={() => setSplColors(splColors.filter((_, j) => j !== i))}
                      className="text-red-600 text-xs font-semibold px-2 py-1 hover:bg-red-50 rounded-md">
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" disabled={!canEditSpecs || !specsUnlocked}
                onClick={() => setSplColors([...splColors, ""])}
                className="text-xs font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-md px-2 py-1">
                + add another
              </button>
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="mb-4">
          <span className="block text-gray-600 text-sm mb-2">Tools</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={toolPlate} 
              onChange={(e) => setToolPlate(e.target.checked)} /> Plate
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={toolPunch} 
              onChange={(e) => setToolPunch(e.target.checked)} /> Punch
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={toolScreen} 
              onChange={(e) => setToolScreen(e.target.checked)} /> Screen
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={toolBlock} 
              onChange={(e) => setToolBlock(e.target.checked)} /> Block
            </label>
          </div>

          {toolScreen && (
            <div className="mt-3 text-sm max-w-xs">
              <span className="block text-gray-600 mb-1">Screen text (for filename)</span>
              <input value={screenText} disabled={!canEditSpecs || !specsUnlocked}
                onChange={(e) => setScreenText(e.target.value)} className={inputCls} />
            </div>
          )}
          {toolBlock && (
            <div className="mt-3 text-sm max-w-xs">
              <span className="block text-gray-600 mb-1">Block text (for filename)</span>
              <input value={blockText} disabled={!canEditSpecs || !specsUnlocked}
                onChange={(e) => setBlockText(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {canEditSpecs && specsUnlocked && (
          <div className="flex items-center gap-3">
            <button onClick={saveSpecs} disabled={savingSpecs}
              className="bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors">
              {savingSpecs ? "Saving..." : "Save specs"}
            </button>
            {specsFilled && (
              <button
                type="button"
                onClick={() => { if (ticket) initSpecs(ticket as unknown as Record<string, unknown>); setEditingSpecs(false); }}
                className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-md px-4 py-2 transition-colors">
                Cancel
              </button>
            )}
          </div>
        )}
        {specsSaved && !editingSpecs && (
          <div className="text-sm text-green-700 font-medium">Saved.</div>
        )}
      </section>

      {ticket.status === "APPROVED" && canRelease && (
        <section className="bg-white border border-green-200 rounded-lg p-4 mb-4">
          <h2 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">Release gate</h2>
          <ReleaseGate ticketId={ticket.id} complexity={ticket.complexity} onReleased={load} />
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Tool files</h2>
        <p className="text-xs text-gray-500 mb-3">Tick the tools in Job Specs above — the system names each file for you. Copy it, then save your local file with that exact name.</p>
        {copiedName && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3">
            Copied: {copiedName}
          </div>
        )}
        {activeTools.length === 0 ? (
          <p className="text-sm text-gray-400">No tools selected. Tick Plate / Punch / Screen / Block in Job Specs.</p>
        ) : (
          <div>
            {!toolBase ? (
              <p className="text-sm text-gray-400">
                Copy an INPUT name above first — tool filenames build on that base version.
              </p>
            ) : (
              <div className="space-y-1">
                {activeTools.map((tool) => {
                  const name = toolFileName(tool);
                  if (!name) return null;
                  return (
                    <div key={tool} className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 last:border-0 py-1.5">
                      <span className="text-gray-900 font-mono text-xs break-all">{name}</span>
                      <button onClick={() => copyText(name)}
                        className="shrink-0 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md px-2.5 py-1 transition-colors">
                        Copy
                      </button>
                    </div>
                  );
                })}
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2 leading-relaxed">
                  ⚠️ Please update the version (v1, v2…) in the name above.
                  <br />
                  Naam mein version (v1, v2…) khud update karo.
                </p>
              </div>
            )}
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
