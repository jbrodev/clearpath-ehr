// Shared workflow state for a patient across all three roles.
// Persisted on the backend via /api/workflow/{patient_id}. All three roles
// read the same workflow object and write their own slice.

import type { Role } from "./roles";

export type ClearanceStatus =
  | "not_started"
  | "request_sent"          // surgical office sent initial request to PCP
  | "in_review"             // PCP reviewing
  | "awaiting_consult"      // PCP coordinating a specialist
  | "cleared"               // PCP signed off → ready for surgery
  | "deferred"              // PCP wants the procedure deferred
  | "rejected";             // patient not safe for the procedure

export type DeliveryChannel = "email" | "fax" | "direct" | "in-app";
export type DeliveryStatus = "sent" | "captured" | "failed" | "queued";

export interface LetterDelivery {
  via: DeliveryChannel;
  to: string;             // recipient address (email, fax #, direct id, etc.)
  sentAt: string;
  status: DeliveryStatus;
  detail?: string | null;
}

export interface SentLetter {
  id: string;
  to: string;             // recipient label (e.g. "Cardiology", "Dr. Marquez")
  subject: string;
  bodyHtml: string;
  sentAt: string;         // ISO timestamp
  /** Which role created/sent this letter. */
  sentBy: Role;
  /** Transmission attempts (email, fax, etc.). Each entry persists on the
   * workflow so the role UIs can show a complete delivery trail. */
  deliveries?: LetterDelivery[];
}

export interface PreOpData {
  /** Per-specialty consult status: pending → received → done. */
  consults?: Record<string, "pending" | "received" | "n/a">;
  /** Free-form note from the coordinator. */
  coordinatorNote?: string;
}

export interface PcpData {
  decision?: "signed_off" | "pushed_back" | "deferred";
  decisionAt?: string;
  decisionNote?: string;
  responseLetterId?: string;  // id in workflow.letters
}

export interface SurgeonData {
  initialRequestSent?: boolean;
  initialRequestSentAt?: string;
  initialLetterId?: string;
  scheduledProcedure?: string;
  scheduledDate?: string;
}

export interface Workflow {
  status: ClearanceStatus;
  updatedBy?: Role;
  updatedAt: string;
  letters: SentLetter[];
  preop?: PreOpData;
  pcp?: PcpData;
  surgeon?: SurgeonData;
}

export const EMPTY_WORKFLOW: Workflow = {
  status: "not_started",
  updatedAt: new Date(0).toISOString(),
  letters: [],
};

const STATUS_VARIANT: Record<
  ClearanceStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  not_started: "neutral",
  request_sent: "info",
  in_review: "info",
  awaiting_consult: "warning",
  cleared: "success",
  deferred: "warning",
  rejected: "danger",
};

const STATUS_LABEL: Record<ClearanceStatus, string> = {
  not_started: "Not Started",
  request_sent: "Request Sent",
  in_review: "In Review",
  awaiting_consult: "Awaiting Consult",
  cleared: "Cleared",
  deferred: "Deferred",
  rejected: "Rejected",
};

export function statusLabel(s: ClearanceStatus): string {
  return STATUS_LABEL[s];
}

export function statusVariant(s: ClearanceStatus) {
  return STATUS_VARIANT[s];
}

export function newLetterId(): string {
  return `ltr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
