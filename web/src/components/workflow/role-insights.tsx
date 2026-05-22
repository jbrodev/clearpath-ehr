"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { titleCase } from "@/lib/format";
import type { Role } from "@/lib/roles";
import type { ClearanceOutput, SpecialistFinding } from "@/lib/types";
import { type Workflow } from "@/lib/workflow";

interface Props {
  role: Role;
  clearance: ClearanceOutput;
  workflow: Workflow;
}

/**
 * Translates ClearPath's deterministic assessment into role-specific next
 * actions. The disposition + triggers + missing_info are the same for every
 * role; what changes is what each role is supposed to *do* about them.
 */
export function RoleInsights({ role, clearance, workflow }: Props) {
  const insights = computeInsights(role, clearance, workflow);
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {role === "preop"
            ? "Coordinator action list"
            : role === "pcp"
              ? "What you need to confirm before sign-off"
              : "Paperwork required"}
        </CardTitle>
        <CardDescription>
          ClearPath&apos;s reasoning translated into the next concrete steps for
          this role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </CardContent>
    </Card>
  );
}

interface Insight {
  label: string;
  detail?: string;
  status: "todo" | "in_progress" | "done" | "blocker";
}

function InsightRow({ insight }: { insight: Insight }) {
  const badge =
    insight.status === "done"
      ? { variant: "success" as const, label: "Done" }
      : insight.status === "in_progress"
        ? { variant: "info" as const, label: "In progress" }
        : insight.status === "blocker"
          ? { variant: "danger" as const, label: "Blocker" }
          : { variant: "warning" as const, label: "To do" };

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{insight.label}</div>
        {insight.detail && (
          <div className="text-xs text-muted-foreground">{insight.detail}</div>
        )}
      </div>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </div>
  );
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

function consultLetterSentFor(workflow: Workflow, specialty: string): boolean {
  return workflow.letters.some(
    (l) =>
      (l.sentBy === "preop" || l.sentBy === "surgeon") &&
      !!l.sentAt &&
      l.to.toLowerCase().includes(specialty.toLowerCase()),
  );
}

function pcpLetterSent(workflow: Workflow): boolean {
  return workflow.letters.some(
    (l) => l.sentBy === "surgeon" && !!l.sentAt,
  ) || !!workflow.surgeon?.initialRequestSent;
}

function pcpResponded(workflow: Workflow): boolean {
  return workflow.letters.some((l) => l.sentBy === "pcp");
}

function computeInsights(
  role: Role,
  clearance: ClearanceOutput,
  workflow: Workflow,
): Insight[] {
  const {
    disposition,
    recommended_specialties,
    specialist_findings,
    missing_information,
  } = clearance;

  if (role === "preop") {
    const items: Insight[] = [];
    // Each specialist consult is a coordinated action.
    for (const sp of recommended_specialties) {
      const doc = findSpecialistDoctor(specialist_findings, sp);
      const sent = consultLetterSentFor(workflow, sp);
      items.push({
        label: doc
          ? `Coordinate consult with ${doc} (${titleCase(sp)})`
          : `Coordinate consult with ${titleCase(sp)}`,
        detail: sent
          ? "Letter sent. Track response and update workflow when received."
          : "Use the letter workspace below to draft and send.",
        status: sent ? "in_progress" : "todo",
      });
    }
    // Missing chart data → things to chase.
    for (const m of missing_information.slice(0, 3)) {
      items.push({
        label: `Obtain: ${m}`,
        detail: "Missing from the chart — may change the assessment.",
        status: "todo",
      });
    }
    if (workflow.status === "cleared") {
      items.push({
        label: "Patient is cleared — proceed to scheduling.",
        status: "done",
      });
    }
    if (workflow.status === "deferred" || workflow.status === "rejected") {
      items.push({
        label: `Procedure ${workflow.status}.`,
        detail: "No further coordination needed.",
        status: "done",
      });
    }
    return items;
  }

  if (role === "pcp") {
    const items: Insight[] = [];
    if (disposition === "specialist_required" || disposition === "anesthesia_review_required") {
      items.push({
        label: "Do NOT sign off as cleared yet",
        detail: `ClearPath returned ${disposition.replace("_", " ").toUpperCase()}. Specialist input is required first.`,
        status: "blocker",
      });
    }
    for (const sp of recommended_specialties) {
      const doc = findSpecialistDoctor(specialist_findings, sp);
      const sent = consultLetterSentFor(workflow, sp);
      items.push({
        label: doc
          ? `Confirm ${titleCase(sp)} input from ${doc}`
          : `Confirm ${titleCase(sp)} input`,
        detail: sent
          ? "Consult letter already sent. Wait for response or coordinate it on your end."
          : "Coordinate the consult or request it from the surgical office.",
        status: sent ? "in_progress" : "todo",
      });
    }
    for (const m of missing_information.slice(0, 3)) {
      items.push({
        label: `Document or confirm: ${m}`,
        status: "todo",
      });
    }
    if (workflow.pcp?.decision === "signed_off") {
      items.push({
        label: "You have signed off on this clearance.",
        detail: workflow.pcp.decisionAt
          ? `Signed ${new Date(workflow.pcp.decisionAt).toLocaleString()}`
          : undefined,
        status: "done",
      });
    }
    return items;
  }

  // surgeon
  const items: Insight[] = [];
  const sentPcp = pcpLetterSent(workflow);
  const respondedPcp = pcpResponded(workflow);
  items.push({
    label: "Initial clearance request to PCP",
    detail: sentPcp
      ? respondedPcp
        ? "Response received."
        : "Sent. Awaiting PCP response."
      : "Not yet drafted. Generate a draft in the workspace below.",
    status: respondedPcp ? "done" : sentPcp ? "in_progress" : "todo",
  });
  for (const sp of recommended_specialties) {
    const doc = findSpecialistDoctor(specialist_findings, sp);
    const sent = consultLetterSentFor(workflow, sp);
    items.push({
      label: doc
        ? `Direct ${titleCase(sp)} request to ${doc}`
        : `Direct ${titleCase(sp)} request`,
      detail: sent
        ? "Letter sent. Track response."
        : "Optional — PCP may coordinate this on their end.",
      status: sent ? "in_progress" : "todo",
    });
  }
  if (workflow.status === "cleared") {
    items.push({
      label: "Patient cleared — schedule confirmed.",
      status: "done",
    });
  }
  return items;
}
