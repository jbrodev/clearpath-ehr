"use client";

import { useEffect, useState } from "react";

import { listPatients } from "@/lib/api";
import type { PatientSummary } from "@/lib/types";

export interface UsePatientsResult {
  patients: PatientSummary[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function usePatients(): UsePatientsResult {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listPatients()
      .then((p) => {
        if (!cancelled) setPatients(p);
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
  }, [tick]);

  return {
    patients,
    isLoading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
