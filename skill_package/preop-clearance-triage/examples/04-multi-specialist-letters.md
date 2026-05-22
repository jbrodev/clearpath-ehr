# Example 4 — High-Acuity Patient, Multi-Specialist Letters in Parallel

## Patient

Linda Rivera, 71F. Recent NSTEMI with DES on dual antiplatelet therapy (aspirin + clopidogrel), O₂-dependent COPD, severe OSA, CKD stage 3. Scheduled for elective hip replacement.

## Query

> Draft clearance letters for Linda's hip replacement.

## Response

**Disposition:** `SPECIALIST_REQUIRED — Cardiology, Hematology, Pulmonology` | Risk: CRITICAL | RCRI 2/6

Linda requires multi-specialist clearance before proceeding with elective hip replacement. Three independent specialist evaluations are needed: cardiology for recent NSTEMI and DAPT timing, hematology for perioperative DAPT bleeding management, and pulmonology for O₂-dependent COPD and severe OSA. All clearances must be obtained before surgery is scheduled.

**Letters generated in parallel** (`asyncio.gather`):

1. **Letter to Cardiology** — re: recent NSTEMI on DAPT, DAPT timing per ACC/AHA, perioperative cardiac risk
2. **Letter to Hematology** — re: DAPT bleeding management, perioperative hold/bridge plan
3. **Letter to Pulmonology** — re: O₂-dependent COPD, severe OSA, perioperative respiratory management

Each letter is focused only on the issues in that specialist's clinical domain. Issues for one specialty are not duplicated into another.

## What this demonstrates

- Multiple Tier-1 triggers mapping to multiple specialties
- Parallel letter generation — wall-clock time roughly equal to a single letter
- Strict per-specialty content scoping (no cross-contamination of clinical issues)
- Surgical office → specialist direct routing (not PCP coordinated, because each specialty owns its own domain question)
