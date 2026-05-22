"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ageFromDob, formatDob, formatGender } from "@/lib/format";
import type { PatientSummary } from "@/lib/types";

interface Props {
  patient: PatientSummary;
  href: string;
}

export function PatientCard({ patient, href }: Props) {
  const age = ageFromDob(patient.dob);
  return (
    <Link
      href={href}
      className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <Card className="h-full transition hover:shadow-md hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{patient.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {age !== null ? `${age}y` : "—"}
              {patient.gender ? ` · ${formatGender(patient.gender)}` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
            <dt>DOB</dt>
            <dd className="text-foreground">{formatDob(patient.dob)}</dd>
            <dt>Conditions</dt>
            <dd className="text-foreground">{patient.conditionCount}</dd>
            <dt>Medications</dt>
            <dd className="text-foreground">{patient.medicationCount}</dd>
            {patient.pcpDoctor ? (
              <>
                <dt>PCP</dt>
                <dd className="text-foreground truncate" title={patient.pcpDoctor}>
                  {patient.pcpDoctor}
                </dd>
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}
