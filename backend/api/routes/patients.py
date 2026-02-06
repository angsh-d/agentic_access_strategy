"""Patient data and document API routes."""
import json
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.config.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/patients", tags=["Patients"])

# Base directory for patient data
PATIENTS_DIR = Path("data/patients")


def _validate_patient_path(path: Path) -> None:
    """Validate that a path stays within the patients directory."""
    try:
        path.resolve().relative_to(PATIENTS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{patient_id}/data")
async def get_patient_data(patient_id: str) -> Dict[str, Any]:
    """
    Get the full extracted patient data (raw JSON).

    This returns all extracted clinical data with source document attribution,
    used for the Review step where users verify extracted information.

    Args:
        patient_id: Patient identifier (e.g., 'maria_r', 'david_c')

    Returns:
        Complete patient data JSON with all sections and source documents
    """
    patient_file = PATIENTS_DIR / f"{patient_id}.json"
    _validate_patient_path(patient_file)

    if not patient_file.exists():
        raise HTTPException(status_code=404, detail=f"Patient data not found: {patient_id}")

    try:
        with open(patient_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        logger.info("Patient data retrieved", patient_id=patient_id)
        return data
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in patient file", patient_id=patient_id, error=str(e))
        raise HTTPException(status_code=500, detail="Invalid patient data format")
    except Exception as e:
        logger.error("Error reading patient data", patient_id=patient_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{patient_id}/documents")
async def list_patient_documents(patient_id: str) -> Dict[str, Any]:
    """
    List all documents available for a patient.

    Args:
        patient_id: Patient identifier

    Returns:
        List of available documents with metadata
    """
    patient_dir = PATIENTS_DIR / patient_id
    _validate_patient_path(patient_dir)

    if not patient_dir.exists():
        raise HTTPException(status_code=404, detail=f"Patient directory not found: {patient_id}")

    documents = []
    for pdf_file in sorted(patient_dir.glob("*.pdf")):
        documents.append({
            "filename": pdf_file.name,
            "path": f"/api/v1/patients/{patient_id}/documents/{pdf_file.name}",
            "size_bytes": pdf_file.stat().st_size,
            "document_type": _infer_document_type(pdf_file.name)
        })

    return {
        "patient_id": patient_id,
        "document_count": len(documents),
        "documents": documents
    }


@router.get("/{patient_id}/documents/{filename}")
async def get_patient_document(patient_id: str, filename: str):
    """
    Serve a patient document (PDF).

    Args:
        patient_id: Patient identifier
        filename: Document filename

    Returns:
        PDF file
    """
    document_path = PATIENTS_DIR / patient_id / filename

    if not document_path.exists():
        raise HTTPException(status_code=404, detail=f"Document not found: {filename}")

    # Security check - ensure path is within patients directory
    try:
        document_path.resolve().relative_to(PATIENTS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    # Use headers to display inline instead of download
    return FileResponse(
        path=document_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )


@router.patch("/{patient_id}/data")
async def update_patient_field(
    patient_id: str,
    section: str = Query(..., description="Section path, e.g., 'demographics.first_name' or 'diagnoses.0.icd10_code'"),
    value: str = Query(..., description="New value"),
    reason: Optional[str] = Query(None, description="Reason for correction")
) -> Dict[str, Any]:
    """
    Update a field in the patient data (for corrections during review).

    This creates an audit trail of corrections made during the review step.

    Args:
        patient_id: Patient identifier
        section: Dot-notation path to the field to update
        value: New value for the field
        reason: Optional reason for the correction

    Returns:
        Updated field info with correction record
    """
    patient_file = PATIENTS_DIR / f"{patient_id}.json"
    _validate_patient_path(patient_file)

    if not patient_file.exists():
        raise HTTPException(status_code=404, detail=f"Patient data not found: {patient_id}")

    try:
        with open(patient_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Navigate to the field and update
        old_value = _get_nested_value(data, section)
        _set_nested_value(data, section, value)

        # Record the correction in metadata
        if "corrections" not in data:
            data["corrections"] = []

        from datetime import datetime
        data["corrections"].append({
            "field": section,
            "old_value": old_value,
            "new_value": value,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Save updated data
        with open(patient_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        logger.info(
            "Patient data field updated",
            patient_id=patient_id,
            field=section,
            old_value=old_value,
            new_value=value
        )

        return {
            "success": True,
            "field": section,
            "old_value": old_value,
            "new_value": value,
            "correction_recorded": True
        }
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Field not found: {section}")
    except Exception as e:
        logger.error("Error updating patient data", patient_id=patient_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


def _infer_document_type(filename: str) -> str:
    """Infer document type from filename."""
    filename_lower = filename.lower()
    if "prior_auth" in filename_lower or "pa_" in filename_lower:
        return "prior_authorization_form"
    elif "lab" in filename_lower:
        return "laboratory_results"
    elif "colonoscopy" in filename_lower or "endoscopy" in filename_lower:
        return "procedure_report"
    elif "mri" in filename_lower or "ct_" in filename_lower or "xray" in filename_lower:
        return "imaging_report"
    elif "clinical" in filename_lower or "summary" in filename_lower:
        return "clinical_summary"
    else:
        return "other"


def _get_nested_value(data: dict, path: str) -> Any:
    """Get a value from nested dict using dot notation."""
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, list):
            current = current[int(key)]
        else:
            current = current[key]
    return current


def _set_nested_value(data: dict, path: str, value: Any) -> None:
    """Set a value in nested dict using dot notation."""
    keys = path.split(".")
    current = data
    for key in keys[:-1]:
        if isinstance(current, list):
            current = current[int(key)]
        else:
            current = current[key]

    final_key = keys[-1]
    if isinstance(current, list):
        current[int(final_key)] = value
    else:
        current[final_key] = value
