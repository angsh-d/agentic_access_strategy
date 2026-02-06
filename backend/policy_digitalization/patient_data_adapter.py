"""Patient Data Adapter - Normalizes raw patient JSON for deterministic evaluation.

Converts raw patient data (like data/patients/david_c.json) into a flat,
evaluator-friendly NormalizedPatientData structure.
"""

from datetime import date, datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field


class NormalizedTreatment(BaseModel):
    """Normalized prior treatment record."""
    medication_name: str
    drug_class: Optional[str] = None
    duration_weeks: Optional[int] = None
    outcome: Optional[str] = None  # failed, intolerant, contraindicated, partial_response, inadequate_response, steroid_dependent
    adequate_trial: bool = False

class NormalizedLabResult(BaseModel):
    """Normalized lab result."""
    test_name: str
    loinc_code: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    date: Optional[str] = None
    flag: Optional[str] = None  # H, L, null

class NormalizedScreening(BaseModel):
    """Normalized safety screening."""
    screening_type: str   # tb, hepatitis_b, hepatitis_c
    completed: bool
    result_negative: Optional[bool] = None
    date: Optional[str] = None

class NormalizedBiomarker(BaseModel):
    """Normalized biomarker result (cross-therapeutic)."""
    biomarker_name: str
    result: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    positive: Optional[bool] = None

class NormalizedFunctionalScore(BaseModel):
    """Normalized functional/performance score."""
    score_type: str  # CDAI, ECOG, NYHA, EDSS, etc.
    score_value: Optional[float] = None
    interpretation: Optional[str] = None

class NormalizedImagingResult(BaseModel):
    """Normalized imaging result."""
    modality: str  # colonoscopy, MRI, CT, PET
    date: Optional[str] = None
    findings_summary: Optional[str] = None
    score_type: Optional[str] = None
    score_value: Optional[float] = None

class NormalizedGeneticTest(BaseModel):
    """Normalized genetic test result."""
    test_name: str
    gene: Optional[str] = None
    result: Optional[str] = None
    pathogenic: Optional[bool] = None

class NormalizedPatientData(BaseModel):
    """Flat, evaluator-friendly patient data."""
    patient_id: Optional[str] = None

    # Demographics
    age_years: Optional[int] = None
    gender: Optional[str] = None

    # Diagnosis
    diagnosis_codes: List[str] = Field(default_factory=list)
    disease_severity: Optional[str] = None

    # Treatment history
    prior_treatments: List[NormalizedTreatment] = Field(default_factory=list)

    # Lab results
    lab_results: List[NormalizedLabResult] = Field(default_factory=list)

    # Safety screenings
    completed_screenings: List[NormalizedScreening] = Field(default_factory=list)

    # Prescriber
    prescriber_specialty: Optional[str] = None
    prescriber_npi: Optional[str] = None

    # Cross-therapeutic extensions
    biomarkers: List[NormalizedBiomarker] = Field(default_factory=list)
    functional_scores: List[NormalizedFunctionalScore] = Field(default_factory=list)
    staging: Optional[Dict[str, Any]] = None
    imaging_results: List[NormalizedImagingResult] = Field(default_factory=list)
    genetic_tests: List[NormalizedGeneticTest] = Field(default_factory=list)
    program_enrollments: List[str] = Field(default_factory=list)
    site_of_care: Optional[str] = None
    insurance_formulary_tier: Optional[int] = None


def _calculate_age(dob_str: str) -> Optional[int]:
    """Calculate age from date of birth string."""
    try:
        dob = date.fromisoformat(dob_str)
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except (ValueError, TypeError):
        return None


def _normalize_outcome(raw_outcome: str) -> str:
    """Normalize treatment outcome to standard vocabulary.

    Preserves granular outcome types (inadequate_response, partial_response,
    steroid_dependent) since the evaluator checks for these explicitly.
    Only normalizes spelling/formatting variations.
    """
    outcome_map = {
        "failed": "failed",
        "failure": "failed",
        "inadequate_response": "inadequate_response",
        "inadequate response": "inadequate_response",
        "partial_response": "partial_response",
        "partial response": "partial_response",
        "intolerant": "intolerant",
        "intolerance": "intolerant",
        "contraindicated": "contraindicated",
        "contraindication": "contraindicated",
        "steroid_dependent": "steroid_dependent",
        "steroid-dependent": "steroid_dependent",
        "steroid dependent": "steroid_dependent",
    }
    normalized = (raw_outcome or "").lower().strip()
    return outcome_map.get(normalized, normalized)


