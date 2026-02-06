"""Policy analysis API routes."""
import re
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.api.requests import AnalyzePoliciesRequest
from backend.api.responses import PolicyAnalysisResponse
from backend.reasoning.policy_reasoner import get_policy_reasoner
from backend.policy_digitalization.exceptions import PolicyNotFoundError
from backend.config.logging_config import get_logger

logger = get_logger(__name__)

# Validation pattern for payer and medication names
# Allows letters, numbers, hyphens, and underscores only
VALID_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')
MAX_NAME_LENGTH = 50


def _validate_name(name: str, field: str) -> str:
    """Validate and sanitize payer/medication name."""
    if not name:
        raise HTTPException(status_code=400, detail=f"{field} cannot be empty")
    if len(name) > MAX_NAME_LENGTH:
        raise HTTPException(status_code=400, detail=f"{field} exceeds maximum length of {MAX_NAME_LENGTH}")
    if not VALID_NAME_PATTERN.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"{field} contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed."
        )
    return name.lower()

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.post("/analyze", response_model=PolicyAnalysisResponse)
async def analyze_policy(request: AnalyzePoliciesRequest):
    """
    Analyze a payer policy for coverage eligibility.

    This endpoint uses Claude for policy reasoning - no fallback.

    Args:
        request: Analysis request with patient, medication, and payer info

    Returns:
        Coverage assessment results
    """
    try:
        payer_safe = _validate_name(request.payer_name, "Payer")
        reasoner = get_policy_reasoner()

        assessment = await reasoner.assess_coverage(
            patient_info=request.patient_info,
            medication_info=request.medication_info,
            payer_name=payer_safe
        )

        return PolicyAnalysisResponse(
            payer_name=assessment.payer_name,
            coverage_status=assessment.coverage_status.value,
            approval_likelihood=assessment.approval_likelihood,
            criteria_met=assessment.criteria_met_count,
            criteria_total=assessment.criteria_total_count,
            documentation_gaps=[g.model_dump() for g in assessment.documentation_gaps],
            recommendations=assessment.recommendations,
            step_therapy_required=assessment.step_therapy_required,
            step_therapy_satisfied=assessment.step_therapy_satisfied
        )

    except (FileNotFoundError, PolicyNotFoundError):
        raise HTTPException(status_code=404, detail=f"Policy not found for {payer_safe}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error analyzing policy", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/available")
async def list_available_policies():
    """
    List available policy documents.

    Returns:
        List of available payer/medication policy combinations
    """
    from pathlib import Path

    policies_dir = Path("data/policies")
    policies = []

    if policies_dir.exists():
        for policy_file in policies_dir.glob("*.txt"):
            name = policy_file.stem
            parts = name.split("_")
            if len(parts) >= 2:
                payer = parts[0].title()
                medication = "_".join(parts[1:]).replace("_", " ").title()
                policies.append({
                    "file": policy_file.name,
                    "payer": payer,
                    "medication": medication
                })

    return {"policies": policies}


@router.get("/{payer}/{medication}")
async def get_policy_content(payer: str, medication: str):
    """
    Get the content of a specific policy document.

    Args:
        payer: Payer name (e.g., cigna, uhc)
        medication: Medication name (e.g., infliximab)

    Returns:
        Policy document content
    """
    from pathlib import Path

    # Validate inputs
    payer_safe = _validate_name(payer, "Payer")
    medication_safe = _validate_name(medication, "Medication")

    policies_dir = Path("data/policies")
    policy_file = policies_dir / f"{payer_safe}_{medication_safe}.txt"

    if not policy_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Policy not found for {payer}/{medication}"
        )

    try:
        with open(policy_file, "r", encoding="utf-8") as f:
            content = f.read()
    except IOError as e:
        logger.error(f"Error reading policy file: {e}")
        raise HTTPException(status_code=500, detail="Error reading policy file")

    return {
        "payer": payer,
        "medication": medication,
        "content": content,
        "file": policy_file.name
    }


