"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AssessmentView } from "@/components/assessment/assessment-view";
import { ChatPanel } from "@/components/assessment/chat-panel";
import { EhrLink } from "@/components/ehr-link";
import { LetterActions } from "@/components/letters/letter-actions";
import { PrintableLetter } from "@/components/letters/printable-letter";
import { RoleInsights } from "@/components/workflow/role-insights";
import {
  DecisionDialog,
  type DecisionKind,
  type DecisionSubmission,
} from "@/components/pcp/decision-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/workflow/status-badge";
import { ageFromDob, formatDob, formatGender } from "@/lib/format";
import { useClearance } from "@/lib/hooks/use-clearance";
import { usePatients } from "@/lib/hooks/use-patients";
import { useWorkflow } from "@/lib/hooks/use-workflow";
import { newLetterId, type ClearanceStatus, type SentLetter } from "@/lib/workflow";

interface Props {
  patientId: string;
}

const KIND_TO_STATUS: Record<DecisionKind, ClearanceStatus> = {
  signed_off: "cleared",
  deferred: "deferred",
  pushed_back: "awaiting_consult",
  consult: "awaiting_consult",
};

const KIND_DECISION_VALUE: Record<
  DecisionKind,
  "signed_off" | "pushed_back" | "deferred"
> = {
  signed_off: "signed_off",
  deferred: "deferred",
  pushed_back: "pushed_back",
  consult: "pushed_back",
};

export function PcpPatientReview({ patientId }: Props) {
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
  } = useClearance(patientId, "pcp");

  const { workflow, error: wfError, patch, reload: reloadWorkflow } = useWorkflow(patientId);

  const [dialogKind, setDialogKind] = useState<DecisionKind | null>(null);

  const age = ageFromDob(summary?.dob ?? null);
  const procedure =
    workflow.surgeon?.scheduledProcedure ?? summary?.procedureHint ?? null;
  const pcpName = summary?.pcpDoctor ?? "Primary Care Provider";

  const incomingRequest = useMemo(() => {
    const list = workflow.letters
      .filter((l) => l.sentBy === "surgeon")
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return list[0] ?? null;
  }, [workflow.letters]);

  const pcpResponses = useMemo(
    () => workflow.letters.filter((l) => l.sentBy === "pcp"),
    [workflow.letters],
  );

  const handleDecisionSubmit = async (submission: DecisionSubmission) => {
    const nextStatus = KIND_TO_STATUS[submission.kind];
    const decisionValue = KIND_DECISION_VALUE[submission.kind];
    const nowIso = new Date().toISOString();
    const responseLetter: SentLetter = {
      id: newLetterId(),
      to: submission.letter.to,
      subject: submission.letter.subject,
      bodyHtml: submission.letter.bodyHtml,
      sentAt: nowIso,
      sentBy: "pcp",
    };

    await patch((draft) => ({
      ...draft,
      status: nextStatus,
      updatedBy: "pcp",
      pcp: {
        ...(draft.pcp ?? {}),
        decision: decisionValue,
        decisionAt: nowIso,
        decisionNote: submission.note,
        responseLetterId: responseLetter.id,
      },
      letters: [...draft.letters, responseLetter],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/pcp"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to inbox
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
                {procedure ? ` · ${procedure}` : ""}
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <StatusBadge status={workflow.status} />
                {workflow.pcp?.decision && (
                  <span className="text-xs text-muted-foreground">
                    Your decision:{" "}
                    <span className="font-medium text-foreground">
                      {workflow.pcp.decision === "signed_off"
                        ? "Signed off"
                        : workflow.pcp.decision === "deferred"
                          ? "Deferred"
                          : "Pushed back"}
                    </span>
                    {workflow.pcp.decisionAt
                      ? ` · ${new Date(workflow.pcp.decisionAt).toLocaleString()}`
                      : ""}
                  </span>
                )}
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
      </Card>

      {/* Incoming request from surgical office */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incoming clearance request</CardTitle>
          <CardDescription>
            {incomingRequest
              ? `Received from surgical office on ${
                  incomingRequest.sentAt
                    ? new Date(incomingRequest.sentAt).toLocaleString()
                    : "—"
                }.`
              : "No formal request from the surgical office yet — review the chart and assess anyway."}
          </CardDescription>
        </CardHeader>
        {incomingRequest && (
          <CardContent>
            <PrintableLetter
              meta={{
                date: incomingRequest.sentAt
                  ? new Date(incomingRequest.sentAt).toLocaleDateString()
                  : undefined,
                to: pcpName,
                from: "Surgical Office",
                subject: incomingRequest.subject,
              }}
              bodyHtml={incomingRequest.bodyHtml}
            />
          </CardContent>
        )}
      </Card>

      {/* Run clearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ClearPath assessment</CardTitle>
          <CardDescription>
            A peer-to-peer review of this patient&apos;s pre-op risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              run(
                "A surgical office has referred this patient to me for pre-operative medical clearance. Summarize what I need to confirm and any specialist coordination required before I sign off.",
              )
            }
            disabled={!bundle || clearanceLoading}
          >
            {clearanceLoading
              ? "Running…"
              : clearance
                ? "Re-run assessment"
                : "Review pre-op assessment"}
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
            role="pcp"
            clearance={clearance.clearance}
            workflow={workflow}
          />

          {/* Decision panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your decision</CardTitle>
              <CardDescription>
                Sign off, defer, request more info, or coordinate a specialist
                consult. Each option drafts a response letter back to the
                surgical office that you can edit before sending.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => setDialogKind("signed_off")}>
                Sign off as cleared
              </Button>
              <Button variant="outline" onClick={() => setDialogKind("deferred")}>
                Defer procedure
              </Button>
              <Button variant="outline" onClick={() => setDialogKind("pushed_back")}>
                Request more info
              </Button>
              <Button variant="outline" onClick={() => setDialogKind("consult")}>
                Coordinate specialist consult
              </Button>
            </CardContent>
          </Card>

          {bundle && (
            <ChatPanel
              bundle={bundle}
              assessment={clearance.clearance}
              role="pcp"
              resetKey={clearance.clearance.generated_at}
            />
          )}
        </>
      )}

      {/* Sent response log */}
      {pcpResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sent responses</CardTitle>
            <CardDescription>
              Letters you have sent back to the surgical office or to consulting
              specialists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pcpResponses.map((l) => (
              <details key={l.id} className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm">
                  <span className="font-medium">To: {l.to}</span>
                  <span className="text-muted-foreground"> · {l.subject}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {l.sentAt ? `Sent ${new Date(l.sentAt).toLocaleString()}` : ""}
                  </span>
                </summary>
                <div className="space-y-3 border-t p-3">
                  <PrintableLetter
                    meta={{
                      date: l.sentAt
                        ? new Date(l.sentAt).toLocaleDateString()
                        : undefined,
                      to: l.to,
                      from: pcpName,
                      subject: l.subject,
                    }}
                    bodyHtml={l.bodyHtml}
                  />
                  <LetterActions
                    patientId={patientId}
                    letter={l}
                    onDelivered={reloadWorkflow}
                  />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      {dialogKind !== null && (
        <DecisionDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setDialogKind(null);
          }}
          kind={dialogKind}
          patientName={summary?.name ?? "the patient"}
          procedure={procedure}
          pcpName={pcpName}
          onSubmit={handleDecisionSubmit}
        />
      )}
    </div>
  );
}