def normalize_patient_data(raw: Dict[str, Any]) -> NormalizedPatientData:
    """
    Normalize raw patient JSON into evaluator-friendly format.

    Handles the structure from data/patients/*.json files.
    """
    result = NormalizedPatientData()

    result.patient_id = raw.get("patient_id")

    # Demographics
    demographics = raw.get("demographics", {})
    if demographics.get("date_of_birth"):
        result.age_years = _calculate_age(demographics["date_of_birth"])
    elif demographics.get("age"):
        result.age_years = demographics["age"]
    result.gender = (demographics.get("gender") or "").lower() or None

    # Diagnoses
    for dx in raw.get("diagnoses", []):
        code = dx.get("icd10_code")
        if code:
            result.diagnosis_codes.append(code)

    # Disease severity
    disease_activity = raw.get("disease_activity", {})
    result.disease_severity = disease_activity.get("disease_severity")

    # Prior treatments
    for tx in raw.get("prior_treatments", []):
        result.prior_treatments.append(NormalizedTreatment(
            medication_name=tx.get("medication_name", ""),
            drug_class=tx.get("drug_class"),
            duration_weeks=tx.get("duration_weeks"),
            outcome=_normalize_outcome(tx.get("outcome", "")),
            adequate_trial=tx.get("adequate_trial", False),
        ))

    # Lab results - flatten all panels
    lab_data = raw.get("laboratory_results", {})
    panels = lab_data.get("panels", {})
    for panel_name, panel in panels.items():
        for lab in panel.get("results", []):
            value = lab.get("value")
            if isinstance(value, str):
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    value = None
            result.lab_results.append(NormalizedLabResult(
                test_name=lab.get("test", ""),
                value=value if isinstance(value, (int, float)) else None,
                unit=lab.get("unit"),
                date=lab_data.get("collection_date"),
                flag=lab.get("flag"),
            ))

    # Safety screenings
    screening_data = raw.get("pre_biologic_screening", {})
    tb = screening_data.get("tuberculosis_screening", {})
    if tb:
        result.completed_screenings.append(NormalizedScreening(
            screening_type="tb",
            completed=(tb.get("status") or "").upper() == "COMPLETE",
            result_negative=(tb.get("result") or "").lower() == "negative",
        ))

    hep_b = screening_data.get("hepatitis_b_screening", {})
    if hep_b:
        result.completed_screenings.append(NormalizedScreening(
            screening_type="hepatitis_b",
            completed=(hep_b.get("status") or "").upper() == "COMPLETE",
            result_negative=hep_b.get("cleared_for_biologic", False),
        ))

    hep_c = screening_data.get("hepatitis_c_screening", {})
    if hep_c:
        result.completed_screenings.append(NormalizedScreening(
            screening_type="hepatitis_c",
            completed=(hep_c.get("status") or "").upper() == "COMPLETE",
            result_negative=(hep_c.get("result") or "").lower() in ("non-reactive", "negative"),
        ))

    # Prescriber
    prescriber = raw.get("prescriber", {})
    result.prescriber_specialty = prescriber.get("specialty")
    result.prescriber_npi = prescriber.get("npi")

    # Functional scores (disease activity scores)
    if disease_activity.get("cdai_score") is not None:
        result.functional_scores.append(NormalizedFunctionalScore(
            score_type="CDAI",
            score_value=disease_activity["cdai_score"],
            interpretation=disease_activity.get("cdai_interpretation"),
        ))

    # Imaging / procedures
    procedures = raw.get("procedures", {})
    colonoscopy = procedures.get("colonoscopy", {})
    if colonoscopy:
        endo_score = colonoscopy.get("endoscopic_score", {})
        result.imaging_results.append(NormalizedImagingResult(
            modality="colonoscopy",
            date=colonoscopy.get("procedure_date"),
            findings_summary=colonoscopy.get("impression"),
            score_type=endo_score.get("score_type"),
            score_value=endo_score.get("score_value"),
        ))

    # Site of care
    med_request = raw.get("medication_request", {})
    result.site_of_care = med_request.get("site_of_care")

    return result
