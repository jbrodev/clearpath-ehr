# Example 2 — Healthy Patient, Major Procedure (Institutional Protocol)

## Patient

Sarah Bennett, 34F. No chronic conditions, no daily medications, normal vitals.

## Query

> Does Sarah need clearance for open heart surgery?

## Response (excerpt)

**Disposition:** `CLEARANCE_RECOMMENDED` | Risk: LOW | RCRI 0/6

Although Sarah has no individual medical risk factors, cardiac surgery requires pre-operative medical clearance per standard institutional protocol (ACC/AHA, ASA). Her PCP should conduct a brief pre-operative evaluation and document clearance prior to the scheduled procedure.

**Flags**
- Institutional protocol: cardiac surgery typically requires pre-operative clearance regardless of patient risk profile (ACC/AHA, ASA standard practice)

**Next Steps**
1. PCP to conduct a brief pre-operative medical evaluation and document clearance
2. Confirm current medication and active problem lists are documented
3. Coordinate with surgical team on any procedure-specific pre-op testing required

## What this demonstrates

- Procedure-driven institutional-protocol escalation
- Patient risk profile alone would have returned `NO_CLEARANCE_NEEDED`; the procedure overrides
- Letter would go to PCP (not the operating cardiac team)
