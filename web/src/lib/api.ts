// Typed client for the ClearPath REST API.
// API base comes from NEXT_PUBLIC_API_BASE (e.g. http://localhost:8000 in dev,
// https://clearpath-htiy.onrender.com in prod). Empty string means same-origin.

import type { Role } from "./roles";
import type {
  ChatTurn,
  ClearanceResponse,
  PatientSummary,
} from "./types";
import type { LetterDelivery, Workflow } from "./workflow";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

function url(path: string): string {
  return `${API_BASE}${path}`;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function listPatients(): Promise<PatientSummary[]> {
  const res = await fetch(url("/api/patients"), { cache: "no-store" });
  const data = await jsonOrThrow<{ patients: PatientSummary[] }>(res);
  return data.patients;
}

export async function getPatientBundle(patientId: string): Promise<Record<string, unknown>> {
  const res = await fetch(url(`/api/patients/${encodeURIComponent(patientId)}/bundle`), {
    cache: "no-store",
  });
  return jsonOrThrow<Record<string, unknown>>(res);
}

export async function runClearance(
  bundle: Record<string, unknown>,
  query: string,
  role?: Role | null,
): Promise<ClearanceResponse> {
  const res = await fetch(url("/api/clearance"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bundle, query, role: role ?? null }),
  });
  return jsonOrThrow<ClearanceResponse>(res);
}

export async function getWorkflow(patientId: string): Promise<Workflow> {
  const res = await fetch(url(`/api/workflow/${encodeURIComponent(patientId)}`), {
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ workflow: Workflow }>(res);
  return data.workflow;
}

export async function putWorkflow(
  patientId: string,
  workflow: Workflow,
): Promise<Workflow> {
  const res = await fetch(url(`/api/workflow/${encodeURIComponent(patientId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflow }),
  });
  const data = await jsonOrThrow<{ workflow: Workflow }>(res);
  return data.workflow;
}

export function letterPdfUrl(patientId: string, letterId: string): string {
  return url(
    `/api/letters/${encodeURIComponent(patientId)}/${encodeURIComponent(letterId)}/pdf`,
  );
}

export async function downloadLetterPdf(
  patientId: string,
  letterId: string,
  filename: string,
): Promise<void> {
  const res = await fetch(letterPdfUrl(patientId, letterId), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename || "letter.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export interface SendEmailResponse {
  delivery: LetterDelivery;
  workflow: Workflow;
}

export async function sendLetterEmail(args: {
  patientId: string;
  letterId: string;
  toEmail: string;
  toName?: string | null;
  bodyText?: string | null;
}): Promise<SendEmailResponse> {
  const res = await fetch(url(`/api/send/email`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return jsonOrThrow<SendEmailResponse>(res);
}

export async function listWorkflows(): Promise<Record<string, Workflow>> {
  const res = await fetch(url(`/api/workflows`), { cache: "no-store" });
  const data = await jsonOrThrow<{ workflows: Record<string, Workflow> }>(res);
  return data.workflows;
}

export async function uploadBundle(
  bundle: Record<string, unknown>,
): Promise<{ summary: PatientSummary }> {
  const res = await fetch(url("/api/upload"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bundle }),
  });
  return jsonOrThrow<{ summary: PatientSummary }>(res);
}

export interface ChatStreamHandlers {
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

export async function streamChat(
  bundle: Record<string, unknown>,
  assessment: Record<string, unknown>,
  question: string,
  history: ChatTurn[],
  handlers: ChatStreamHandlers,
  role?: Role | null,
): Promise<void> {
  try {
    const res = await fetch(url("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, assessment, question, history, role: role ?? null }),
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE messages are separated by blank lines
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const lines = evt.split("\n").filter((l) => l.startsWith("data:"));
        for (const line of lines) {
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              handlers.onError(new Error(parsed.error));
              return;
            }
            if (parsed.done) {
              handlers.onDone();
              return;
            }
            if (typeof parsed.chunk === "string") {
              handlers.onChunk(parsed.chunk);
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    }
    handlers.onDone();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    handlers.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
