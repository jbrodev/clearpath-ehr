# Example 5 — Sparse Chart, Insufficient Information

## Patient

Robert Hale, 78M. Empty chart — no documented conditions, no medications, no recent notes.

## Query

> Run pre-op clearance for Robert.

## Response (excerpt)

**Disposition:** `INSUFFICIENT_INFORMATION` | Risk: LOW | RCRI 0/6

The available clinical data is insufficient to complete a pre-operative clearance evaluation. Key elements including active condition list, medication reconciliation, primary care notes, and recent vital signs are missing from the chart. A clearance decision cannot be made without these.

**Next Steps**
1. Obtain complete medication reconciliation
2. Retrieve the most recent PCP or primary care note
3. Obtain baseline vital signs and recent labs before scheduling

**Missing**
- Active condition list
- Active medication list
- Primary care clinical notes
- Recent blood pressure readings

## What this demonstrates

- Safety property: ClearPath refuses to clear (or fail-open recommend clearance) when data is missing
- Explicit missing-data enumeration so the requesting clinician knows exactly what to fetch
- No "cleared because nothing showed up" — absence of data is treated as absence of assurance
