"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DispositionBadge } from "@/components/assessment/disposition-badge";
import { RiskSummary } from "@/components/assessment/risk-summary";
import { titleCase } from "@/lib/format";
import type { ClearanceOutput } from "@/lib/types";

interface Props {
  clearance: ClearanceOutput;
}

export function AssessmentView({ clearance }: Props) {
  const {
    disposition,
    risk_level,
    risk_score,
    rcri_score,
    confidence,
    recommended_specialties,
    triggering_factors,
    clinical_summary,
    recommended_next_steps,
    missing_information,
    specialist_findings,
    active_medications,
  } = clearance;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DispositionBadge disposition={disposition} />
            {recommended_specialties.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Specialists
                </span>
                {recommended_specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {titleCase(s)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <RiskSummary
            riskLevel={risk_level}
            riskScore={risk_score}
            rcriScore={rcri_score}
            confidence={confidence}
          />
        </CardHeader>
        <CardContent>
          {clinical_summary ? (
            <p className="text-sm leading-relaxed">{clinical_summary}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              (Clinical summary unavailable — engine produced the disposition deterministically
              but the LLM enrichment was skipped or failed.)
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Triggering Factors</CardTitle>
            <CardDescription>
              Why this disposition fired. Driven by Tier-1 hard stops, Tier-2 factors, and
              institutional-protocol escalations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {triggering_factors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No triggers identified.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {triggering_factors.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended Next Steps</CardTitle>
            <CardDescription>
              Actions for the clinician, grounded in named guidelines (ACC/AHA, ASA, RCRI,
              STOP-BANG, ARISCAT, FDA labeling).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recommended_next_steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No next steps recorded.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {recommended_next_steps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-800">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {missing_information.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">Missing Information</CardTitle>
            <CardDescription className="text-amber-800">
              The clearance was made with these gaps in the chart. Filling them in increases
              confidence and may change the disposition.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-amber-900">
              {missing_information.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {specialist_findings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Specialist Notes</CardTitle>
            <CardDescription>
              Specialists already involved in this patient&apos;s care, pulled from FHIR{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">DocumentReference</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {specialist_findings.map((sf, i) => (
              <div key={i} className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="font-medium">
                  {titleCase(sf.specialty)}
                  {sf.doctor_name ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {sf.doctor_name}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-muted-foreground">{sf.summary}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {active_medications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Medications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {active_medications.map((m, i) => (
                <span
                  key={i}
                  className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs"
                >
                  {m}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
