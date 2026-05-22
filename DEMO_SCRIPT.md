# ClearPath — 3-Minute Demo Script

Target runtime: ~3:00. Narration runs ~2:20, leaving room for visual beats and transitions.

---

## [0:00 – 0:15] Hook + Name
*Screen: ClearPath logo / agent card JSON.*

> Surgical clearance is one of the most painful workflows in healthcare. A clinician can spend 30 to 60 minutes per patient chasing labs, meds, and notes across systems — just to decide whether someone can safely have surgery. Meet **ClearPath**.

## [0:15 – 0:50] Problem + Solution
*Screen: architecture diagram — FHIR → engines → Claude → A2A response.*

> ClearPath is an AI pre-operative anesthesia clearance agent, built on the Prompt Opinion platform. It plugs into any FHIR-based EHR over the A2A protocol, pulls the patient's conditions, medications, vitals, and clinical notes, and runs them through two reasoning layers: a deterministic clinical rule engine — RCRI, Tier-1 hard stops, anticoagulation triggers — and Claude Sonnet, which layers on clinical narrative, specialist logic, and plain-language next steps.

## [0:50 – 1:05] Demo Patients
*Screen: Prompt Opinion patient list, six synthetic patients visible.*

> We loaded six synthetic FHIR patients into Prompt Opinion, each engineered to hit a different point on the clearance spectrum — from clean bills of health to high-acuity, multi-specialty referrals. Let's walk through two.

## [1:05 – 1:55] Patient 1 — Sarah Bennett
*Screen: Sarah's chart → run clearance → structured output streams in.*

> First, Sarah Bennett — 34, healthy, in for a wisdom-tooth extraction. ClearPath ingests her FHIR bundle, finds no triggers, no chronic conditions, no daily medications, and returns `NO_CLEARANCE_NEEDED` in seconds — with a clean risk summary.

*Ask follow-up:* **"Any concerns for IV sedation in a healthy adult?"**

> We can ask a follow-up question, and Claude streams a reasoned answer back, citing current anesthesia guidance. Clean case, fast path.

## [1:55 – 2:40] Patient 2 — David Okafor
*Screen: David's chart → clearance result with `SPECIALIST_REQUIRED`, triggers highlighted.*

> Now David Okafor — 68, in for a colonoscopy. He has atrial fibrillation on rivaroxaban, type 2 diabetes, and hypertension. ClearPath flags the anticoagulation trigger and returns `SPECIALIST_REQUIRED`, with structured next steps: cardiology consult, anticoagulation hold protocol, and a recommended timeline.

*Ask follow-up:* **"When should we hold his rivaroxaban before the procedure?"**

> Ask when to hold his rivaroxaban, and Claude reasons across current guidelines and his renal function to give a specific, defensible answer.

## [2:40 – 3:00] Close + Roadmap
*Screen: GitHub repo / agent card / Prompt Opinion marketplace listing.*

> This is our hackathon build, but we're just getting started. We're expanding the clinical guideline coverage, adding more surgical specialties and FHIR data depth, and making ClearPath drop-in compatible with any healthcare platform — fine-tunable on their own protocols and patient data so it fits the way their clinicians already work. Thanks for watching.
