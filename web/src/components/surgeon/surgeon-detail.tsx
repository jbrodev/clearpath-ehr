"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AssessmentView } from "@/components/assessment/assessment-view";
import { ChatPanel } from "@/components/assessment/chat-panel";
import { EhrLink } from "@/components/ehr-link";
import { LetterActions } from "@/components/letters/letter-actions";
import { PrintableLetter } from "@/components/letters/printable-letter";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { RoleInsights } from "@/components/workflow/role-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/workflow/status-badge";
import { ageFromDob, formatDob, formatGender, titleCase } from "@/lib/format";
import { useClearance } from "@/lib/hooks/use-clearance";
import { usePatients } from "@/lib/hooks/use-patients";
import { useWorkflow } from "@/lib/hooks/use-workflow";
import type { SpecialistFinding } from "@/lib/types";
import { newLetterId, type SentLetter, type Workflow } from "@/lib/workflow";

interface Props {
  patientId: string;
}

interface Recipient {
  id: string;            // "pcp" or "specialty:cardiology"
  label: string;
  to: string;
  kind: "pcp" | "specialty";
  specialty?: string;
  greetingName: string;
}

function pcpRecipient(pcpDoctor: string | null): Recipient {
  const name = pcpDoctor ?? "Primary Care Provider";
  return {
    id: "pcp",
    label: "PCP",
    to: name,
    kind: "pcp",
    greetingName: name,
  };
}

function findSpecialistDoctor(
  findings: SpecialistFinding[],
  specialty: string,
): string | null {
  const match = findings.find(
    (f) => f.specialty.toLowerCase() === specialty.toLowerCase(),
  );
  return match?.doctor_name ?? null;
}

function specialtyRecipient(sp: string, doctor: string | null): Recipient {
  const titled = titleCase(sp);
  return {
    id: `specialty:${sp.toLowerCase()}`,
    label: titled,
    to: doctor ? `${doctor}, ${titled}` : `${titled} Department`,
    kind: "specialty",
    specialty: sp.toLowerCase(),
    greetingName: doctor ?? `${titled} Team`,
  };
}

function defaultSubject(recipient: Recipient, patientName: string, dob: string | null | undefined): string {
  const dobLabel = dob ? `, DOB ${dob}` : "";
  if (recipient.kind === "pcp") {
    return `Pre-Operative Clearance Request — ${patientName}${dobLabel}`;
  }
  return `Pre-Operative ${titleCase(recipient.specialty ?? "")} Clearance — ${patientName}${dobLabel}`;
}

