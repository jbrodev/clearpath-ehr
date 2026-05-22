"""
REST endpoints used by the ClearPath web UI.

These sit alongside the existing A2A endpoint at POST / and let a browser
client run a clearance assessment on an inline FHIR Bundle without needing
to speak JSON-RPC or carry FHIR server credentials. The A2A path stays
unchanged so Prompt Opinion integrations keep working.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from clearpath.engines.medications import classify_medications
from clearpath.fhir.bundle_split import split_bundle
from clearpath.fhir.normalizer import build_snapshot
from clearpath.letters_pdf import (
    LetterMeta,
    find_letter_in_workflow,
    letter_meta_from,
    render_letter_pdf,
    safe_pdf_filename,
    send_letter_email,
)
from clearpath.models.clinical import ClearanceOutput, PatientSnapshot
from clearpath.pipeline import run_clearance_from_bundle
from clearpath.reasoning.engine import stream_followup


router = APIRouter(prefix="/api", tags=["web"])

_SAMPLES_DIR = Path(__file__).resolve().parent.parent / "samples"

# In-memory store of workflow state per patient. Plain dict so all three role
# UIs share the same view (surgeon sends request → PCP sees it → pre-op nurse
# sees the cleared status when PCP signs off). Lost on server restart, which is
# fine for the demo. Production swaps this for Postgres.
_WORKFLOWS: dict[str, dict[str, Any]] = {}


def _list_sample_files() -> list[Path]:
    return sorted(_SAMPLES_DIR.glob("sample_patient_*.fhir.json"))


def _read_bundle(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _patient_summary_from_bundle(bundle: dict, patient_id: str) -> dict:
    patient_res: dict[str, Any] | None = None
    pcp_doctor: str | None = None
    procedure_hint: str | None = None
    condition_count = 0
    medication_count = 0

    for entry in bundle.get("entry", []) or []:
        res = entry.get("resource") or {}
        rt = res.get("resourceType")
        if rt == "Patient" and patient_res is None:
            patient_res = res
        elif rt == "Condition":
            condition_count += 1
        elif rt == "MedicationRequest":
            medication_count += 1
        elif rt == "DocumentReference" and not pcp_doctor:
            authors = res.get("author") or []
            if authors and isinstance(authors[0], dict):
                pcp_doctor = authors[0].get("display")
        elif rt == "Procedure" and not procedure_hint:
            code = res.get("code", {}).get("text") or res.get("code", {}).get("coding", [{}])[0].get("display")
            procedure_hint = code

    name_parts: list[str] = []
    dob = None
    gender = None
    if patient_res:
        names = patient_res.get("name", [])
        if names:
            given = names[0].get("given") or []
            family = names[0].get("family") or ""
            name_parts = list(given) + [family]
        dob = patient_res.get("birthDate")
        gender = patient_res.get("gender")

    full_name = " ".join(p for p in name_parts if p).strip() or "Unknown Patient"

    return {
        "id": patient_id,
        "name": full_name,
        "dob": dob,
        "gender": gender,
        "pcpDoctor": pcp_doctor,
        "procedureHint": procedure_hint,
        "conditionCount": condition_count,
        "medicationCount": medication_count,
    }


@router.get("/patients")
async def list_patients() -> dict:
    """Return summary cards for all built-in synthetic patients."""
    patients = []
    for path in _list_sample_files():
        try:
            bundle = _read_bundle(path)
        except Exception:
            continue
        # path.stem on "sample_patient_sarah_bennett.fhir.json" is
        # "sample_patient_sarah_bennett.fhir" — strip both prefix and suffix.
        pid = path.stem.replace("sample_patient_", "").removesuffix(".fhir")
        patients.append(_patient_summary_from_bundle(bundle, pid))
    return {"patients": patients}


@router.get("/patients/{patient_id}/bundle")
async def get_patient_bundle(patient_id: str) -> JSONResponse:
    path = _SAMPLES_DIR / f"sample_patient_{patient_id}.fhir.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")
    return JSONResponse(content=_read_bundle(path))


class ClearanceRequest(BaseModel):
    bundle: dict[str, Any]
    query: str = "Run pre-operative clearance assessment for this patient"
    role: str | None = None


@router.post("/clearance")
async def run_clearance(req: ClearanceRequest) -> dict:
    """Run the full ClearPath pipeline on an inline FHIR Bundle."""
    if not req.bundle:
        raise HTTPException(status_code=400, detail="bundle is required")
    try:
        output, snapshot, _ = await run_clearance_from_bundle(req.bundle, req.query, role=req.role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {type(e).__name__}: {e}")

    return {
        "clearance": output.model_dump(mode="json"),
        "markdown": output.to_markdown(),
        "patientName": " ".join(p for p in [snapshot.first_name or "", snapshot.last_name or ""] if p).strip(),
    }


class ChatRequest(BaseModel):
    bundle: dict[str, Any]
    assessment: dict[str, Any]
    question: str
    history: list[dict[str, str]] = []
    role: str | None = None


def _rebuild_snapshot(bundle: dict) -> PatientSnapshot:
    fhir_data = split_bundle(bundle)
    snapshot = build_snapshot(fhir_data)
    raw_med_names = [m.name for m in snapshot.active_medications]
    snapshot.active_medications = classify_medications(raw_med_names)
    return snapshot


@router.post("/chat")
async def chat_followup(req: ChatRequest) -> StreamingResponse:
    """Stream a Claude follow-up response over Server-Sent Events.

    The browser keeps the assessment + chat history client-side and sends
    them back with each follow-up. We rebuild the snapshot from the bundle
    on each call so the agent stays stateless.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    if not req.bundle:
        raise HTTPException(status_code=400, detail="bundle is required")

    try:
        snapshot = _rebuild_snapshot(req.bundle)
        output = ClearanceOutput.model_validate(req.assessment)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad request payload: {type(e).__name__}: {e}")

    async def event_stream():
        try:
            async for chunk in stream_followup(
                output, snapshot, req.question, req.history, role=req.role
            ):
                # SSE format: "data: <payload>\n\n"
                payload = json.dumps({"chunk": chunk})
                yield f"data: {payload}\n\n"
            yield "data: {\"done\": true}\n\n"
        except Exception as e:
            err = json.dumps({"error": f"{type(e).__name__}: {e}"})
            yield f"data: {err}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering on Render/nginx
        },
    )


