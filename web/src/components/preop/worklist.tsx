"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/workflow/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listWorkflows } from "@/lib/api";
import { ageFromDob, formatGender } from "@/lib/format";
import { usePatients } from "@/lib/hooks/use-patients";
import {
  EMPTY_WORKFLOW,
  statusLabel,
  type ClearanceStatus,
  type Workflow,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | ClearanceStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_started", label: statusLabel("not_started") },
  { id: "request_sent", label: statusLabel("request_sent") },
  { id: "in_review", label: statusLabel("in_review") },
  { id: "awaiting_consult", label: statusLabel("awaiting_consult") },
  { id: "cleared", label: statusLabel("cleared") },
  { id: "deferred", label: statusLabel("deferred") },
  { id: "rejected", label: statusLabel("rejected") },
];

// Sort priority: most-urgent / most-actionable first. Smaller = higher priority.
const STATUS_PRIORITY: Record<ClearanceStatus, number> = {
  in_review: 0,
  awaiting_consult: 1,
  request_sent: 2,
  not_started: 3,
  cleared: 4,
  deferred: 5,
  rejected: 6,
};

// Statuses that count as still-open work in the queue summary.
const ACTIVE_STATUSES: ClearanceStatus[] = [
  "not_started",
  "request_sent",
  "in_review",
  "awaiting_consult",
];

export function PreOpWorklist() {
  const { patients, isLoading: patientsLoading, error: patientsError, reload } = usePatients();
  const [workflows, setWorkflows] = useState<Record<string, Workflow>>({});
  const [wfLoading, setWfLoading] = useState(true);
  const [wfError, setWfError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setWfLoading(true);
    setWfError(null);
    listWorkflows()
      .then((map) => {
        if (!cancelled) setWorkflows(map);
      })
      .catch((e: Error) => {
        if (!cancelled) setWfError(e);
      })
      .finally(() => {
        if (!cancelled) setWfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return patients
      .map((p) => {
        const wf = workflows[p.id] ?? EMPTY_WORKFLOW;
        const scheduledProcedure =
          wf.surgeon?.scheduledProcedure ?? p.procedureHint ?? null;
        const scheduledDate = wf.surgeon?.scheduledDate ?? null;
        return {
          patient: p,
          workflow: wf,
          scheduledProcedure,
          scheduledDate,
        };
      })
      .filter((r) => {
        if (statusFilter !== "all" && r.workflow.status !== statusFilter) return false;
        if (!term) return true;
        return r.patient.name.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[a.workflow.status] ?? 99;
        const pb = STATUS_PRIORITY[b.workflow.status] ?? 99;
        if (pa !== pb) return pa - pb;
        // Then by scheduled date asc (missing date last).
        const da = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
        const db = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return a.patient.name.localeCompare(b.patient.name);
      });
  }, [patients, workflows, statusFilter, search]);

  const counts = useMemo(() => {
    let active = 0;
    let cleared = 0;
    let deferred = 0;
    let rejected = 0;
    for (const p of patients) {
      const wf = workflows[p.id] ?? EMPTY_WORKFLOW;
      if (ACTIVE_STATUSES.includes(wf.status)) active++;
      else if (wf.status === "cleared") cleared++;
      else if (wf.status === "deferred") deferred++;
      else if (wf.status === "rejected") rejected++;
    }
    return { active, cleared, deferred, rejected };
  }, [patients, workflows]);

  const isLoading = patientsLoading || wfLoading;
  const error = patientsError ?? wfError;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Upcoming Surgery Queue</h1>
        <p className="text-muted-foreground">
          Patients with procedures scheduled. Open each chart to run clearance, draft
          outgoing letters, and track responses.
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{counts.active}</span> active
          {" · "}
          <span className="font-medium text-foreground">{counts.cleared}</span> cleared
          {" · "}
          <span className="font-medium text-foreground">{counts.deferred}</span> deferred
          {counts.rejected > 0 ? (
            <>
              {" · "}
              <span className="font-medium text-foreground">{counts.rejected}</span> rejected
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient name…"
          className="w-full max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Could not load queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-800">
            <p>{error.message}</p>
            <Button variant="outline" onClick={reload}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && !error && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No patients match</CardTitle>
            <CardDescription>
              Adjust the filters above to see more of the queue.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Procedure</th>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const age = ageFromDob(r.patient.dob);
                  return (
                    <tr key={r.patient.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground">
                          {r.patient.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {age !== null ? `${age}y` : "—"}
                          {r.patient.gender ? ` · ${formatGender(r.patient.gender)}` : ""}
                          {r.patient.pcpDoctor ? ` · PCP ${r.patient.pcpDoctor}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.scheduledProcedure ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.scheduledDate
                          ? new Date(r.scheduledDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={r.workflow.status} />
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                        {r.workflow.updatedAt && r.workflow.updatedAt !== EMPTY_WORKFLOW.updatedAt
                          ? new Date(r.workflow.updatedAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Link
                          href={`/preop/${r.patient.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
