"use client";

import { useEffect, useMemo, useState } from "react";

import { LetterActions } from "@/components/letters/letter-actions";
import { PrintableLetter } from "@/components/letters/printable-letter";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
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
import { titleCase } from "@/lib/format";
import type { SpecialistFinding } from "@/lib/types";
import {
  newLetterId,
  type SentLetter,
  type Workflow,
} from "@/lib/workflow";

export interface LetterRecipient {
  /** Stable tab id, e.g. "pcp" or "specialty:cardiology". */
  id: string;
  /** Display label on the tab. */
  label: string;
  /** Recipient line for the letter envelope (e.g. "Dr. Smith, PCP" or "Dr. Karen Chen, Cardiology"). */
  to: string;
  /** Kind, used to mark the SentLetter so we can find/replace its draft later. */
  kind: "pcp" | "specialty";
  /** Lowercase specialty key if kind === "specialty" (e.g. "cardiology"). */
  specialty?: string;
  /** Greeting line — uses the doctor's name when known, falls back to the team. */
  greetingName: string;
}

interface Props {
  patientId: string;
  patientName: string;
  procedure: string | null;
  pcpName: string | null;
  recommendedSpecialties: string[];
  specialistFindings: SpecialistFinding[];
  triggeringFactors: string[];
  workflow: Workflow;
  /** Patch fn from useWorkflow. */
  patch: (mutator: (draft: Workflow) => Workflow) => Promise<Workflow>;
  /** Triggered after a delivery (email send) to refresh the workflow. */
  onDelivered?: () => void;
}

/** Look up a known specialist's doctor name for a given specialty (e.g. "cardiology"). */
function findSpecialistDoctor(
  findings: SpecialistFinding[],
  specialty: string,
): string | null {
  const match = findings.find(
    (f) => f.specialty.toLowerCase() === specialty.toLowerCase(),
  );
  return match?.doctor_name ?? null;
}

/** Find a coordinator draft letter for a given recipient. */
function findDraft(
  workflow: Workflow,
  recipient: LetterRecipient,
): SentLetter | undefined {
  return workflow.letters.find(
    (l) =>
      l.sentBy === "preop" &&
      l.to === recipient.to &&
      l.subject.startsWith(recipientSubjectKey(recipient)),
  );
}

function recipientSubjectKey(recipient: LetterRecipient): string {
  if (recipient.kind === "pcp") return "Pre-op clearance request";
  return `Pre-op ${titleCase(recipient.specialty ?? "")} consult`;
}

function defaultSubject(recipient: LetterRecipient, patientName: string): string {
  return `${recipientSubjectKey(recipient)} — ${patientName}`;
}