class UploadRequest(BaseModel):
    bundle: dict[str, Any]


class WorkflowPayload(BaseModel):
    workflow: dict[str, Any]


@router.get("/workflow/{patient_id}")
async def get_workflow(patient_id: str) -> dict:
    """Return the persisted workflow for a patient (status, letters, per-role data)."""
    return {"workflow": _WORKFLOWS.get(patient_id) or _empty_workflow()}


@router.put("/workflow/{patient_id}")
async def put_workflow(patient_id: str, body: WorkflowPayload) -> dict:
    """Overwrite the workflow for a patient. Frontend computes the next state
    and PUTs the whole object so the backend stays dumb."""
    if not isinstance(body.workflow, dict):
        raise HTTPException(status_code=400, detail="workflow must be an object")
    _WORKFLOWS[patient_id] = body.workflow
    return {"workflow": _WORKFLOWS[patient_id]}


@router.get("/workflows")
async def list_workflows() -> dict:
    """Return all known workflows (used by role homes to compute queue badges)."""
    return {"workflows": _WORKFLOWS}


def _empty_workflow() -> dict:
    return {
        "status": "not_started",
        "updatedAt": "1970-01-01T00:00:00.000Z",
        "letters": [],
    }


@router.get("/letters/{patient_id}/{letter_id}/pdf")
async def get_letter_pdf(patient_id: str, letter_id: str) -> Response:
    """Render a letter's HTML body into a clinical-letter PDF."""
    workflow = _WORKFLOWS.get(patient_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="patient workflow not found")
    letter = find_letter_in_workflow(workflow, letter_id)
    if letter is None:
        raise HTTPException(status_code=404, detail="letter not found")

    sender_default = "Surgical Office" if letter.get("sentBy") == "surgeon" else (
        "Primary Care" if letter.get("sentBy") == "pcp" else "Coordinator"
    )
    meta = letter_meta_from(letter, default_sender=sender_default)
    try:
        pdf_bytes = render_letter_pdf(meta, letter.get("bodyHtml") or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {e}")

    filename = safe_pdf_filename(letter.get("subject") or "letter")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


class SendEmailRequest(BaseModel):
    patientId: str
    letterId: str
    toEmail: str
    toName: str | None = None
    bodyText: str | None = None


@router.post("/send/email")
async def send_letter_email_endpoint(req: SendEmailRequest) -> dict:
    """Generate the letter PDF and send it as an email attachment.

    Records a delivery entry on the letter so the role UIs can show a
    "Sent via email to X at Y" trail.
    """
    workflow = _WORKFLOWS.get(req.patientId)
    if workflow is None:
        raise HTTPException(status_code=404, detail="patient workflow not found")
    letter = find_letter_in_workflow(workflow, req.letterId)
    if letter is None:
        raise HTTPException(status_code=404, detail="letter not found")

    sender_default = "Surgical Office" if letter.get("sentBy") == "surgeon" else (
        "Primary Care" if letter.get("sentBy") == "pcp" else "Coordinator"
    )
    meta = letter_meta_from(letter, default_sender=sender_default)

    try:
        pdf_bytes = render_letter_pdf(meta, letter.get("bodyHtml") or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {e}")

    body_text = req.bodyText or (
        f"Please see the attached pre-operative clearance correspondence from {meta.sender}. "
        f"This is a draft for clinician review. — ClearPath"
    )
    result = send_letter_email(
        to_email=req.toEmail,
        to_name=req.toName,
        subject=meta.subject,
        body_text=body_text,
        pdf_bytes=pdf_bytes,
        pdf_filename=safe_pdf_filename(meta.subject),
    )

    # Record delivery attempt on the letter so the UI can show a trail.
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    delivery_entry = {
        "via": "email",
        "to": req.toEmail,
        "sentAt": now_iso,
        "status": "sent" if result.sent else ("captured" if result.via == "captured" else "failed"),
        "detail": result.detail,
    }
    deliveries = letter.get("deliveries") or []
    deliveries.append(delivery_entry)
    letter["deliveries"] = deliveries
    _WORKFLOWS[req.patientId] = workflow  # explicit re-store (dict is mutable)

    return {"delivery": delivery_entry, "workflow": workflow}


@router.post("/upload")
async def upload_bundle(req: UploadRequest) -> dict:
    """Validate an uploaded FHIR Bundle and return a quick patient summary.

    The bundle is NOT persisted server-side — the browser keeps it in state
    and sends it back with subsequent /clearance and /chat calls. This
    endpoint just sanity-checks the upload and previews the patient.
    """
    if not isinstance(req.bundle, dict) or req.bundle.get("resourceType") != "Bundle":
        raise HTTPException(status_code=400, detail="payload must be a FHIR Bundle")
    try:
        summary = _patient_summary_from_bundle(req.bundle, patient_id="uploaded")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse Bundle: {type(e).__name__}: {e}")
    return {"summary": summary}
