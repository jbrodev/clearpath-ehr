"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LIST, ROLES, type Role } from "@/lib/roles";
import { useRole } from "@/lib/use-role";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const router = useRouter();
  const { role, setRole, hydrated } = useRole();

  const pick = (next: Role) => {
    setRole(next);
    router.push(ROLES[next].homePath);
  };

  const goToCurrentHome = () => {
    if (role) router.push(ROLES[role].homePath);
  };

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {hydrated && role ? "Switch role or continue" : "Who are you working as today?"}
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          ClearPath supports three roles in the pre-operative clearance workflow. Pick the
          one that matches your day-to-day; you can switch any time from the top nav.
        </p>
      </div>

      {hydrated && role && (
        <div className="rounded-lg border bg-muted/40 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              Currently signed in as <span className="text-emerald-700 dark:text-emerald-400">{ROLES[role].label}</span>
            </p>
            <p className="text-sm text-muted-foreground">{ROLES[role].tagline}</p>
          </div>
          <Button onClick={goToCurrentHome}>
            Continue to {ROLES[role].label}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ROLE_LIST.map((r) => {
          const isCurrent = hydrated && role === r.id;
          return (
            <button
              key={r.id}
              onClick={() => pick(r.id)}
              className="text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
            >
              <Card
                className={cn(
                  "h-full transition hover:shadow-md",
                  isCurrent && "border-emerald-500/60 ring-1 ring-emerald-500/30",
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    {r.label}
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                        Current
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{r.tagline}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        Demo mode. No real authentication or PHI — the six built-in patients are synthetic FHIR
        bundles. Real SMART on FHIR login lands in v2.
      </div>
    </div>
  );
}
