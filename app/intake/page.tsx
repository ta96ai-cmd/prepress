// app/intake/page.tsx
// Intake — the <90-second ticket creator. Owner/manager only.
// Flow: client → job name → type/complexity → processes (tap) → assign designer
//       → Create → ticket number appears + copyable WhatsApp line.
// Proves the whole chain: numbering, client snapshot, slug freeze.

"use client";

import { useEffect, useMemo, useState } from "react";
import { AppGuard } from "@/components/AppGuard";
import { useAuth } from "@/hooks/useAuth";
import { supabase, pp } from "@/lib/supabase";
import {
  Client,
  TeamMember,
  JobType,
  nameFromEmail,
} from "@/lib/types";

// Complexity + processes removed from intake. Every ticket defaults to C3 so the
// universal release checklist (formerly the C3 list) always applies.

function IntakeInner() {
  const { canCreateTicket, loading: authLoading } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [designers, setDesigners] = useState<TeamMember[]>([]);

  // form state
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [jobName, setJobName] = useState("");
  const [jobType, setJobType] = useState<JobType>("NEW");
  const complexity = "C3"; // fixed: complexity removed from workflow
  const [assignedDesigner, setAssignedDesigner] = useState("");
  const [brief, setBrief] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ ticket_no: string; due?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load dropdown data once.
  useEffect(() => {
    (async () => {
      const [{ data: cl }, { data: team }] = await Promise.all([
        supabase.from("clients").select("id,name,client_id,active").eq("active", true).order("name"),
        pp.from("v_team").select("user_id,email,role"),
      ]);
      setClients((cl as Client[]) ?? []);
      setDesigners(((team as TeamMember[]) ?? []).filter((t) => t.role === "artist"));
    })();
  }, []);

  

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients
      .filter((c) => c.name.toLowerCase().includes(q) || (c.client_id ?? "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [clients, clientSearch]);

  

  const canSubmit = clientId && jobName.trim() && assignedDesigner && !saving;

  async function handleCreate() {
    setError(null);
    if (!clientId) return setError("Pick a client.");
    if (!jobName.trim()) return setError("Enter a job name.");
    if (!assignedDesigner) return setError("Assign a designer.");

    setSaving(true);
    // 1. Insert the ticket — triggers stamp ticket_no, client_code, slug.
    const { data: ticket, error: tErr } = await pp
      .from("tickets")
      .insert({
        client_id: clientId,
        job_name: jobName.trim(),
        job_type: jobType,
        complexity,
        brief: brief.trim() || null,
        due_date: dueDate || null,
        assigned_designer: assignedDesigner,
        is_confidential: isConfidential,
      })
      .select("id,ticket_no,due_date")
      .single();

    if (tErr || !ticket) {
      setSaving(false);
      setError(tErr?.message ?? "Could not create the ticket.");
      return;
    }

    setSaving(false);
    setCreated({ ticket_no: ticket.ticket_no as string, due: ticket.due_date as string });
  }

  function resetForm() {
    setClientId("");
    setClientSearch("");
    setJobName("");
    setJobType("NEW");
    setAssignedDesigner("");
    setBrief("");
    setDueDate("");
    setIsConfidential(false);
    setCreated(null);
    setError(null);
    setCopied(false);
  }

  const whatsappLine = useMemo(() => {
    if (!created) return "";
    const client = clients.find((c) => c.id === clientId);
    const who = client?.name ?? "";
    const due = created.due ? ` Proof expected by ${created.due}.` : "";
    return `Received${who ? " – " + who : ""}. Ticket ${created.ticket_no}.${due}`;
  }, [created, clients, clientId]);

  async function copyLine() {
    await navigator.clipboard.writeText(whatsappLine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Gate: full, manager, and artist can raise tickets. Others cannot.
  if (!authLoading && !canCreateTicket) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <h1 className="text-lg font-bold text-gray-900">No access to intake</h1>
        <p className="text-sm text-gray-600 mt-2">
          Your account isn&apos;t set up to raise pre-press tickets.
        </p>
      </div>
    );
  }

  // Success view.
  if (created) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Ticket created</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{created.ticket_no}</div>

          <div className="mt-6 text-left">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              WhatsApp reply
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={whatsappLine}
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-gray-50"
              />
              <button
                onClick={copyLine}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md px-4 transition-colors"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-2 justify-center">
            <button
              onClick={resetForm}
              className="bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-md px-5 py-2.5 transition-colors"
            >
              New ticket
            </button>
            <a
              href="/board"
              className="border border-gray-200 hover:bg-gray-50 text-gray-900 text-sm font-semibold rounded-md px-5 py-2.5 transition-colors"
            >
              Go to board
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Intake form.
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">New ticket</h1>
      <p className="text-sm text-gray-600 mb-6">Log an incoming job. Takes under a minute.</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        {/* Client */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Client</label>
          <input
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setClientId("");
            }}
            placeholder="Search client name or code…"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {clientSearch && !clientId && (
            <div className="mt-1 border border-gray-200 rounded-md max-h-44 overflow-y-auto">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientId(c.id);
                    setClientSearch(`${c.client_id ?? ""} · ${c.name}`);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <span className="text-gray-400 mr-2">{c.client_id}</span>
                  {c.name}
                </button>
              ))}
              {filteredClients.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">No match.</div>
              )}
            </div>
          )}
        </div>

        {/* Job name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Job name</label>
          <input
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g. Heena Bindi Label 2-up"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Type</label>
          <div className="flex gap-1">
            {([
              { value: "NEW", label: "New design dev" },
              { value: "EDIT", label: "Edit" },
              { value: "SETUP", label: "Setup" },
            ] as { value: JobType; label: string }[]).map((t) => (
              <button
                key={t.value}
                onClick={() => setJobType(t.value)}
                className={`flex-1 text-xs font-semibold rounded-md py-2 border transition-colors ${
                  jobType === t.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Assign designer */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Assign to</label>
          <div className="flex gap-2">
            {designers.map((d) => (
              <button
                key={d.user_id}
                onClick={() => setAssignedDesigner(d.user_id)}
                className={`flex-1 text-sm font-semibold rounded-md py-2 border transition-colors ${
                  assignedDesigner === d.user_id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {nameFromEmail(d.email)}
              </button>
            ))}
          </div>
        </div>

        {/* Optional: brief, due date, confidential */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Due date <span className="text-gray-400 normal-case">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="w-4 h-4"
              />
              Confidential job
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Brief <span className="text-gray-400 normal-case">(optional)</span>
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="Anything the designer needs to know…"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        <button
          onClick={handleCreate}
          disabled={!canSubmit}
          className="w-full bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-semibold rounded-md py-3 transition-colors"
        >
          {saving ? "Creating…" : "Create ticket"}
        </button>
      </div>
    </div>
  );
}

export default function IntakePage() {
  return (
    <AppGuard>
      <IntakeInner />
    </AppGuard>
  );
}