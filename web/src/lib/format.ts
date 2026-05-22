// Shared display helpers for the ClearPath UI.

import type { Disposition, RiskLevel } from "./types";

export function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

export function prettyDisposition(d: Disposition): string {
  switch (d) {
    case "no_clearance_needed":
      return "No Clearance Needed";
    case "clearance_recommended":
      return "Clearance Recommended";
    case "specialist_required":
      return "Specialist Required";
    case "anesthesia_review_required":
      return "Anesthesia Review Required";
    case "insufficient_information":
      return "Insufficient Information";
  }
}

export interface DispositionStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export function dispositionStyle(d: Disposition): DispositionStyle {
  switch (d) {
    case "no_clearance_needed":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "clearance_recommended":
      return {
        bg: "bg-amber-50",
        text: "text-amber-800",
        border: "border-amber-200",
        dot: "bg-amber-500",
      };
    case "specialist_required":
      return {
        bg: "bg-orange-50",
        text: "text-orange-800",
        border: "border-orange-200",
        dot: "bg-orange-500",
      };
    case "anesthesia_review_required":
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
        dot: "bg-red-500",
      };
    case "insufficient_information":
      return {
        bg: "bg-slate-100",
        text: "text-slate-700",
        border: "border-slate-200",
        dot: "bg-slate-400",
      };
  }
}

export function riskLevelStyle(r: RiskLevel): DispositionStyle {
  switch (r) {
    case "low":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "moderate":
      return {
        bg: "bg-amber-50",
        text: "text-amber-800",
        border: "border-amber-200",
        dot: "bg-amber-500",
      };
    case "high":
      return {
        bg: "bg-orange-50",
        text: "text-orange-800",
        border: "border-orange-200",
        dot: "bg-orange-500",
      };
    case "critical":
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
        dot: "bg-red-500",
      };
  }
}

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age;
}

export function formatDob(dob: string | null | undefined): string {
  if (!dob) return "—";
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return dob;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatGender(g: string | null | undefined): string {
  if (!g) return "—";
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}