@router.get("/criteria/{payer}/{medication}")
async def get_policy_criteria(payer: str, medication: str):
    """
    Extract key criteria from a policy document.

    Args:
        payer: Payer name
        medication: Medication name

    Returns:
        Key coverage criteria
    """
    from pathlib import Path

    # Validate inputs
    payer_safe = _validate_name(payer, "Payer")
    medication_safe = _validate_name(medication, "Medication")

    policies_dir = Path("data/policies")
    policy_file = policies_dir / f"{payer_safe}_{medication_safe}.txt"

    # Base criteria structure for all policies
    base_criteria = {
        "payer": payer,
        "medication": medication,
        "criteria_categories": [
            {
                "category": "Diagnosis Confirmation",
                "requirements": [
                    "Confirmed diagnosis of indicated condition",
                    "Supporting lab work or imaging"
                ]
            },
            {
                "category": "Step Therapy",
                "requirements": [
                    "Trial of conventional therapies",
                    "Documentation of inadequate response or intolerance"
                ]
            },
            {
                "category": "Safety Screening",
                "requirements": [
                    "TB screening",
                    "Hepatitis screening",
                    "Baseline labs"
                ]
            },
            {
                "category": "Prescriber Requirements",
                "requirements": [
                    "Prescribed by or in consultation with specialist"
                ]
            }
        ]
    }

    # If policy file exists, try to extract specific criteria
    if policy_file.exists():
        try:
            with open(policy_file, "r", encoding="utf-8") as f:
                content = f.read().lower()

            # Enhance criteria based on policy content analysis
            if "crohn" in content or "ulcerative colitis" in content:
                base_criteria["criteria_categories"][0]["requirements"].append(
                    "Documented moderate-to-severe disease activity"
                )

            if "methotrexate" in content or "corticosteroid" in content:
                base_criteria["criteria_categories"][1]["requirements"].append(
                    "Prior treatment with conventional DMARDs"
                )

            if "specialist" in content or "rheumatologist" in content:
                base_criteria["criteria_categories"][3]["requirements"].append(
                    "Specialist consultation documentation"
                )

        except IOError as e:
            logger.warning(f"Could not read policy file: {e}")

    return base_criteria


class DigitalizeRequest(BaseModel):
    payer_name: str
    medication_name: str
    policy_text: Optional[str] = Field(None, max_length=500_000)
    skip_validation: bool = False


class EvaluateRequest(BaseModel):
    patient_info: dict

    @field_validator("patient_info")
    @classmethod
    def validate_patient_info(cls, v: dict) -> dict:
        if not v:
            raise ValueError("patient_info must not be empty")
        if len(json.dumps(v, default=str)) > 100_000:
            raise ValueError("patient_info exceeds maximum size")
        return v


class DiffRequest(BaseModel):
    old_version: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")
    new_version: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")


@router.post("/digitalize")
async def digitalize_policy(request: DigitalizeRequest):
    """
    Trigger policy digitalization pipeline.

    Runs: Gemini extraction -> Claude validation -> reference validation.
    """
    from backend.policy_digitalization.pipeline import get_digitalization_pipeline

    payer_safe = _validate_name(request.payer_name, "Payer")
    med_safe = _validate_name(request.medication_name, "Medication")

    try:
        pipeline = get_digitalization_pipeline()

        if request.policy_text:
            result = await pipeline.digitalize_policy(
                source=request.policy_text,
                source_type="text",
                skip_validation=request.skip_validation,
            )
        else:
            # Load from file
            from pathlib import Path
            policy_file = Path("data/policies") / f"{payer_safe}_{med_safe}.txt"
            if not policy_file.exists():
                raise HTTPException(status_code=404, detail=f"Policy text not found for {payer_safe}/{med_safe}")
            policy_text = policy_file.read_text(encoding="utf-8")
            result = await pipeline.digitalize_policy(
                source=policy_text,
                source_type="text",
                skip_validation=request.skip_validation,
            )

        return {
            "status": "success",
            "policy_id": result.policy.get("policy_id") if result.policy else None,
            "criteria_count": result.criteria_count,
            "indications_count": result.indications_count,
            "extraction_quality": result.extraction_quality,
            "validation_status": result.validation_status,
            "quality_score": result.quality_score,
            "passes_completed": result.passes_completed,
            "corrections_count": result.corrections_count,
            "stored": result.stored,
            "cache_id": result.cache_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error digitalizing policy", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{payer}/{medication}/evaluate")