function templateBody(
  recipient: LetterRecipient,
  patientName: string,
  procedure: string | null,
  triggeringFactors: string[],
): string {
  const proc = procedure ?? "an upcoming procedure";
  const triggerList =
    triggeringFactors.length > 0
      ? `<ul>${triggeringFactors
          .slice(0, 5)
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join("")}</ul>`
      : "<p>(No specific Tier-1 triggers — standard pre-operative review.)</p>";
  const greeting = `<p>Dear ${escapeHtml(recipient.greetingName)},</p>`;

  if (recipient.kind === "pcp") {
    return `${greeting}
<p>Our surgical team is preparing <strong>${escapeHtml(patientName)}</strong> for ${escapeHtml(proc)} and is requesting your pre-operative clearance.</p>
<p>ClearPath has identified the following items for your review:</p>
${triggerList}
<p>Please review the patient's current medical status and respond with either confirmation of clearance or any additional workup, medication adjustments, or specialist consults you recommend.</p>
<p>Thank you,<br/>Surgical Office</p>`;
  }
  const sp = titleCase(recipient.specialty ?? "");
  return `${greeting}
<p>We are coordinating pre-operative clearance for <strong>${escapeHtml(patientName)}</strong>, scheduled for ${escapeHtml(proc)}.</p>
<p>Our pre-op assessment flagged the following items in your domain:</p>
${triggerList}
<p>Please advise on whether the patient is appropriately optimized from a ${sp.toLowerCase()} standpoint and any peri-operative recommendations (medication holds, monitoring, additional testing).</p>
<p>Thank you,<br/>Surgical Office</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function LetterWorkspace({
  patientId,
  patientName,
  procedure,
  pcpName,
  recommendedSpecialties,
  specialistFindings,
  triggeringFactors,
  workflow,
  patch,
  onDelivered,
}: Props) {
  const recipients = useMemo<LetterRecipient[]>(() => {
    const list: LetterRecipient[] = [
      {
        id: "pcp",
        label: "PCP",
        to: pcpName ?? "Primary Care Provider",
        kind: "pcp",
        greetingName: pcpName ?? "Primary Care Provider",
      },
    ];
    for (const sp of recommendedSpecialties) {
      const docName = findSpecialistDoctor(specialistFindings, sp);
      const titledSpecialty = titleCase(sp);
      list.push({
        id: `specialty:${sp.toLowerCase()}`,
        label: titledSpecialty,
        to: docName
          ? `${docName}, ${titledSpecialty}`
          : `${titledSpecialty} Department`,
        kind: "specialty",
        specialty: sp.toLowerCase(),
        greetingName: docName ?? `${titledSpecialty} Team`,
      });
    }
    return list;
  }, [pcpName, recommendedSpecialties, specialistFindings]);

  const [activeTab, setActiveTab] = useState<string>(recipients[0]?.id ?? "pcp");

  // Per-recipient editable state, keyed by recipient.id.
  // Body is EMPTY by default — only filled when the user clicks "Generate draft".
  const [drafts, setDrafts] = useState<
    Record<string, { to: string; subject: string; bodyHtml: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorByTab, setErrorByTab] = useState<Record<string, string | null>>({});

  // Seed envelope fields (to + subject) from recipients/workflow, but ALWAYS
  // leave body empty unless an existing draft already exists.
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of recipients) {
        if (next[r.id]) continue;
        const existing = findDraft(workflow, r);
        next[r.id] = existing
          ? {
              to: existing.to,
              subject: existing.subject,
              bodyHtml: existing.bodyHtml,
            }
          : {
              to: r.to,
              subject: defaultSubject(r, patientName),
              bodyHtml: "",
            };
      }
      return next;
    });
    if (!recipients.some((r) => r.id === activeTab) && recipients[0]) {
      setActiveTab(recipients[0].id);
    }
  }, [recipients, workflow, patientName, activeTab]);

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

  const generateDraft = (recipient: LetterRecipient) => {
    setDraftField(
      recipient.id,
      "bodyHtml",
      templateBody(recipient, patientName, procedure, triggeringFactors),
    );
  };

  const saveDraft = async (recipient: LetterRecipient, markSent: boolean) => {
    const draft = drafts[recipient.id];
    if (!draft) return;
    const setter = markSent ? setSendingId : setSavingId;
    setter(recipient.id);
    setErrorByTab((e) => ({ ...e, [recipient.id]: null }));
    try {
      await patch((wf) => {
        const existing = findDraft(wf, recipient);
        const nowIso = new Date().toISOString();
        const next: SentLetter = existing
          ? { ...existing }
          : {
              id: newLetterId(),
              to: draft.to,
              subject: draft.subject,
              bodyHtml: draft.bodyHtml,
              sentAt: "",
              sentBy: "preop",
            };
        next.to = draft.to;
        next.subject = draft.subject;
        next.bodyHtml = draft.bodyHtml;
        if (markSent) next.sentAt = nowIso;

        const letters = existing
          ? wf.letters.map((l) => (l.id === existing.id ? next : l))
          : [...wf.letters, next];

        return { ...wf, letters, updatedBy: "preop" };
      });
    } catch (e) {
      setErrorByTab((errs) => ({
        ...errs,
        [recipient.id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setter(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Letter drafting workspace</CardTitle>
        <CardDescription>
          Letters are <strong>not auto-generated</strong>. Use{" "}
          <em>Generate draft</em> to fill the body from a clinical template, or
          type freely. Save a draft to come back to, or mark sent when the
          paperwork is out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1">
            {recipients.map((r) => {
              const existing = findDraft(workflow, r);
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
            const existing = findDraft(workflow, r);
            const error = errorByTab[r.id];
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
                    onClick={() => saveDraft(r, false)}
                    disabled={savingId === r.id || sendingId === r.id || !hasBody}
                  >
                    {savingId === r.id ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    onClick={() => saveDraft(r, true)}
                    disabled={savingId === r.id || sendingId === r.id || !hasBody}
                  >
                    {sendingId === r.id
                      ? "Marking sent…"
                      : existing?.sentAt
                        ? "Re-mark sent"
                        : "Mark sent"}
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
                  {error && (
                    <span className="text-xs text-red-700">{error}</span>
                  )}
                </div>

                {hasBody && (
                  <div className="space-y-3 pt-2">
                    <PrintableLetter
                      meta={{
                        date: new Date().toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }),
                        to: draft?.to ?? r.to,
                        from: "Surgical Office",
                        subject: draft?.subject ?? defaultSubject(r, patientName),
                      }}
                      bodyHtml={draft?.bodyHtml ?? ""}
                    />
                    {existing && (
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Delivery
                        </div>
                        <LetterActions
                          patientId={patientId}
                          letter={existing}
                          defaultName={r.greetingName}
                          onDelivered={() => onDelivered?.()}
                        />
                      </div>
                    )}
                    {!existing && (
                      <div className="rounded-md border bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Save the draft to enable PDF download and email
                        delivery.
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
