"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AssessmentView } from "@/components/assessment/assessment-view";
import { ChatPanel } from "@/components/assessment/chat-panel";
import { EhrLink } from "@/components/ehr-link";
import { LetterWorkspace } from "@/components/preop/letter-workspace";
import { LetterActions } from "@/components/letters/letter-actions";
import { PrintableLetter } from "@/components/letters/printable-letter";
import { RoleInsights } from "@/components/workflow/role-insights";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/workflow/status-badge";
import { ageFromDob, formatDob, formatGender } from "@/lib/format";
import { useClearance } from "@/lib/hooks/use-clearance";
import { usePatients } from "@/lib/hooks/use-patients";
import { useWorkflow } from "@/lib/hooks/use-workflow";
import type { ClearanceStatus } from "@/lib/workflow";

const STATUS_ACTIONS: { status: ClearanceStatus; label: string; variant: "default" | "outline" | "destructive" }[] = [
  { status: "in_review", label: "Mark in review", variant: "outline" },
  { status: "awaiting_consult", label: "Awaiting consult", variant: "outline" },
  { status: "cleared", label: "Mark cleared", variant: "default" },
  { status: "deferred", label: "Mark deferred", variant: "outline" },
  { status: "rejected", label: "Mark rejected", variant: "destructive" },
];

interface Props {
  patientId: string;
}

export function PreOpPatientDetail({ patientId }: Props) {
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
  } = useClearance(patientId, "preop");

  const { workflow, isLoading: wfLoading, error: wfError, patch, reload: reloadWorkflow } = useWorkflow(patientId);

  const [statusBusy, setStatusBusy] = useState<ClearanceStatus | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const age = ageFromDob(summary?.dob ?? null);
  const procedure =
    workflow.surgeon?.scheduledProcedure ?? summary?.procedureHint ?? null;

  const preopLetters = useMemo(
    () => workflow.letters.filter((l) => l.sentBy === "preop"),
    [workflow.letters],
  );
  const incomingResponses = useMemo(
    () => workflow.letters.filter((l) => l.sentBy === "pcp"),
    [workflow.letters],
  );

  const setStatus = async (status: ClearanceStatus) => {
    if (workflow.status === status) return;
    setStatusBusy(status);
    try {
      await patch((draft) => ({ ...draft, status, updatedBy: "preop" }));
    } finally {
      setStatusBusy(null);
    }
  };

  const saveNote = async () => {
    const trimmed = noteDraft.trim();
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      await patch((draft) => ({
        ...draft,
        preop: { ...(draft.preop ?? {}), coordinatorNote: trimmed },
        updatedBy: "preop",
      }));
      setNoteSaved(true);
    } finally {
      setNoteSaving(false);
    }
  };

  // Seed local note editor once workflow loads (only once, never overwrites
  // user edits afterwards).
  const noteSeededRef = useRef(false);
  useEffect(() => {
    if (noteSeededRef.current) return;
    const initial = workflow.preop?.coordinatorNote ?? "";
    if (initial) {
      setNoteDraft(initial);
    }
    if (initial || workflow.updatedAt !== "1970-01-01T00:00:00.000Z") {
      noteSeededRef.current = true;
    }
  }, [workflow.preop?.coordinatorNote, workflow.updatedAt]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/preop"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to surgery queue
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

      {/* Patient header */}
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
                {procedure ? ` · ${procedure}` : ""}
                {summary?.pcpDoctor ? ` · PCP ${summary.pcpDoctor}` : ""}
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
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Update status:
            </span>
            {STATUS_ACTIONS.map((a) => (
              <Button
                key={a.status}
                size="sm"
                variant={workflow.status === a.status ? "default" : "outline"}
                onClick={() => setStatus(a.status)}
                disabled={statusBusy === a.status || wfLoading}
              >
                {statusBusy === a.status ? "Saving…" : a.label}
              </Button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Coordinator note (internal)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Textarea
                rows={2}
                placeholder="Internal note, e.g. 'Faxed cardiology Mon AM, waiting on response'…"
                value={noteDraft}
                onChange={(e) => {
                  setNoteDraft(e.target.value);
                  setNoteSaved(false);
                }}
                className="flex-1"
              />
              <Button onClick={saveNote} disabled={noteSaving} size="sm">
                {noteSaving ? "Saving…" : noteSaved ? "Saved" : "Save note"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Run clearance section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre-op clearance assessment</CardTitle>
          <CardDescription>
            Run ClearPath against this patient&apos;s FHIR chart. Re-run any time after
            the chart updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              run(
                "Run a complete pre-operative clearance assessment for this patient. Surface any specialist consults needed and flag any missing chart data. Do not draft correspondence.",
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
            role="preop"
            clearance={clearance.clearance}
            workflow={workflow}
          />

          <LetterWorkspace
            patientId={patientId}
            patientName={summary?.name ?? "Patient"}
            procedure={procedure}
            pcpName={summary?.pcpDoctor ?? null}
            recommendedSpecialties={clearance.clearance.recommended_specialties}
            specialistFindings={clearance.clearance.specialist_findings}
            triggeringFactors={clearance.clearance.triggering_factors}
            workflow={workflow}
            patch={patch}
            onDelivered={reloadWorkflow}
          />

          {bundle && (
            <ChatPanel
              bundle={bundle}
              assessment={clearance.clearance}
              role="preop"
              resetKey={clearance.clearance.generated_at}
            />
          )}
        </>
      )}

      {incomingResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Responses received from PCP</CardTitle>
            <CardDescription>
              Letters the PCP sent back. Click to view; print or copy from the
              preview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingResponses.map((l) => (
              <details key={l.id} className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm">
                  <span className="font-medium">{l.subject}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {l.sentAt ? `· Received ${new Date(l.sentAt).toLocaleString()}` : ""}
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

      {preopLetters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sent letters log</CardTitle>
            <CardDescription>
              Drafts and sent letters from this office. Download the PDF or
              email it to the recipient from here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {preopLetters.map((l) => (
                <li key={l.id} className="space-y-2 rounded-md border bg-muted/30 px-3 py-2">
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
    </div>
  );
}

