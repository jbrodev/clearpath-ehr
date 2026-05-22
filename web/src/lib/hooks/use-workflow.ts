"use client";

import { useCallback, useEffect, useState } from "react";

import { getWorkflow, putWorkflow } from "@/lib/api";
import { EMPTY_WORKFLOW, type Workflow } from "@/lib/workflow";

export interface UseWorkflowResult {
  workflow: Workflow;
  isLoading: boolean;
  error: Error | null;
  /** Replace the entire workflow. Returns the persisted copy. */
  save: (next: Workflow) => Promise<Workflow>;
  /** Convenience: apply a patch with new updatedAt set automatically. */
  patch: (mutator: (draft: Workflow) => Workflow) => Promise<Workflow>;
  reload: () => void;
}

export function useWorkflow(patientId: string): UseWorkflowResult {
  const [workflow, setWorkflow] = useState<Workflow>(EMPTY_WORKFLOW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getWorkflow(patientId)
      .then((w) => {
        if (!cancelled) setWorkflow(w ?? EMPTY_WORKFLOW);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, tick]);

  const save = useCallback(
    async (next: Workflow): Promise<Workflow> => {
      try {
        const persisted = await putWorkflow(patientId, next);
        setWorkflow(persisted);
        setError(null);
        return persisted;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        // Return the attempted state so the UI reflects optimistic update
        // even if the server is down. The visible error banner tells the
        // user the change is local-only until the backend recovers.
        setWorkflow(next);
        return next;
      }
    },
    [patientId],
  );

  const patch = useCallback(
    async (mutator: (draft: Workflow) => Workflow): Promise<Workflow> => {
      const draft = mutator({ ...workflow });
      draft.updatedAt = new Date().toISOString();
      return save(draft);
    },
    [workflow, save],
  );

  return {
    workflow,
    isLoading,
    error,
    save,
    patch,
    reload: () => setTick((t) => t + 1),
  };
}
