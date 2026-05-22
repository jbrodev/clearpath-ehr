"use client";

import { useCallback, useEffect, useState } from "react";

import { getPatientBundle, runClearance } from "@/lib/api";
import type { Role } from "@/lib/roles";
import type { ClearanceResponse } from "@/lib/types";

interface State {
  bundle: Record<string, unknown> | null;
  bundleLoading: boolean;
  bundleError: Error | null;
  clearance: ClearanceResponse | null;
  clearanceLoading: boolean;
  clearanceError: Error | null;
}

const INITIAL: State = {
  bundle: null,
  bundleLoading: true,
  bundleError: null,
  clearance: null,
  clearanceLoading: false,
  clearanceError: null,
};

export interface UseClearanceResult extends State {
  run: (query?: string) => Promise<void>;
  reset: () => void;
}

const DEFAULT_QUERY = "Run pre-operative clearance assessment for this patient.";

export function useClearance(patientId: string, role?: Role | null): UseClearanceResult {
  const [state, setState] = useState<State>(INITIAL);

  // Fetch the patient bundle on mount / when patientId changes.
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, bundleLoading: true, bundleError: null, bundle: null, clearance: null }));
    getPatientBundle(patientId)
      .then((b) => {
        if (!cancelled) setState((s) => ({ ...s, bundle: b, bundleLoading: false }));
      })
      .catch((e: Error) => {
        if (!cancelled) setState((s) => ({ ...s, bundleError: e, bundleLoading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const run = useCallback(
    async (query?: string): Promise<void> => {
      if (!state.bundle) return;
      setState((s) => ({ ...s, clearanceLoading: true, clearanceError: null }));
      try {
        const res = await runClearance(state.bundle, query || DEFAULT_QUERY, role);
        setState((s) => ({ ...s, clearance: res, clearanceLoading: false }));
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        // Soft fail — record the error in state, no exception propagation.
        // The detail page renders this inline next to the run button.
        setState((s) => ({ ...s, clearanceError: err, clearanceLoading: false }));
      }
    },
    [state.bundle, role],
  );

  const reset = useCallback(() => {
    setState((s) => ({ ...s, clearance: null, clearanceError: null }));
  }, []);

  return { ...state, run, reset };
}
