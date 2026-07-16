// app/tools/page.tsx
// Tool Registry — register dies/blocks/screens/plates (auto IDs D-/B-/S-/P-###),
// search the list, log movements. Answers "where is that die?".

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { AppGuard } from "@/components/AppGuard";
import { pp, supabase } from "@/lib/supabase";
import { ToolType } from "@/lib/types";
import { Client } from "@/lib/types";

interface ToolRow {
  id: string;
  tool_no: string;
  tool_type: ToolType;
  description: string | null;
  client_name: string | null;
  location_rack: string | null;
  condition: string;
  use_count: number;
  last_used_at: string | null;
  is_confidential: boolean;
  last_ticket_no: string | null;
}

const TOOL_TYPES: { value: ToolType; label: string }[] = [
  { value: "DIE", label: "Die" },
  { value: "BLOCK", label: "Block" },
  { value: "SCREEN", label: "Screen" },
  { value: "PLATE_SET", label: "Plate set" },
];

function ToolsInner() {
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // new-tool form
  const [toolType, setToolType] = useState<ToolType>("DIE");
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [description, setDescription] = useState("");
  const [rack, setRack] = useState("");
  const [confidential, setConfidential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: tl }, { data: cl }] = await Promise.all([
      pp.from("v_tool_registry").select("id,tool_no,tool_type,description,client_name,location_rack,condition,use_count,last_used_at,is_confidential,last_ticket_no").order("tool_no"),
      supabase.from("clients").select("id,name,client_id,active").eq("active", true).order("name"),
    ]);
    setTools((tl as ToolRow[]) ?? []);
    setClients((cl as Client[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 30);
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.client_id ?? "").toLowerCase().includes(q)).slice(0, 30);
  }, [clients, clientSearch]);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) =>
      t.tool_no.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q) ||
      (t.client_name ?? "").toLowerCase().includes(q) ||
      (t.location_rack ?? "").toLowerCase().includes(q)
    );
  }, [tools, search]);

  async function register() {
    setError(null);
    if (!description.trim()) { setError("Add a description."); return; }
    setSaving(true);
    const { data, error } = await pp.rpc("register_tool", {
      p_tool_type: toolType,
      p_client_id: clientId || null,
      p_description: description.trim(),
      p_location_rack: rack.trim() || null,
      p_ticket_id: null,
      p_is_confidential: confidential,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    const newNo = (data as { tool_no: string })?.tool_no;
    setJustAdded(newNo ?? null);
    setTimeout(() => setJustAdded(null), 4000);
    // reset
    setDescription(""); setRack(""); setClientId(""); setClientSearch(""); setConfidential(false);
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tool registry</h1>
          <p className="text-sm text-gray-600">{loading ? "Loading..." : `${filteredTools.length} tools`}</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tool / client / rack..."
            className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setShowForm((s) => !s)}
            className="bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors whitespace-nowrap">
            {showForm ? "Close" : "+ Register tool"}
          </button>
        </div>
      </div>

      {justAdded && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-4">
          Registered <span className="font-bold">{justAdded}</span> — write this number on the physical tool.
        </div>
      )}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</div>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5 max-w-2xl">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Register a new tool</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Type</label>
              <div className="flex gap-1">
                {TOOL_TYPES.map((t) => (
                  <button key={t.value} onClick={() => setToolType(t.value)}
                    className={`flex-1 text-xs font-semibold rounded-md py-2 border transition-colors ${toolType === t.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Heena Bindi 4-up cutting die"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Client (optional)</label>
              <input value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientId(""); }} placeholder="Search client..."
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {clientSearch && !clientId && (
                <div className="mt-1 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(`${c.client_id ?? ""} · ${c.name}`); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                      <span className="text-gray-400 mr-2">{c.client_id}</span>{c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rack / location</label>
                <input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="e.g. Rack B-3"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2 cursor-pointer">
                  <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="w-4 h-4" />
                  Confidential
                </label>
              </div>
            </div>
            <button onClick={register} disabled={saving}
              className="w-full bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-semibold rounded-md py-2.5 transition-colors">
              {saving ? "Registering..." : "Register tool"}
            </button>
          </div>
        </div>
      )}

      {/* Tool list */}
      {!loading && filteredTools.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-gray-900 font-medium">No tools yet</p>
          <p className="text-sm text-gray-600 mt-1">Register your first die, block, screen, or plate set.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-2">Tool</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Rack</th>
                <th className="px-4 py-2">Uses</th>
                <th className="px-4 py-2">Condition</th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 font-bold text-gray-900">
                    {t.tool_no}
                    {t.is_confidential && <span className="ml-1 text-[9px] text-red-600">●</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{t.tool_type}</td>
                  <td className="px-4 py-2 text-gray-900">{t.description}</td>
                  <td className="px-4 py-2 text-gray-600">{t.client_name ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{t.location_rack ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{t.use_count}</td>
                  <td className="px-4 py-2 text-gray-600">{t.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ToolsPage() {
  return (
    <AppGuard>
      <ToolsInner />
    </AppGuard>
  );
}