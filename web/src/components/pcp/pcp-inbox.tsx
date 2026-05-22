"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/workflow/status-badge";
import { listWorkflows } from "@/lib/api";
import { ageFromDob, formatGender } from "@/lib/format";
import { usePatients } from "@/lib/hooks/use-patients";
import type { PatientSummary } from "@/lib/types";
import {
  EMPTY_WORKFLOW,
  type ClearanceStatus,
  type SentLetter,
  type Workflow,
} from "@/lib/workflow";

type Priority = "high" | "medium" | "low";

interface InboxItem {
  patient: PatientSummary;
  workflow: Workflow;
  latestSurgeonLetter: SentLetter | null;
  priority: Priority;
  receivedAt: string | null;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_VARIANT: Record<
  Priority,
  "danger" | "warning" | "neutral"
> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

function priorityForStatus(status: ClearanceStatus): Priority {
  if (status === "request_sent") return "high";
  if (status === "in_review" || status === "awaiting_consult") return "medium";
  return "low";
}

function formatReceivedAt(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isInboxStatus(s: ClearanceStatus): boolean {
  return s === "request_sent" || s === "in_review" || s === "awaiting_consult";
}

export function PcpInbox() {
  const { patients, isLoading: patientsLoading, error: patientsError } = usePatients();
  const [workflows, setWorkflows] = useState<Record<string, Workflow>>({});
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsError, setWorkflowsError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWorkflowsLoading(true);
    setWorkflowsError(null);
    listWorkflows()
      .then((w) => {
        if (!cancelled) setWorkflows(w);
      })
      .catch((e: Error) => {
        if (!cancelled) setWorkflowsError(e);
      })
      .finally(() => {
        if (!cancelled) setWorkflowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { inboxItems, otherPatients, stats } = useMemo(() => {
    const inbox: InboxItem[] = [];
    const others: PatientSummary[] = [];

    for (const p of patients) {
      const wf = workflows[p.id] ?? EMPTY_WORKFLOW;
      const surgeonLetters = (wf.letters ?? []).filter(
        (l) => l.sentBy === "surgeon",
      );
      const latestSurgeonLetter =
        surgeonLetters.length > 0
          ? [...surgeonLetters].sort((a, b) =>
              b.sentAt.localeCompare(a.sentAt),
            )[0]
          : null;
      const inInboxByStatus = isInboxStatus(wf.status);
      if (latestSurgeonLetter || inInboxByStatus) {
        const priority = priorityForStatus(wf.status);
        const receivedAt =
          latestSurgeonLetter?.sentAt ??
          (wf.updatedAt && wf.updatedAt !== EMPTY_WORKFLOW.updatedAt
            ? wf.updatedAt
            : null);
        inbox.push({
          patient: p,
          workflow: wf,
          latestSurgeonLetter,
          priority,
          receivedAt,
        });
      } else {
        others.push(p);
      }
    }

    inbox.sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      const aTs = a.receivedAt ?? "";
      const bTs = b.receivedAt ?? "";
      return bTs.localeCompare(aTs);
    });

    const newCount = inbox.filter(
      (i) => i.workflow.status === "request_sent",
    ).length;
    const inReviewCount = inbox.filter(
      (i) => i.workflow.status === "in_review",
    ).length;
    const awaitingCount = inbox.filter(
      (i) => i.workflow.status === "awaiting_consult",
    ).length;

    return {
      inboxItems: inbox,
      otherPatients: others,
      stats: { newCount, inReviewCount, awaitingCount },
    };
  }, [patients, workflows]);

  const loading = patientsLoading || workflowsLoading;
  const error = patientsError ?? workflowsError;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Inbox: Clearance Requests
        </h1>
        <p className="text-muted-foreground">
          Pre-operative clearance requests pending your review.
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {stats.newCount} new
          </span>{" "}
          ·{" "}
          <span className="font-medium text-foreground">
            {stats.inReviewCount} in review
          </span>{" "}
          ·{" "}
          <span className="font-medium text-foreground">
            {stats.awaitingCount} awaiting consult
          </span>
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Could not load inbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-800">
            <p>{error.message}</p>
            <p>Make sure the ClearPath backend is running at the configured URL.</p>
          </CardContent>
        </Card>
      )}

      {loading && !error && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse">
              <CardHeader>
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          {inboxItems.length > 0 ? (
            <div className="space-y-3">
              {inboxItems.map((item) => (
                <InboxRow key={item.patient.id} item={item} />
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No active requests</CardTitle>
                <CardDescription>
                  You&apos;re all caught up — no surgical offices have sent a
                  clearance request yet.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {otherPatients.length > 0 && (
            <div className="space-y-3 pt-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  {inboxItems.length === 0
                    ? "No requests yet — all patients"
                    : "Other patients"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Patients without an open clearance request. Open one to review
                  proactively.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {otherPatients.map((p) => (
                  <OtherPatientCard key={p.id} patient={p} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const { patient, workflow, latestSurgeonLetter, priority, receivedAt } = item;
  const age = ageFromDob(patient.dob);
  const procedure =
    workflow.surgeon?.scheduledProcedure ?? patient.procedureHint ?? null;
  const subject =
    latestSurgeonLetter?.subject ?? "No formal request received yet";

  return (
    <Link
      href={`/pcp/${patient.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="transition-colors hover:bg-accent/30">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{patient.name}</CardTitle>
                <StatusBadge status={workflow.status} />
                <Badge variant={PRIORITY_VARIANT[priority]}>
                  {PRIORITY_LABEL[priority]} priority
                </Badge>
              </div>
              <CardDescription>
                {age !== null ? `${age}-year-old ` : ""}
                {formatGender(patient.gender).toLowerCase()}
                {procedure ? ` · ${procedure}` : ""}
              </CardDescription>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Received {formatReceivedAt(receivedAt)}</div>
              {patient.pcpDoctor && (
                <div className="mt-0.5">PCP: {patient.pcpDoctor}</div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Subject
            </div>
            <div className="mt-0.5 line-clamp-2 text-foreground">{subject}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function OtherPatientCard({ patient }: { patient: PatientSummary }) {
  const age = ageFromDob(patient.dob);
  return (
    <Link
      href={`/pcp/${patient.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="h-full transition-colors hover:bg-accent/30">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{patient.name}</CardTitle>
          <CardDescription>
            {age !== null ? `${age}-year-old ` : ""}
            {formatGender(patient.gender).toLowerCase()}
            {patient.procedureHint ? ` · ${patient.procedureHint}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {patient.pcpDoctor ? `PCP: ${patient.pcpDoctor}` : "PCP unassigned"}
        </CardContent>
      </Card>
    </Link>
  );
}
