"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientCard } from "@/components/patients/patient-card";
import { usePatients } from "@/lib/hooks/use-patients";
import type { Role } from "@/lib/roles";

interface Props {
  /** Reserved for role-specific filters/sorting in later sprints. */
  role?: Role;
  heading: string;
  subheading: string;
  /** URL prefix for patient detail pages, e.g. "/preop". The patient id is
   * appended to build the final href. Using a string (not a function) keeps
   * this serializable across the server/client component boundary. */
  detailHrefPrefix: string;
}

export function PatientList({ heading, subheading, detailHrefPrefix }: Props) {
  const hrefFor = (id: string) => `${detailHrefPrefix.replace(/\/$/, "")}/${id}`;
  const { patients, isLoading, error, reload } = usePatients();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground">{subheading}</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Could not load patients</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-800 space-y-2">
            <p>{error.message}</p>
            <p>Make sure the ClearPath backend is running at the configured URL.</p>
            <Button variant="outline" onClick={reload}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-44 animate-pulse">
              <CardHeader>
                <div className="h-4 w-1/2 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              href={hrefFor(p.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && patients.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No patients available</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The backend returned an empty patient list. Confirm the synthetic FHIR bundles
            are present under <code className="rounded bg-muted px-1 py-0.5">/samples</code>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