function templateBody(
  recipient: Recipient,
  patientName: string,
  procedure: string | null,
  triggers: string[],
): string {
  const proc = procedure ?? "an upcoming surgical procedure";
  const triggerList =
    triggers.length > 0
      ? `<ul>${triggers
          .slice(0, 5)
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join("")}</ul>`
      : "<p><em>No specific Tier-1 triggers identified by ClearPath. Standard pre-operative review.</em></p>";

  const greeting = `<p>Dear ${escapeHtml(recipient.greetingName)},</p>`;

  if (recipient.kind === "pcp") {
    return `${greeting}
<p>Our office is scheduling <strong>${escapeHtml(patientName)}</strong> for ${escapeHtml(proc)}. We are requesting your <strong>pre-operative medical clearance</strong> prior to the procedure.</p>
<p>Our ClearPath risk assessment flagged the following items for your review:</p>
${triggerList}
<p>Please review the patient and respond with either a clearance letter or any further workup you recommend. If specialist input is needed, please coordinate that consult on your end and forward their clearance along with your own.</p>
<p>The ClearPath risk summary, vitals, labs, and active medication list are attached for your reference.</p>
<p>Thank you for your collaboration,<br/>[Surgical Office / Referring Surgeon]</p>`;
  }
  const sp = titleCase(recipient.specialty ?? "Specialist");
  return `${greeting}
<p>Our office is scheduling <strong>${escapeHtml(patientName)}</strong> for ${escapeHtml(proc)} and is requesting direct <strong>${sp.toLowerCase()} clearance</strong> prior to the procedure.</p>
<p>The patient&apos;s chart raised the following items in your domain:</p>
${triggerList}
<p>Please advise on:</p>
<ul>
  <li>Whether the patient is appropriately optimized from a ${sp.toLowerCase()} standpoint,</li>
  <li>Any peri-operative recommendations (medication holds, monitoring, additional testing).</li>
</ul>
<p>Thank you,<br/>[Surgical Office / Referring Surgeon]</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findSurgeonDraft(workflow: Workflow, recipient: Recipient): SentLetter | undefined {
  return workflow.letters.find(
    (l) =>
      l.sentBy === "surgeon" &&
      l.to === recipient.to &&
      l.subject.startsWith(
        recipient.kind === "pcp" ? "Pre-Operative Clearance Request" : "Pre-Operative",
      ),
  );
}

export function SurgeonPatientDetail({ patientId }: Props) {
  const { patients } = usePatients();
  const summary = patients.find((p) => p.id === patientId);

  const {
    bundle,
    bundleLoading,
    bundleError,
    clearance,
    clearanceLoading,
    clearanceError,
    run,
  } = useClearance(patientId, "surgeon");

  const { workflow, error: wfError, patch, reload: reloadWorkflow } = useWorkflow(patientId);

  const [procEdit, setProcEdit] = useState<string>("");
  const [dateEdit, setDateEdit] = useState<string>("");
  const [procSaving, setProcSaving] = useState(false);

  // Seed local proc/date once workflow loads.
  useEffect(() => {
    const next = workflow.surgeon?.scheduledProcedure ?? "";
    const nextDate = workflow.surgeon?.scheduledDate ?? "";
    if (procEdit === "" && next) setProcEdit(next);
    if (dateEdit === "" && nextDate) setDateEdit(nextDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.surgeon?.scheduledProcedure, workflow.surgeon?.scheduledDate]);

  const age = ageFromDob(summary?.dob ?? null);
  const patientName = summary?.name ?? "Patient";
  const procedure = workflow.surgeon?.scheduledProcedure ?? summary?.procedureHint ?? null;

  const recipients = useMemo<Recipient[]>(() => {
    const list: Recipient[] = [pcpRecipient(summary?.pcpDoctor ?? null)];
    if (clearance) {
      for (const sp of clearance.clearance.recommended_specialties) {
        const doc = findSpecialistDoctor(
          clearance.clearance.specialist_findings,
          sp,
        );
        list.push(specialtyRecipient(sp, doc));
      }
    }
    return list;
  }, [summary?.pcpDoctor, clearance]);

  const [activeTab, setActiveTab] = useState<string>("pcp");

  const [drafts, setDrafts] = useState<
    Record<string, { to: string; subject: string; bodyHtml: string }>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Seed envelope fields only — body stays EMPTY until user clicks Generate draft.
  const summaryDob = summary?.dob ?? null;
  useEffect(() => {
    if (!clearance && !summary) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of recipients) {
        if (next[r.id]) continue;
        const existing = findSurgeonDraft(workflow, r);
        next[r.id] = existing
          ? { to: existing.to, subject: existing.subject, bodyHtml: existing.bodyHtml }
          : {
              to: r.to,
              subject: defaultSubject(r, patientName, summaryDob),
              bodyHtml: "",
            };
      }
      return next;
    });
    if (!recipients.some((r) => r.id === activeTab) && recipients[0]) {
      setActiveTab(recipients[0].id);
    }
  }, [recipients, workflow, patientName, summaryDob, summary, clearance, activeTab]);

  const generateDraft = (recipient: Recipient) => {
    const triggers = clearance?.clearance.triggering_factors ?? [];
    setDraftField(
      recipient.id,
      "bodyHtml",
      templateBody(recipient, patientName, procedure, triggers),
    );
  };

  const saveProcedure = async () => {
    setProcSaving(true);
    try {
      await patch((draft) => ({
        ...draft,
        surgeon: {
          ...(draft.surgeon ?? {}),
          scheduledProcedure: procEdit.trim() || undefined,
          scheduledDate: dateEdit || undefined,
        },
        updatedBy: "surgeon",
      }));
    } finally {
      setProcSaving(false);
    }
  };

  const setDraftField = (
    id: string,
    field: "to" | "subject" | "bodyHtml",
    value: string,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { to: "", subject: "", bodyHtml: "" }), [field]: value },
    }));
  };

  const saveLetter = async (recipient: Recipient, markSent: boolean) => {
    const draft = drafts[recipient.id];
    if (!draft) return;
    setBusyId(recipient.id);
    try {
      await patch((wf) => {
        const existing = findSurgeonDraft(wf, recipient);
        const nowIso = new Date().toISOString();
        const letter: SentLetter = existing
          ? { ...existing }
          : {
              id: newLetterId(),
              to: draft.to,
              subject: draft.subject,
              bodyHtml: draft.bodyHtml,
              sentAt: "",
              sentBy: "surgeon",
            };
        letter.to = draft.to;
        letter.subject = draft.subject;
        letter.bodyHtml = draft.bodyHtml;
        if (markSent) letter.sentAt = nowIso;

        const letters = existing
          ? wf.letters.map((l) => (l.id === existing.id ? letter : l))
          : [...wf.letters, letter];

        const surgeon = { ...(wf.surgeon ?? {}) };
        const next = { ...wf, letters, updatedBy: "surgeon" as const };
        if (markSent && recipient.kind === "pcp") {
          surgeon.initialRequestSent = true;
          surgeon.initialRequestSentAt = nowIso;
          surgeon.initialLetterId = letter.id;
          next.status = "request_sent";
          next.surgeon = surgeon;
        } else {
          next.surgeon = surgeon;
        }
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  const surgeonLetters = useMemo(
    () => workflow.letters.filter((l) => l.sentBy === "surgeon"),
    [workflow.letters],
  );
  const pcpResponses = useMemo(
    () => workflow.letters.filter((l) => l.sentBy === "pcp"),
    [workflow.letters],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/surgeon"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to scheduled procedures
        </Link>
      </div>

      {bundleError && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Could not load patient</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-800">
            {bundleError.message}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-xl">
                {summary?.name ?? (bundleLoading ? "Loading…" : "Unknown Patient")}
              </CardTitle>
              <CardDescription>
                {age !== null ? `${age}-year-old ` : ""}
                {summary ? formatGender(summary.gender).toLowerCase() : "patient"}
                {summary?.dob ? ` · DOB ${formatDob(summary.dob)}` : ""}
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <StatusBadge status={workflow.status} />
                {wfError && (
                  <span className="text-xs text-red-700">
                    Workflow sync error: {wfError.message}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EhrLink patientId={patientId} patientName={summary?.name} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Scheduled procedure
              </label>
              <Input
                value={procEdit}
                onChange={(e) => setProcEdit(e.target.value)}
                placeholder="e.g. Screening colonoscopy"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Scheduled date
              </label>
              <Input
                type="date"
                value={dateEdit}
                onChange={(e) => setDateEdit(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={saveProcedure} disabled={procSaving} size="sm">
              {procSaving ? "Saving…" : "Save procedure"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Saved to the shared workflow — PCP and Pre-Op Nurse will see this.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Run clearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre-op clearance</CardTitle>
          <CardDescription>
            Run ClearPath so we know what clearance is needed and which letters to draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              run(
                "Run a pre-operative clearance assessment for this patient so the surgical office can plan the required paperwork. Surface which providers will need to be contacted and the clinical concerns to highlight to each. Do not draft any correspondence yet.",
              )
            }
            disabled={!bundle || clearanceLoading}
          >
            {clearanceLoading
              ? "Running…"
              : clearance
                ? "Re-run clearance"
                : "Run pre-op clearance"}
          </Button>
          {clearanceError && (
            <span className="text-sm text-red-700">{clearanceError.message}</span>
          )}
        </CardContent>
      </Card>

      {clearanceLoading && !clearance && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      )}

      {clearance && (
        <>
          <AssessmentView clearance={clearance.clearance} />

          <RoleInsights
            role="surgeon"
            clearance={clearance.clearance}
            workflow={workflow}
          />

          {/* Letter drafting workspace */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Draft outgoing clearance paperwork</CardTitle>
              <CardDescription>
                One letter per recipient. The PCP letter is the standard initial request; if
                ClearPath flags specific specialties, separate letters can be drafted to each.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1">
                  {recipients.map((r) => {
                    const existing = findSurgeonDraft(workflow, r);
                    return (
                      <TabsTrigger key={r.id} value={r.id} className="flex items-center gap-2">
                        <span>{r.label}</span>
                        {existing?.sentAt ? (
                          <Badge variant="success" className="text-[10px]">
                            Sent
                          </Badge>
                        ) : existing ? (
                          <Badge variant="neutral" className="text-[10px]">
                            Draft
                          </Badge>
                        ) : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {recipients.map((r) => {
                  const draft = drafts[r.id];
                  const existing = findSurgeonDraft(workflow, r);
                  const hasBody = !!draft?.bodyHtml && draft.bodyHtml !== "<p></p>";
                  return (
                    <TabsContent key={r.id} value={r.id} className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            To
                          </label>
                          <Input
                            value={draft?.to ?? ""}
                            onChange={(e) => setDraftField(r.id, "to", e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            From
                          </label>
                          <Input value="Surgical Office" disabled readOnly />
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            RE / Subject
                          </label>
                          <Input
                            value={draft?.subject ?? ""}
                            onChange={(e) => setDraftField(r.id, "subject", e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                            Letter body
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => generateDraft(r)}
                          >
                            {hasBody ? "Regenerate draft" : "Generate draft"}
                          </Button>
                        </div>
                        <RichTextEditor
                          value={draft?.bodyHtml ?? ""}
                          onChange={(html) => setDraftField(r.id, "bodyHtml", html)}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => saveLetter(r, false)}
                          disabled={busyId === r.id || !hasBody}
                        >
                          {busyId === r.id ? "Saving…" : "Save draft"}
                        </Button>
                        <Button
                          onClick={() => saveLetter(r, true)}
                          disabled={busyId === r.id || !hasBody}
                        >
                          {busyId === r.id
                            ? "Sending…"
                            : existing?.sentAt
                              ? "Re-send"
                              : r.kind === "pcp"
                                ? "Send to PCP"
                                : "Send to specialist"}
                        </Button>
                        {!hasBody && (
                          <span className="text-xs text-muted-foreground">
                            Click <em>Generate draft</em> or type a body to enable saving.
                          </span>
                        )}
                        {existing?.sentAt && (
                          <span className="text-xs text-muted-foreground">
                            Sent {new Date(existing.sentAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {hasBody && (
                        <div className="pt-2">
                          <PrintableLetter
                            meta={{
                              date: new Date().toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }),
                              to: draft?.to ?? r.to,
                              from: "Surgical Office",
                              subject:
                                draft?.subject ??
                                defaultSubject(r, patientName, summary?.dob),
                            }}
                            bodyHtml={draft?.bodyHtml ?? ""}
                          />
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>

          {bundle && (
            <ChatPanel
              bundle={bundle}
              assessment={clearance.clearance}
              role="surgeon"
              resetKey={clearance.clearance.generated_at}
            />
          )}
        </>
      )}

      {/* Paperwork tracker */}
      {surgeonLetters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paperwork tracker</CardTitle>
            <CardDescription>
              Letters this surgical office has drafted for this patient.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {surgeonLetters.map((l) => (
                <li
                  key={l.id}
                  className="space-y-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">To: {l.to}</span>
                      <span className="text-muted-foreground"> · {l.subject}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {l.sentAt
                        ? `Marked sent ${new Date(l.sentAt).toLocaleString()}`
                        : "Draft"}
                    </span>
                  </div>
                  <LetterActions
                    patientId={patientId}
                    letter={l}
                    onDelivered={reloadWorkflow}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Responses received */}
      {pcpResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Responses received</CardTitle>
            <CardDescription>
              Letters returned by the PCP or consulting specialists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pcpResponses.map((l) => (
              <details key={l.id} className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm">
                  <span className="font-medium">{l.subject}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {l.sentAt ? `Received ${new Date(l.sentAt).toLocaleString()}` : ""}
                  </span>
                </summary>
                <div className="border-t p-3">
                  <PrintableLetter
                    meta={{
                      date: l.sentAt
                        ? new Date(l.sentAt).toLocaleDateString()
                        : undefined,
                      to: "Surgical Office",
                      from: summary?.pcpDoctor ?? "PCP",
                      subject: l.subject,
                    }}
                    bodyHtml={l.bodyHtml}
                  />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