async def evaluate_patient_against_policy(payer: str, medication: str, request: EvaluateRequest):
    """
    Run deterministic patient-vs-policy evaluation.

    Returns per-criterion verdicts without LLM involvement.
    """
    from backend.policy_digitalization.pipeline import get_digitalization_pipeline
    from backend.policy_digitalization.patient_data_adapter import normalize_patient_data
    from backend.policy_digitalization.evaluator import evaluate_policy

    payer_safe = _validate_name(payer, "Payer")
    med_safe = _validate_name(medication, "Medication")

    try:
        pipeline = get_digitalization_pipeline()
        policy = await pipeline.get_or_digitalize(payer_safe, med_safe)
        patient = normalize_patient_data(request.patient_info)
        result = evaluate_policy(policy, patient)
        return result.model_dump()
    except (FileNotFoundError, PolicyNotFoundError):
        raise HTTPException(status_code=404, detail=f"Policy not found for {payer_safe}/{med_safe}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error evaluating policy", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{payer}/{medication}/provenance")
async def get_policy_provenance(payer: str, medication: str):
    """
    Get extraction quality and provenance report for a digitized policy.
    """
    from backend.policy_digitalization.pipeline import get_digitalization_pipeline

    payer_safe = _validate_name(payer, "Payer")
    med_safe = _validate_name(medication, "Medication")

    try:
        pipeline = get_digitalization_pipeline()
        policy = await pipeline.get_or_digitalize(payer_safe, med_safe)

        return {
            "policy_id": policy.policy_id,
            "payer_name": policy.payer_name,
            "medication_name": policy.medication_name,
            "extraction_quality": policy.extraction_quality,
            "extraction_pipeline_version": policy.extraction_pipeline_version,
            "validation_model": policy.validation_model,
            "total_criteria": len(policy.atomic_criteria),
            "provenances": {
                cid: prov.model_dump() for cid, prov in policy.provenances.items()
            },
        }
    except (FileNotFoundError, PolicyNotFoundError):
        raise HTTPException(status_code=404, detail=f"Policy not found for {payer_safe}/{med_safe}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting provenance", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{payer}/{medication}/diff")
async def diff_policy_versions(payer: str, medication: str, request: DiffRequest):
    """
    Diff two versions of a digitized policy.
    """
    from backend.policy_digitalization.policy_repository import get_policy_repository
    from backend.policy_digitalization.differ import PolicyDiffer

    payer_safe = _validate_name(payer, "Payer")
    med_safe = _validate_name(medication, "Medication")

    try:
        repo = get_policy_repository()
        old_policy = await repo.load_version(payer_safe, med_safe, request.old_version)
        new_policy = await repo.load_version(payer_safe, med_safe, request.new_version)

        if not old_policy:
            raise HTTPException(status_code=404, detail=f"Version {request.old_version} not found")
        if not new_policy:
            raise HTTPException(status_code=404, detail=f"Version {request.new_version} not found")

        differ = PolicyDiffer()
        result = differ.diff(old_policy, new_policy)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error diffing policies", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{payer}/{medication}/impact")
async def analyze_policy_impact(payer: str, medication: str, request: DiffRequest):
    """
    Analyze impact of policy changes on active cases.
    """
    from backend.policy_digitalization.policy_repository import get_policy_repository
    from backend.policy_digitalization.differ import PolicyDiffer
    from backend.policy_digitalization.impact_analyzer import PolicyImpactAnalyzer

    payer_safe = _validate_name(payer, "Payer")
    med_safe = _validate_name(medication, "Medication")

    try:
        repo = get_policy_repository()
        old_policy = await repo.load_version(payer_safe, med_safe, request.old_version)
        new_policy = await repo.load_version(payer_safe, med_safe, request.new_version)

        if not old_policy:
            raise HTTPException(status_code=404, detail=f"Version {request.old_version} not found")
        if not new_policy:
            raise HTTPException(status_code=404, detail=f"Version {request.new_version} not found")

        # Diff
        differ = PolicyDiffer()
        diff = differ.diff(old_policy, new_policy)

        # Get active cases (exclude completed/failed)
        from backend.storage.database import get_db
        from backend.storage.case_repository import CaseRepository

        async with get_db() as session:
            case_repo = CaseRepository(session)
            all_cases = await case_repo.get_all(limit=500)
            case_states = [
                c.to_dict() for c in all_cases
                if c.stage not in ("completed", "failed")
            ]

        # Analyze impact
        analyzer = PolicyImpactAnalyzer()
        report = await analyzer.analyze_impact(diff, old_policy, new_policy, case_states)
        return report.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error analyzing impact", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{payer}/{medication}/digitized")
