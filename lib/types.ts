// src/lib/types.ts
// Hand-written types mirroring the prepress schema (v2.1 migration).
// Kept deliberately small — expand as screens need more.

export type PrepressRole = "DESIGNER" | "MANAGER" | "OWNER";

export type TicketStatus =
  | "RECEIVED"
  | "IN_DESIGN"
  | "WITH_CLIENT"
  | "APPROVED"
  | "RELEASED"
  | "ON_HOLD"
  | "CANCELLED";

export type JobType = "NEW" | "EDIT" | "REPEAT";
export type Complexity = "C1" | "C2" | "C3";
export type FileRole = "INPUT" | "PROOF" | "APPROVED" | "PRODUCTION";
export type ToolType = "DIE" | "BLOCK" | "SCREEN" | "PLATE_SET";
export type MovementType = "ISSUED" | "RETURNED" | "RELOCATED" | "RETIRED";

// The 5 working states designers/managers move through, in order.
// Hold/Cancel are off-board actions, handled separately.
export const WORKING_STATUSES: TicketStatus[] = [
  "RECEIVED",
  "IN_DESIGN",
  "WITH_CLIENT",
  "APPROVED",
  "RELEASED",
];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  RECEIVED: "Received",
  IN_DESIGN: "In Design",
  WITH_CLIENT: "With Client",
  APPROVED: "Approved",
  RELEASED: "Released",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

export const COMPLEXITY_LABEL: Record<Complexity, string> = {
  C1: "C1 · Simple",
  C2: "C2 · Standard",
  C3: "C3 · Complex",
};

export interface Client {
  id: string;
  name: string;
  client_id: string | null; // the C0xx code
  active: boolean | null;
}

export interface ProcessMaster {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface Ticket {
  id: string;
  ticket_no: string | null;
  client_id: string;
  client_code: string | null;
  client_name: string | null;
  job_name: string;
  job_slug: string | null;
  job_type: JobType;
  product_type: string | null;
  brief: string | null;
  change_list: string | null;
  complexity: Complexity;
  is_confidential: boolean;
  reference_ticket_id: string | null;
  assigned_designer: string | null;
  substrate: string | null;
  colours: string | null;
  finish_size: string | null;
  due_date: string | null;
  status: TicketStatus;
  status_changed_at: string;
  held_from_status: TicketStatus | null;
  created_by: string | null;
  created_at: string;
}

// Row shape from view v_ticket_board
export interface BoardTicket {
  id: string;
  ticket_no: string;
  job_name: string;
  client_code: string | null;
  client_name: string | null;
  complexity: Complexity;
  job_type: JobType;
  is_confidential: boolean;
  status: TicketStatus;
  assigned_designer: string | null;
  due_date: string | null;
  status_changed_at: string;
  days_in_stage: number;
  is_stuck: boolean;
}

export interface GateItem {
  id: string;
  complexity: Complexity;
  seq: number;
  item_text: string;
  active: boolean;
}

// Shape returned by the reserve_file RPC
export interface ReservedFile {
  canonical_name: string;
  version: number;
  storage_path: string | null;
}

// Row from view v_team (safe id + email + role for dropdowns)
export interface TeamMember {
  user_id: string;
  email: string;
  role: string;
}

// A friendlier display name derived from an email (naseem@navratan.com → Naseem)
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}