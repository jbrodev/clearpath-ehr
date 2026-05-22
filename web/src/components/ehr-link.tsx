"use client";

import { ExternalLink } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  patientName?: string;
  label?: string;
}

/**
 * "Open in EHR" button that takes the user to the patient's chart in the
 * connected EHR. URL is templated via NEXT_PUBLIC_EHR_PATIENT_URL with the
 * literal `{id}` token replaced by the patient's id.
 *
 * For demo, set NEXT_PUBLIC_EHR_PATIENT_URL=https://example-ehr.test/patient/{id}
 * in .env.local. When unset, the button is disabled with a helpful tooltip.
 */
export function EhrLink({ patientId, patientName, label }: Props) {
  const template = process.env.NEXT_PUBLIC_EHR_PATIENT_URL;
  const href = template ? template.replace("{id}", encodeURIComponent(patientId)) : null;

  if (!href) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Set NEXT_PUBLIC_EHR_PATIENT_URL in .env.local to enable. Use {id} as the placeholder."
      >
        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
        {label ?? "Open in EHR"}
      </Button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={patientName ? `Open ${patientName} in EHR` : "Open patient chart in EHR"}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
      {label ?? "Open in EHR"}
    </a>
  );
}