async def get_digitized_policy(payer: str, medication: str):
    """
    Get a digitized, structured representation of a policy.

    This endpoint returns the comprehensive digitized policy data with:
    - Atomic criteria decomposition
    - Logical criterion groups (AND/OR/NOT)
    - All covered indications with ICD-10 codes
    - Step therapy requirements
    - Exclusions

    Args:
        payer: Payer name (e.g., cigna, uhc)
        medication: Medication name (e.g., infliximab)

    Returns:
        Digitized policy with full structured criteria
    """
    from pathlib import Path
    import json

    # Validate inputs
    payer_safe = _validate_name(payer, "Payer")
    medication_safe = _validate_name(medication, "Medication")

    policies_dir = Path("data/policies")

    # First, check for a pre-digitized JSON file
    digitized_file = policies_dir / f"{payer_safe}_{medication_safe}_digitized.json"

    if digitized_file.exists():
        try:
            with open(digitized_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (IOError, json.JSONDecodeError) as e:
            logger.warning(f"Could not read digitized policy file: {e}")

    # Fall back to generating basic structure from policy text
    policy_file = policies_dir / f"{payer_safe}_{medication_safe}.txt"

    # Generate policy ID
    policy_id = f"{payer_safe[:2].upper()}{medication_safe[:4].upper()}"

    # Base digitized structure (legacy format for backward compatibility)
    digitized = {
        "policy_id": policy_id,
        "policy_number": policy_id,
        "policy_title": f"{medication.title()} Prior Authorization Policy",
        "payer_name": payer.title(),
        "medication_name": medication.title(),
        "medication_brand_names": [],
        "medication_generic_names": [_get_generic_name(medication_safe)],
        "medication_codes": [],
        "effective_date": None,
        "last_revision_date": None,
        "atomic_criteria": {},
        "criterion_groups": {},
        "indications": [],
        "exclusions": [],
        "step_therapy_requirements": [],
        "required_specialties": [],
        "consultation_allowed": True,
        "safety_screenings": [],
        "extraction_timestamp": None,
        "extraction_model": None,
        "source_document_hash": None
    }

    # Define medication-specific data
    medication_data = _get_medication_specific_data(medication_safe)

    # Convert legacy indication format to new format
    for idx, ind in enumerate(medication_data.get("indications", [])):
        digitized["indications"].append({
            "indication_id": f"IND_{idx}",
            "indication_name": ind.get("name", "Unknown"),
            "indication_codes": [],
            "initial_approval_criteria": f"GRP_IND_{idx}_INITIAL",
            "continuation_criteria": None,
            "initial_approval_duration_months": 6,
            "continuation_approval_duration_months": 12,
            "dosing_requirements": [],
            "min_age_years": _parse_age_requirement(ind.get("age_requirement")),
            "max_age_years": None
        })

    # Add step therapy requirements
    if medication_data.get("step_therapy_options"):
        digitized["step_therapy_requirements"].append({
            "requirement_id": "STEP_REQ_1",
            "indication": "All Indications",
            "required_drugs": [],
            "required_drug_classes": medication_data.get("step_therapy_options", []),
            "minimum_trials": 1,
            "minimum_duration_days": None,
            "failure_required": True,
            "intolerance_acceptable": True,
            "contraindication_acceptable": True,
            "documentation_requirements": ["prescription records"]
        })

    return digitized


def _parse_age_requirement(age_str: str | None) -> int | None:
    """Parse age requirement string like '>=6 years' to integer."""
    if not age_str:
        return None
    import re
    match = re.search(r'(\d+)', age_str)
    return int(match.group(1)) if match else None


def _get_generic_name(medication: str) -> str:
    """Map brand names to generic names."""
    generic_map = {
        "infliximab": "Infliximab",
        "remicade": "Infliximab",
        "humira": "Adalimumab",
        "adalimumab": "Adalimumab",
        "enbrel": "Etanercept",
        "etanercept": "Etanercept",
        "stelara": "Ustekinumab",
        "ustekinumab": "Ustekinumab",
        "entyvio": "Vedolizumab",
        "vedolizumab": "Vedolizumab",
    }
    return generic_map.get(medication.lower(), medication.title())


def _get_medication_specific_data(medication: str) -> dict:
    """Get medication-specific indication and step therapy data."""

    # Infliximab / Remicade
    if medication in ["infliximab", "remicade"]:
        return {
            "indications": [
                {
                    "name": "Crohn's Disease",
                    "age_requirement": ">=6 years",
                    "severity": "Moderate-to-severe",
                    "criteria": [
                        "Confirmed diagnosis of Crohn's disease",
                        "Moderate-to-severe disease activity",
                        "Inadequate response to conventional therapy"
                    ]
                },
                {
                    "name": "Ulcerative Colitis",
                    "age_requirement": ">=6 years",
                    "severity": "Moderate-to-severe",
                    "criteria": [
                        "Confirmed diagnosis of ulcerative colitis",
                        "Moderate-to-severe disease activity",
                        "Inadequate response to conventional therapy"
                    ]
                },
                {
                    "name": "Rheumatoid Arthritis",
                    "age_requirement": ">=18 years",
                    "severity": "Moderate-to-severe",
                    "criteria": [
                        "Confirmed diagnosis of RA",
                        "Active disease despite DMARD therapy",
                        "Use in combination with methotrexate"
                    ]
                },
                {
                    "name": "Ankylosing Spondylitis",
                    "age_requirement": ">=18 years",
                    "criteria": [
                        "Confirmed diagnosis of AS",
                        "Active disease despite NSAIDs"
                    ]
                }
            ],
            "step_therapy_options": [
                "Corticosteroids",
                "5-ASA medications",
                "Azathioprine/6-MP",
                "Methotrexate"
            ]
        }

    # Adalimumab / Humira
    elif medication in ["adalimumab", "humira"]:
        return {
            "indications": [
                {
                    "name": "Rheumatoid Arthritis",
                    "age_requirement": ">=18 years",
                    "criteria": [
                        "Confirmed diagnosis of RA",
                        "Moderate-to-severe active disease"
                    ]
                },
                {
                    "name": "Psoriatic Arthritis",
                    "age_requirement": ">=18 years",
                    "criteria": [
                        "Confirmed diagnosis of PsA",
                        "Active disease"
                    ]
                },
                {
                    "name": "Plaque Psoriasis",
                    "age_requirement": ">=18 years",
                    "severity": "Moderate-to-severe",
                    "criteria": [
                        "Chronic plaque psoriasis",
                        "Candidate for systemic therapy"
                    ]
                }
            ],
            "step_therapy_options": [
                "NSAIDs",
                "Methotrexate",
                "Conventional DMARDs"
            ]
        }

    # Default for other medications
    return {
        "indications": [
            {
                "name": "As per FDA-approved labeling",
                "criteria": [
                    "Meets diagnostic criteria for approved indication",
                    "Failed or contraindicated to conventional therapy"
                ]
            }
        ],
        "step_therapy_options": [
            "Conventional therapy as appropriate"
        ]
    }


def _extract_policy_details(content: str, medication: str) -> dict:
    """Extract specific details from policy text."""
    result = {}
    content_lower = content.lower()

    # Try to identify indications mentioned
    indications = []
    indication_keywords = [
        ("crohn", "Crohn's Disease"),
        ("ulcerative colitis", "Ulcerative Colitis"),
        ("rheumatoid arthritis", "Rheumatoid Arthritis"),
        ("ankylosing spondylitis", "Ankylosing Spondylitis"),
        ("psoriatic arthritis", "Psoriatic Arthritis"),
        ("plaque psoriasis", "Plaque Psoriasis"),
    ]

    for keyword, name in indication_keywords:
        if keyword in content_lower:
            indications.append({
                "name": name,
                "criteria": [f"Confirmed diagnosis of {name}"]
            })

    if indications:
        result["indications"] = indications

    # Try to identify step therapy drugs
    step_therapy = []
    step_drugs = [
        "methotrexate", "corticosteroid", "prednisone",
        "azathioprine", "5-asa", "sulfasalazine"
    ]

    for drug in step_drugs:
        if drug in content_lower:
            step_therapy.append(drug.title())

    if step_therapy:
        result["step_therapy_options"] = step_therapy

    return result


def _generate_criteria_categories(medication: str, indications: list) -> list:
    """Generate criteria categories for the policy."""
    categories = [
        {
            "id": "diagnosis",
            "name": "Diagnosis Requirements",
            "icon": "diagnosis",
            "criteria": [
                {
                    "id": "diag-1",
                    "name": "Confirmed diagnosis",
                    "description": "Documentation of confirmed diagnosis with ICD-10 codes"
                },
                {
                    "id": "diag-2",
                    "name": "Disease severity",
                    "description": "Evidence of moderate-to-severe disease activity"
                }
            ]
        },
        {
            "id": "step_therapy",
            "name": "Prior Treatment",
            "icon": "step_therapy",
            "criteria": [
                {
                    "id": "step-1",
                    "name": "Conventional therapy trial",
                    "description": "Documentation of trial with conventional therapy"
                },
                {
                    "id": "step-2",
                    "name": "Treatment failure/intolerance",
                    "description": "Evidence of inadequate response or intolerance"
                }
            ]
        },
        {
            "id": "safety",
            "name": "Safety Screening",
            "icon": "safety",
            "criteria": [
                {
                    "id": "safe-1",
                    "name": "TB screening",
                    "description": "Negative TB test within 6 months"
                },
                {
                    "id": "safe-2",
                    "name": "Hepatitis screening",
                    "description": "Hepatitis B and C screening completed"
                }
            ]
        },
        {
            "id": "prescriber",
            "name": "Prescriber Requirements",
            "icon": "prescriber",
            "criteria": [
                {
                    "id": "presc-1",
                    "name": "Specialist prescription",
                    "description": "Prescribed by or in consultation with appropriate specialist"
                }
            ]
        }
    ]

    # Add indication-specific criteria if available
    if indications:
        indication_criteria = []
        for idx, indication in enumerate(indications):
            indication_criteria.append({
                "id": f"ind-{idx}",
                "name": f"Meets criteria for {indication.get('name', 'indication')}",
                "description": f"Patient meets all requirements for {indication.get('name', 'the indicated condition')}"
            })

        if indication_criteria:
            categories.insert(1, {
                "id": "indications",
                "name": "Indication Criteria",
                "icon": "documentation",
                "criteria": indication_criteria
            })

    return categories
