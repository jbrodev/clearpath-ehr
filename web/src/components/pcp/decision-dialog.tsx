"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/editor/rich-text-editor";

export type DecisionKind = "signed_off" | "deferred" | "pushed_back" | "consult";

export type Specialty =
  | "Cardiology"
  | "Hematology"
  | "Pulmonology"
  | "Neurology";

const SPECIALTIES: Specialty[] = [
  "Cardiology",
  "Hematology",
  "Pulmonology",
  "Neurology",
];

export interface DecisionSubmission {
  kind: DecisionKind;
  note: string;
  letter: {
    to: string;
    subject: string;
    bodyHtml: string;
  };
  specialty?: Specialty;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DecisionKind;
  patientName: string;
  procedure: string | null;
  pcpName: string;
  onSubmit: (submission: DecisionSubmission) => Promise<void> | void;
}

const KIND_META: Record<
  DecisionKind,
  {
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: "default" | "destructive" | "secondary";
    defaultRecipient: string;
    defaultSubjectPrefix: string;
  }
> = {
  signed_off: {
    title: "Sign off as cleared",
    description:
      "Confirm clearance and send the response letter back to the surgical office.",
    confirmLabel: "Send clearance",
    confirmVariant: "default",
    defaultRecipient: "Surgical Office",
    defaultSubjectPrefix: "Medical clearance for",
  },
  deferred: {
    title: "Defer procedure",
    description:
      "Recommend deferring the procedure. The surgical office will receive your rationale.",
    confirmLabel: "Send deferral",
    confirmVariant: "secondary",
    defaultRecipient: "Surgical Office",
    defaultSubjectPrefix: "Deferral of pre-op clearance for",
  },
  pushed_back: {
    title: "Request more info / Push back",
    description:
      "Ask the surgical office for additional information before you can clear this patient.",
    confirmLabel: "Send request",
    confirmVariant: "secondary",
    defaultRecipient: "Surgical Office",
    defaultSubjectPrefix: "Additional information needed for",
  },
  consult: {
    title: "Coordinate specialist consult",
    description:
      "Refer to a specialist for clearance input. A letter will be sent to the specialty office.",
    confirmLabel: "Send referral",
    confirmVariant: "default",
    defaultRecipient: "Cardiology",
    defaultSubjectPrefix: "Specialist consult for",
  },
};

function defaultLetterBody(
  kind: DecisionKind,
  patientName: string,
  procedure: string | null,
  pcpName: string,
  specialty?: Specialty,
): string {
  const procPhrase = procedure ?? "the scheduled procedure";
  switch (kind) {
    case "signed_off":
      return `<p>Dear Colleagues,</p><p>I have reviewed ${escape(patientName)}'s chart in preparation for ${escape(procPhrase)} and am providing <strong>medical clearance</strong> from a primary-care perspective.</p><p>Active issues are controlled, no acute interventions are required prior to surgery, and standard peri-operative medication management should be followed as documented in the chart.</p><p>Please proceed with anesthesia and surgical planning as scheduled. I remain available for any follow-up questions.</p><p>Sincerely,<br/>${escape(pcpName)}</p>`;
    case "deferred":
      return `<p>Dear Colleagues,</p><p>After review of ${escape(patientName)}'s chart in preparation for ${escape(procPhrase)}, I recommend <strong>deferring the procedure</strong> at this time.</p><p>My rationale and the specific items that should be addressed before re-evaluation are documented below. I am happy to reassess once the outstanding issues have been resolved.</p><ul><li>[Reason 1 — please edit]</li><li>[Reason 2 — please edit]</li></ul><p>Sincerely,<br/>${escape(pcpName)}</p>`;
    case "pushed_back":
      return `<p>Dear Colleagues,</p><p>Thank you for the clearance request for ${escape(patientName)} prior to ${escape(procPhrase)}. Before I can sign off, I need the following additional information:</p><ul><li>[Item 1 — please edit]</li><li>[Item 2 — please edit]</li></ul><p>Once received, I will complete my review promptly.</p><p>Sincerely,<br/>${escape(pcpName)}</p>`;
    case "consult": {
      const spec = specialty ?? "Cardiology";
      return `<p>Dear ${escape(spec)} Colleagues,</p><p>I am requesting a pre-operative consult for ${escape(patientName)} in preparation for ${escape(procPhrase)}.</p><p>The chart raises ${escape(spec.toLowerCase())} questions I would like your input on before I clear the patient for surgery. Specific items I am asking you to comment on:</p><ul><li>[Question 1 — please edit]</li><li>[Question 2 — please edit]</li></ul><p>Please share your recommendations at your earliest convenience.</p><p>Sincerely,<br/>${escape(pcpName)}</p>`;
    }
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function DecisionDialog({
  open,
  onOpenChange,
  kind,
  patientName,
  procedure,
  pcpName,
  onSubmit,
}: Props) {
  const meta = KIND_META[kind];
  const [note, setNote] = useState("");
  const [specialty, setSpecialty] = useState<Specialty>("Cardiology");
  const [recipient, setRecipient] = useState(meta.defaultRecipient);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultSubject = useMemo(
    () => `${meta.defaultSubjectPrefix} ${patientName}`,
    [meta.defaultSubjectPrefix, patientName],
  );

  // Re-seed contents whenever the dialog opens or kind/specialty changes.
  useEffect(() => {
    if (!open) return;
    setNote("");
    setSubmitError(null);
    setSubmitting(false);
    const effectiveRecipient =
      kind === "consult" ? specialty : meta.defaultRecipient;
    setRecipient(effectiveRecipient);
    setSubject(defaultSubject);
    setBody(
      defaultLetterBody(
        kind,
        patientName,
        procedure,
        pcpName,
        kind === "consult" ? specialty : undefined,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, specialty]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        kind,
        note: note.trim(),
        letter: {
          to: recipient.trim() || meta.defaultRecipient,
          subject: subject.trim() || defaultSubject,
          bodyHtml: body,
        },
        specialty: kind === "consult" ? specialty : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {kind === "consult" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Specialty
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecialty(s)}
                    className={
                      "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                      (specialty === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent hover:text-accent-foreground")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                To
              </label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={meta.defaultRecipient}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={defaultSubject}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Internal note (optional)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A short rationale for your own records — not sent to the recipient."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Response letter
            </label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>

          {submitError && (
            <p className="text-sm text-red-700">{submitError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant={meta.confirmVariant}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Sending…" : meta.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
