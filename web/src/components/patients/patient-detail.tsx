"use client";

import Link from "next/link";

import { AssessmentView } from "@/components/assessment/assessment-view";
import { ChatPanel } from "@/components/assessment/chat-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useClearance } from "@/lib/hooks/use-clearance";
import { usePatients } from "@/lib/hooks/use-patients";
import { ageFromDob, formatDob, formatGender } from "@/lib/format";
import type { Role } from "@/lib/roles";

interface Props {
  patientId: string;
  /** Role this detail page is being viewed as. Drives backend prompt framing. */
  role: Role;
  /** URL to go back to (typically the role's home). */
  backHref: string;
  backLabel: string;
  /** Wording for the "Run Clearance" CTA per role. */
  runCtaLabel?: string;
  /** Optional default query the role asks ClearPath. */
  defaultQuery?: string;
}

export function PatientDetail({
  patientId,
  role,
  backHref,
  backLabel,
  runCtaLabel = "Run pre-op clearance",
  defaultQuery,
}: Props) {
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
  } = useClearance(patientId, role);

  const age = ageFromDob(summary?.dob ?? null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {backLabel}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {summary?.name ?? (bundleLoading ? "Loading…" : "Unknown Patient")}
          </CardTitle>
          <CardDescription>
            {age !== null ? `${age}-year-old ` : ""}
            {summary ? formatGender(summary.gender).toLowerCase() : "patient"}
            {summary?.dob ? ` · DOB ${formatDob(summary.dob)}` : ""}
            {summary?.pcpDoctor ? ` · PCP ${summary.pcpDoctor}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => run(defaultQuery)}
            disabled={!bundle || clearanceLoading}
          >
            {clearanceLoading
              ? "Running…"
              : clearance
                ? "Re-run clearance"
                : runCtaLabel}
          </Button>
          {clearanceError && (
            <span className="text-sm text-red-700">{clearanceError.message}</span>
          )}
        </CardContent>
      </Card>

      {clearanceLoading && !clearance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Working…</CardTitle>
            <CardDescription>
              Pulling the chart, evaluating clinical triggers, and asking Claude to draft the
              narrative.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      )}

      {clearance && (
        <>
          <AssessmentView clearance={clearance.clearance} />
          {bundle && (
            <ChatPanel
              bundle={bundle}
              assessment={clearance.clearance}
              role={role}
              resetKey={clearance.clearance.generated_at}
            />
          )}
        </>
      )}

      {!clearance && !clearanceLoading && !bundleLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No assessment yet</CardTitle>
            <CardDescription>
              Click <span className="font-medium">{runCtaLabel}</span> to evaluate this
              patient. Letter drafting and follow-up chat land in the next sprints.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
