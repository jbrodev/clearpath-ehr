"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
import { StatusBadge } from "@/components/workflow/status-badge";
import { listWorkflows, putWorkflow } from "@/lib/api";
import { usePatients } from "@/lib/hooks/use-patients";
import { ageFromDob, formatGender } from "@/lib/format";
import type { PatientSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  EMPTY_WORKFLOW,
  type Workflow,
  type ClearanceStatus,
} from "@/lib/workflow";

type PaperworkFilter = "all" | "not_drafted" | "drafted" | "sent" | "completed";

interface PaperworkInfo {
  label: string;
  variant: "neutral" | "info" | "warning" | "success" | "danger";
  bucket: Exclude<PaperworkFilter, "all">;
}

function paperworkInfo(wf: Workflow): PaperworkInfo {
  const surgeonLetters = wf.letters.filter((l) => l.sentBy === "surgeon");
  const sent = surgeonLetters.find((l) => !!l.sentAt);
  const draft = surgeonLetters[0];

  if (wf.status === "cleared") {
    return { label: "Cleared", variant: "success", bucket: "completed" };
  }
  if (wf.status === "rejected" || wf.status === "deferred") {
    return {
      label: wf.status === "rejected" ? "Rejected" : "Deferred",
      variant: "danger",
      bucket: "completed",
    };
  }
  if (wf.surgeon?.initialRequestSent || sent) {
    const date = wf.surgeon?.initialRequestSentAt ?? sent?.sentAt;
    return {
      label: date ? `Sent ${shortDate(date)}` : "Sent",
      variant: "info",
      bucket: "sent",
    };
  }
  if (draft) {
    return { label: "Drafted, not sent", variant: "warning", bucket: "drafted" };
  }
  return { label: "Not drafted", variant: "neutral", bucket: "not_drafted" };
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const FILTERS: { id: PaperworkFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_drafted", label: "Not drafted" },
  { id: "drafted", label: "Drafted" },
  { id: "sent", label: "Sent" },
  { id: "completed", label: "Completed" },
];

export function ScheduledProcedures() {
  const { patients, isLoading, error, reload } = usePatients();
  const [workflows, setWorkflows] = useState<Record<string, Workflow>>({});
  const [wfLoading, setWfLoading] = useState(true);
  const [wfError, setWfError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<PaperworkFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadWorkflows = () => {
    setWfLoading(true);
    setWfError(null);
    listWorkflows()
      .then((w) => setWorkflows(w))
      .catch((e: Error) => setWfError(e))
      .finally(() => setWfLoading(false));
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const rows = useMemo(() => {
    return patients.map((p) => {
      const wf = workflows[p.id] ?? EMPTY_WORKFLOW;
      return { patient: p, workflow: wf, info: paperworkInfo(wf) };
    });
  }, [patients, workflows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.info.bucket === filter);
  }, [rows, filter]);

  const stats = useMemo(() => {
    const notDrafted = rows.filter((r) => r.info.bucket === "not_drafted").length;
    const drafted = rows.filter((r) => r.info.bucket === "drafted").length;
    const sent = rows.filter((r) => r.info.bucket === "sent").length;
    const cleared = rows.filter((r) => r.workflow.status === "cleared").length;
    const awaiting = rows.filter(
      (r) =>
        r.workflow.status === "request_sent" ||
        r.workflow.status === "in_review" ||
        r.workflow.status === "awaiting_consult",
    ).length;
    return { notDrafted, drafted, sent, cleared, awaiting };
  }, [rows]);

  const onSavedProcedure = (patientId: string, updated: Workflow) => {
    setWorkflows((prev) => ({ ...prev, [patientId]: updated }));
    setEditingId(null);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Scheduled Procedures
        </h1>
        <p className="text-muted-foreground">
          Procedures on the books and their clearance paperwork status.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today&apos;s queue</CardTitle>
          <CardDescription>
            {stats.notDrafted + stats.drafted} paperwork pending ·{" "}
            {stats.awaiting} awaiting PCP · {stats.cleared} cleared
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Could not load patients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-800">
            <p>{error.message}</p>
            <Button variant="outline" onClick={reload}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {wfError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">
              Could not load workflow state
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            <p>{wfError.message}</p>
            <Button variant="outline" onClick={loadWorkflows}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {(isLoading || wfLoading) && !error && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 w-1/3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !wfLoading && !error && filtered.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing in this view</CardTitle>
            <CardDescription>
              No patients match the current filter. Try the &quot;All&quot; tab.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && !wfLoading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((row) => (
            <ProcedureRow
              key={row.patient.id}
              patient={row.patient}
              workflow={row.workflow}
              info={row.info}
              editing={editingId === row.patient.id}
              onStartEdit={() => setEditingId(row.patient.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaved={(updated) => onSavedProcedure(row.patient.id, updated)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  patient: PatientSummary;
  workflow: Workflow;
  info: PaperworkInfo;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: (wf: Workflow) => void;
}

function ProcedureRow({
  patient,
  workflow,
  info,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaved,
}: RowProps) {
  const age = ageFromDob(patient.dob);
  const procedure = workflow.surgeon?.scheduledProcedure;
  const procedureDate = workflow.surgeon?.scheduledDate;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{patient.name}</span>
            <span className="text-xs text-muted-foreground">
              {age !== null ? `${age} yo` : "age unknown"} ·{" "}
              {formatGender(patient.gender).toLowerCase()}
            </span>
          </div>

          {editing ? (
            <InlineProcedureEditor
              patientId={patient.id}
              workflow={workflow}
              onCancel={onCancelEdit}
              onSaved={onSaved}
            />
          ) : procedure ? (
            <div className="text-sm">
              <span className="font-medium">{procedure}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {procedureDate
                  ? `scheduled ${fullDate(procedureDate)}`
                  : "no date set"}
              </span>
              <button
                onClick={onStartEdit}
                className="ml-3 text-xs text-primary hover:underline"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <span className="italic">Not scheduled</span>
              <button
                onClick={onStartEdit}
                className="ml-3 text-xs text-primary hover:underline"
              >
                Add procedure
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={info.variant}>{info.label}</Badge>
          <StatusBadge status={workflow.status as ClearanceStatus} />
          <Link href={`/surgeon/${patient.id}`}>
            <Button size="sm" variant="outline">
              Open
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface EditorProps {
  patientId: string;
  workflow: Workflow;
  onCancel: () => void;
  onSaved: (wf: Workflow) => void;
}

function InlineProcedureEditor({
  patientId,
  workflow,
  onCancel,
  onSaved,
}: EditorProps) {
  const [procedure, setProcedure] = useState(
    workflow.surgeon?.scheduledProcedure ?? "",
  );
  const [date, setDate] = useState(
    workflow.surgeon?.scheduledDate
      ? workflow.surgeon.scheduledDate.slice(0, 10)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const next: Workflow = {
        ...workflow,
        updatedBy: "surgeon",
        updatedAt: new Date().toISOString(),
        surgeon: {
          ...(workflow.surgeon ?? {}),
          scheduledProcedure: procedure.trim() || undefined,
          scheduledDate: date || undefined,
        },
      };
      const persisted = await putWorkflow(patientId, next);
      onSaved(persisted);
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Input
        value={procedure}
        onChange={(e) => setProcedure(e.target.value)}
        placeholder="e.g. Right total knee arthroplasty"
        className="h-8 min-w-[18rem] text-sm"
      />
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-44 text-sm"
      />
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      {err && <span className="text-xs text-red-700">{err.message}</span>}
    </div>
  );
}
