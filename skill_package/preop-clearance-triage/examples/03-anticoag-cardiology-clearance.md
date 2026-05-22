# Example 3 — AFib on Anticoagulation, Specialist Required

## Patient

David Okafor, 68M. Atrial fibrillation on rivaroxaban 20 mg daily for stroke prevention, T2DM, HTN, hyperlipidemia. Cardiologist: Dr. Karen Chen. PCP: Dr. Robert Chen.

## Query

> Please run a pre-op clearance for David for a screening colonoscopy.

## Response (excerpt)

**Disposition:** `SPECIALIST_REQUIRED — Cardiology` | Risk: HIGH | RCRI 1/6

Cardiology clearance is required before David can proceed with his screening colonoscopy due to active anticoagulation with rivaroxaban for atrial fibrillation. The perioperative anticoagulation hold plan must be approved by his cardiologist (Dr. Karen Chen) per ACC/AHA perioperative anticoagulation guidance, given his CHA₂DS₂-VASc score of 4.

**Flags**
- Active anticoagulation therapy
- Diabetes mellitus (controlled)
- Hypertension
- Multiple comorbidities (4 chronic conditions)

**Next Steps**
1. Cardiology consult: confirm rivaroxaban hold plan (typically 24h hold for standard bleeding risk, 48h if upgraded to high bleeding risk)
2. Obtain baseline PT/INR/aPTT before the procedure
3. Confirm metformin management per institutional and FDA labeling guidance
4. BP 142/88 does not delay procedure; PCP to document follow-up plan

**Missing:** Coagulation studies (PT/INR/aPTT)

## Follow-up letter request

> Draft a clearance letter for his cardiologist regarding the rivaroxaban hold plan.

Generates a single focused letter to Cardiology (Dr. Karen Chen), RE: pre-op cardiology clearance for David Okafor, addressing only the anticoagulation hold decision.

## What this demonstrates

- Tier-1 trigger (anticoagulation) firing with cardiology routing (because AFib drives the anticoag indication)
- Disposition-bound clinical summary (no "medically cleared" softening)
- User-specified specialty override (single cardiology letter, not multi-letter set)
