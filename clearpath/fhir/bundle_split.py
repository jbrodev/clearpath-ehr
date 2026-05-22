"""
Convert a transaction-style FHIR Bundle (like the synthetic patient samples)
into the per-resource-type dict shape that FHIRClient.fetch_all() returns.

This lets the REST endpoints (/api/clearance, /api/chat) run the existing
pipeline on an inline bundle without spinning up a real FHIR server.
"""

from typing import Any


_BUNDLE_KEYS = (
    "patient", "conditions", "medications", "procedures",
    "documents", "vitals", "labs", "encounters", "allergies",
)


_TYPE_TO_KEY = {
    "Condition": "conditions",
    "MedicationRequest": "medications",
    "Procedure": "procedures",
    "DocumentReference": "documents",
    "Encounter": "encounters",
    "AllergyIntolerance": "allergies",
}


def _empty_bundle() -> dict:
    return {"resourceType": "Bundle", "entry": []}


def split_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    """Split a Bundle into the dict shape FHIRClient.fetch_all() returns."""
    result: dict[str, Any] = {"patient": None}
    for key in _BUNDLE_KEYS[1:]:
        result[key] = _empty_bundle()

    for entry in bundle.get("entry", []) or []:
        res = entry.get("resource") or {}
        rt = res.get("resourceType")
        if rt == "Patient":
            result["patient"] = res
            continue
        if rt == "Observation":
            is_vital = any(
                any(coding.get("code") == "vital-signs" for coding in cat.get("coding", []))
                for cat in res.get("category", []) or []
            )
            key = "vitals" if is_vital else "labs"
            result[key]["entry"].append({"resource": res})
            continue
        key = _TYPE_TO_KEY.get(rt)
        if key:
            result[key]["entry"].append({"resource": res})

    return result
