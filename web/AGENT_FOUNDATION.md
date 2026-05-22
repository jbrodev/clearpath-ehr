# Foundation for role-specific work

Read this before building a role's UI. Use these pieces — don't reinvent them.

## Layout

- App lives in `/web` (Next.js 14, App Router, TS, Tailwind v3)
- Backend at http://localhost:8000 (FastAPI). `NEXT_PUBLIC_API_BASE` env var.
- Roles: `preop` (Pre-Op Nurse), `pcp`, `surgeon`. See `@/lib/roles.ts`.
- Three role areas:
  - `/web/src/app/preop/page.tsx` and `/web/src/app/preop/[patientId]/page.tsx`
  - `/web/src/app/pcp/page.tsx` and `/web/src/app/pcp/[patientId]/page.tsx`
  - `/web/src/app/surgeon/page.tsx` and `/web/src/app/surgeon/[patientId]/page.tsx`
- Role-specific components go in `@/components/preop`, `@/components/pcp`, `@/components/surgeon`.

## Shared API client (`@/lib/api`)

- `listPatients()` → `PatientSummary[]`
- `getPatientBundle(id)` → FHIR bundle JSON
- `runClearance(bundle, query, role?)` → `ClearanceResponse` (the engine output is role-aware via prompt)
- `streamChat(bundle, assessment, question, history, handlers, role?)` → SSE stream
- `getWorkflow(patientId)` → `Workflow`
- `putWorkflow(patientId, workflow)` → persisted `Workflow`
- `listWorkflows()` → `Record<patientId, Workflow>` (for the queue/inbox views)

## Shared types

- `@/lib/types` → `Disposition`, `RiskLevel`, `ClearanceOutput`, `PatientSummary`, `ChatTurn`, `ClearanceResponse`
- `@/lib/workflow` → `Workflow`, `ClearanceStatus`, `SentLetter`, `Role-specific data shapes`, `statusLabel/Variant`, `newLetterId()`, `EMPTY_WORKFLOW`

## Shared hooks

- `useRole()` — current role (always set on a role page)
- `usePatients()` — patient list + loading/error/reload
- `useClearance(patientId, role)` — bundle + assessment, exposes `.run(query)`, `.reset()`, plus loading/error
- `useWorkflow(patientId)` — workflow with `.save(next)` and `.patch((draft) => next)`

## Shared UI primitives (`@/components/ui/*`)

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Button` (variants: default, secondary, outline, ghost, destructive, link; sizes: default, sm, lg, icon)
- `Input`, `Textarea`
- `Badge` (variants: default, secondary, outline, success, warning, danger, info, neutral)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`

## Shared workflow / clinical components

- `@/components/workflow/status-badge` → `<StatusBadge status={...}>`
- `@/components/assessment/assessment-view` → renders a `ClearanceOutput`
- `@/components/assessment/chat-panel` → streaming follow-up Q&A
- `@/components/assessment/disposition-badge` → disposition pill
- `@/components/editor/rich-text-editor` → `<RichTextEditor value onChange ... />` (Tiptap)
- `@/components/letters/printable-letter` → `<PrintableLetter meta bodyHtml />` with Print/Save-as-PDF + Copy actions
- `@/components/ehr-link` → `<EhrLink patientId patientName label />` opens patient in EHR (URL from `NEXT_PUBLIC_EHR_PATIENT_URL`)

## Conventions

- All client components use `"use client"`.
- All role home + detail pages need `export const dynamic = "force-dynamic"` (they depend on client-side state).
- Tailwind v3, no v4 syntax (no `data-[state=open]:`, `group/foo`, `(--var)` class arithmetic).
- Use `cn(...)` from `@/lib/utils` for class composition.
- Don't pass functions across server→client component boundaries — server components must pass serializable props (strings, numbers, plain objects) only.

## Workflow semantics

The `Workflow.status` enum maps to the clinical workflow:

| Status | Set by | Meaning |
|---|---|---|
| `not_started` | (default) | Nothing has happened yet |
| `request_sent` | Surgeon | Surgical office drafted + sent the initial clearance request to PCP |
| `in_review` | PCP | PCP opened the chart and started review |
| `awaiting_consult` | PCP | PCP referred to a specialist and is waiting for that response |
| `cleared` | PCP | PCP signed off — ready for surgery |
| `deferred` | PCP | PCP defers the procedure |
| `rejected` | PCP | Patient not safe for the procedure |

Letters are appended to `workflow.letters[]`. Each letter records who sent it (`sentBy: Role`) so all three roles can see the trail.
