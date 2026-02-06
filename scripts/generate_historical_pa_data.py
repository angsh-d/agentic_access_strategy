"""
Generate Realistic Historical PA Cases Dataset

This script creates a clinically accurate, high-volume dataset of historical
Prior Authorization cases for IBD biologics. The data embeds learnable patterns
that demonstrate AI reasoning and goal-based planning capabilities.

Clinical Accuracy:
- Proper ICD-10 codes for Crohn's Disease (K50.x) and Ulcerative Colitis (K51.x)
- Realistic disease severity scores (CDAI, HBI, Mayo, UCEIS)
- Evidence-based step therapy requirements
- Accurate lab value ranges
- Real-world payer requirement patterns

Embedded Patterns for AI Learning:
1. Documentation completeness → approval probability
2. Payer-specific requirement differences (Cigna vs UHC)
3. Step therapy adequacy impacts
4. Disease severity documentation importance
5. Timing patterns (day of week, time of year)
6. Appeal success factors
"""

import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

# Seed for reproducibility
random.seed(42)

# =============================================================================
# CLINICAL REFERENCE DATA
# =============================================================================

# ICD-10 codes for IBD
ICD10_CROHNS = [
    {"code": "K50.00", "desc": "Crohn's disease of small intestine without complications"},
    {"code": "K50.011", "desc": "Crohn's disease of small intestine with rectal bleeding"},
    {"code": "K50.012", "desc": "Crohn's disease of small intestine with intestinal obstruction"},
    {"code": "K50.10", "desc": "Crohn's disease of large intestine without complications"},
    {"code": "K50.111", "desc": "Crohn's disease of large intestine with rectal bleeding"},
    {"code": "K50.80", "desc": "Crohn's disease of both small and large intestine without complications"},
    {"code": "K50.90", "desc": "Crohn's disease, unspecified, without complications"},
    {"code": "K50.911", "desc": "Crohn's disease, unspecified, with rectal bleeding"},
]

ICD10_UC = [
    {"code": "K51.00", "desc": "Ulcerative (chronic) pancolitis without complications"},
    {"code": "K51.011", "desc": "Ulcerative (chronic) pancolitis with rectal bleeding"},
    {"code": "K51.20", "desc": "Ulcerative (chronic) proctitis without complications"},
    {"code": "K51.30", "desc": "Ulcerative (chronic) rectosigmoiditis without complications"},
    {"code": "K51.50", "desc": "Left sided colitis without complications"},
    {"code": "K51.90", "desc": "Ulcerative colitis, unspecified, without complications"},
]

# Biologic medications with clinical details
BIOLOGICS = [
    {
        "name": "Infliximab",
        "brands": ["Remicade", "Inflectra", "Renflexis", "Avsola"],
        "j_codes": {"Remicade": "J1745", "Inflectra": "Q5103", "Renflexis": "Q5104", "Avsola": "Q5121"},
        "mechanism": "TNF-alpha inhibitor",
        "route": "IV infusion",
        "standard_dose": "5mg/kg",
        "for_conditions": ["crohns", "uc"],
        "step_therapy_position": 1,  # First-line biologic
    },
    {
        "name": "Adalimumab",
        "brands": ["Humira", "Hadlima", "Hyrimoz", "Cyltezo"],
        "j_codes": {"Humira": "J0135", "Hadlima": "Q5119", "Hyrimoz": "Q5114", "Cyltezo": "Q5130"},
        "mechanism": "TNF-alpha inhibitor",
        "route": "Subcutaneous",
        "standard_dose": "40mg every 2 weeks",
        "for_conditions": ["crohns", "uc"],
        "step_therapy_position": 1,
    },
    {
        "name": "Vedolizumab",
        "brands": ["Entyvio"],
        "j_codes": {"Entyvio": "J3380"},
        "mechanism": "Integrin inhibitor (gut-selective)",
        "route": "IV infusion",
        "standard_dose": "300mg",
        "for_conditions": ["crohns", "uc"],
        "step_therapy_position": 2,  # Often requires TNF failure
    },
    {
        "name": "Ustekinumab",
        "brands": ["Stelara"],
        "j_codes": {"Stelara": "J3357"},
        "mechanism": "IL-12/23 inhibitor",
        "route": "IV induction, SC maintenance",
        "standard_dose": "weight-based IV, then 90mg SC",
        "for_conditions": ["crohns", "uc"],
        "step_therapy_position": 2,
    },
    {
        "name": "Risankizumab",
        "brands": ["Skyrizi"],
        "j_codes": {"Skyrizi": "J3590"},
        "mechanism": "IL-23 inhibitor",
        "route": "IV induction, SC maintenance",
        "standard_dose": "600mg IV, then 360mg SC",
        "for_conditions": ["crohns"],
        "step_therapy_position": 3,  # Newer agent
    },
]

# Conventional therapies (required before biologics)
CONVENTIONAL_THERAPIES = [
    {"name": "Mesalamine", "class": "5-ASA", "typical_duration_weeks": (8, 24), "for": ["uc"]},
    {"name": "Sulfasalazine", "class": "5-ASA", "typical_duration_weeks": (8, 24), "for": ["uc", "crohns"]},
    {"name": "Budesonide", "class": "Corticosteroid", "typical_duration_weeks": (8, 16), "for": ["crohns", "uc"]},
    {"name": "Prednisone", "class": "Corticosteroid", "typical_duration_weeks": (4, 20), "for": ["crohns", "uc"]},
    {"name": "Azathioprine", "class": "Immunomodulator", "typical_duration_weeks": (12, 52), "for": ["crohns", "uc"]},
    {"name": "6-Mercaptopurine", "class": "Immunomodulator", "typical_duration_weeks": (12, 52), "for": ["crohns", "uc"]},
    {"name": "Methotrexate", "class": "Immunomodulator", "typical_duration_weeks": (12, 52), "for": ["crohns"]},
]

# Treatment outcomes
TREATMENT_OUTCOMES = [
    "inadequate_response",
    "intolerance",
    "adverse_event",
    "partial_response",
    "steroid_dependent",
    "loss_of_response",
]

# Payer configurations with specific requirements
PAYERS = {
    "Cigna": {
        "plan_types": ["PPO", "HMO", "HMO-POS", "EPO"],
        "requirements": {
            "fecal_calprotectin_required": True,  # Since 2024
            "fecal_calprotectin_required_after": "2024-01-01",
            "disease_severity_score_required": True,
            "endoscopy_within_days": 180,
            "step_therapy_required": True,
            "conventional_therapy_minimum_weeks": 12,
            "tb_screening_required": True,
            "hepatitis_screening_required": True,
        },
        "avg_decision_days_complete": 7,
        "avg_decision_days_incomplete": 14,
        "info_request_rate_complete": 0.08,
        "info_request_rate_incomplete": 0.45,
        "denial_rate_missing_severity": 0.35,
        "denial_rate_missing_step_therapy": 0.55,
    },
    "UnitedHealthcare": {
        "plan_types": ["PPO", "HMO", "POS", "HDHP"],
        "requirements": {
            "fecal_calprotectin_required": False,
            "disease_severity_score_required": True,  # CDAI or HBI for Crohn's, Mayo for UC
            "severity_score_strict": True,  # More strict about having scores
            "endoscopy_within_days": 365,
            "step_therapy_required": True,
            "conventional_therapy_minimum_weeks": 8,
            "tb_screening_required": True,
            "hepatitis_screening_required": True,
        },
        "avg_decision_days_complete": 5,
        "avg_decision_days_incomplete": 12,
        "info_request_rate_complete": 0.05,
        "info_request_rate_incomplete": 0.38,
        "denial_rate_missing_severity": 0.42,
        "denial_rate_missing_step_therapy": 0.48,
    },
}

# Documentation types
DOCUMENTATION_TYPES = {
    "essential": [
        "prior_auth_form",
        "prescription",
        "diagnosis_documentation",
    ],
    "clinical_required": [
        "colonoscopy_report",
        "laboratory_results",
        "tb_screening",
        "hepatitis_panel",
    ],
    "severity_evidence": [
        "disease_severity_scores",
        "physician_attestation",
    ],
    "step_therapy_evidence": [
        "prior_treatment_records",
        "medication_history",
    ],
    "high_value": [
        "fecal_calprotectin",
        "therapeutic_drug_monitoring",
        "endoscopy_within_90_days",
        "crp_results",
    ],
}

# Denial reasons
DENIAL_REASONS = [
    "Missing disease severity documentation",
    "Inadequate step therapy documentation",
    "Prior conventional therapy not documented",
    "Missing TB screening results",
    "Missing hepatitis panel",
    "Fecal calprotectin not provided",
    "Endoscopy report not current",
    "Diagnosis does not meet criteria",
    "Dosing not consistent with guidelines",
    "Prior authorization form incomplete",
    "Step therapy requirement not met",
    "Medical necessity not established",
]

# US States distribution (weighted towards populous states)
STATES = ["TX", "CA", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI",
          "NJ", "VA", "WA", "AZ", "MA", "TN", "IN", "MO", "MD", "WI"]

# =============================================================================
# DATA GENERATION FUNCTIONS
# =============================================================================

def generate_date_range(start_date: str, end_date: str) -> datetime:
    """Generate a random date within range."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    delta = end - start
    random_days = random.randint(0, delta.days)
    return start + timedelta(days=random_days)


def get_day_of_week(date: datetime) -> str:
    """Get day of week name."""
    return date.strftime("%A")


def generate_patient_demographics() -> Dict[str, Any]:
    """Generate realistic patient demographics for IBD."""
    # IBD typically diagnosed between 15-35, but can occur at any age
    age_distribution = (
        list(range(18, 35)) * 3 +  # Peak incidence 18-35
        list(range(35, 50)) * 2 +
        list(range(50, 70))
    )
    age = random.choice(age_distribution)

    return {
        "age": age,
        "gender": random.choice(["Male", "Female"]),
        "state": random.choice(STATES),
    }


def generate_diagnosis(condition_type: str) -> Dict[str, Any]:
    """Generate diagnosis based on condition type."""
    if condition_type == "crohns":
        icd = random.choice(ICD10_CROHNS)
        return {
            "primary_icd10": icd["code"],
            "description": icd["desc"],
            "icd10_family": "K50",
            "condition_type": "crohns",
        }
    else:
        icd = random.choice(ICD10_UC)
        return {
            "primary_icd10": icd["code"],
            "description": icd["desc"],
            "icd10_family": "K51",
            "condition_type": "uc",
        }


def generate_disease_severity(condition_type: str, include_calprotectin: bool = True) -> Dict[str, Any]:
    """Generate clinically accurate disease severity scores."""
    severity = {}

    if condition_type == "crohns":
        # CDAI: <150 remission, 150-220 mild, 221-450 moderate, >450 severe
        # For PA, we typically see moderate-to-severe (220+)
        cdai = random.choice([
            random.randint(220, 300),  # Moderate
            random.randint(301, 450),  # Moderate-severe
            random.randint(451, 600),  # Severe
        ])
        severity["cdai_score"] = cdai

        # HBI: <5 remission, 5-7 mild, 8-16 moderate, >16 severe
        hbi = random.randint(8, 20) if random.random() > 0.3 else None
        severity["hbi_score"] = hbi

        # SES-CD (endoscopic): 0-2 remission, 3-6 mild, 7-15 moderate, >15 severe
        ses_cd = random.randint(7, 25) if random.random() > 0.2 else None
        severity["ses_cd_score"] = ses_cd

        severity["mayo_score"] = None
        severity["uceis_score"] = None

    else:  # UC
        # Mayo score: 0-2 remission, 3-5 mild, 6-10 moderate, 11-12 severe
        mayo = random.randint(6, 12)
        severity["mayo_score"] = mayo

        # UCEIS: 0-1 remission, 2-4 mild, 5-6 moderate, 7-8 severe
        uceis = random.randint(5, 8) if random.random() > 0.3 else None
        severity["uceis_score"] = uceis

        severity["cdai_score"] = None
        severity["hbi_score"] = None
        severity["ses_cd_score"] = None

    # Fecal calprotectin (elevated in active IBD, >250 typically significant)
    if include_calprotectin:
        severity["fecal_calprotectin"] = random.randint(250, 1500)
    else:
        severity["fecal_calprotectin"] = None

    # CRP (elevated in inflammation, >5 mg/L is elevated)
    severity["crp"] = round(random.uniform(5, 80), 1)

    # ESR
    severity["esr"] = random.randint(20, 80) if random.random() > 0.3 else None

    # Albumin (may be low in severe disease)
    severity["albumin"] = round(random.uniform(2.5, 4.5), 1)

    # Severity classification
    if condition_type == "crohns":
        if severity["cdai_score"] >= 450:
            severity["severity_classification"] = "severe"
        elif severity["cdai_score"] >= 300:
            severity["severity_classification"] = "moderate_to_severe"
        else:
            severity["severity_classification"] = "moderate"
    else:
        if severity["mayo_score"] >= 10:
            severity["severity_classification"] = "severe"
        elif severity["mayo_score"] >= 6:
            severity["severity_classification"] = "moderate_to_severe"
        else:
            severity["severity_classification"] = "moderate"

    return severity


def generate_prior_treatments(
    condition_type: str,
    include_tdm: bool = False,
    adequate_duration: bool = True
) -> List[Dict[str, Any]]:
    """Generate prior treatment history."""
    treatments = []

    # Filter therapies for condition type
    applicable_therapies = [t for t in CONVENTIONAL_THERAPIES
                           if condition_type in t["for"]]

    # Generate 2-4 prior treatments
    num_treatments = random.randint(2, 4)
    used_meds = set()

    for i in range(num_treatments):
        available = [t for t in applicable_therapies if t["name"] not in used_meds]
        if not available:
            break

        therapy = random.choice(available)
        used_meds.add(therapy["name"])

        # Duration
        min_weeks, max_weeks = therapy["typical_duration_weeks"]
        if adequate_duration:
            duration = random.randint(min_weeks, max_weeks)
        else:
            # Inadequate duration for some cases
            duration = random.randint(2, min_weeks - 1) if random.random() > 0.5 else random.randint(min_weeks, max_weeks)

        treatment = {
            "medication": therapy["name"],
            "medication_class": therapy["class"],
            "duration_weeks": duration,
            "outcome": random.choice(TREATMENT_OUTCOMES),
        }

        # Add TDM for immunomodulators if applicable
        if therapy["class"] == "Immunomodulator" and include_tdm:
            treatment["tdm_documented"] = True
            if therapy["name"] in ["Azathioprine", "6-Mercaptopurine"]:
                treatment["6_tgn_level"] = random.randint(200, 450)
            elif therapy["name"] == "Methotrexate":
                treatment["mtx_polyglutamate"] = random.randint(50, 150)

        treatments.append(treatment)

    return treatments


def generate_medication(condition_type: str, step_therapy_position: int = 1) -> Dict[str, Any]:
    """Generate requested medication details."""
    applicable = [b for b in BIOLOGICS
                 if condition_type in b["for_conditions"]
                 and b["step_therapy_position"] <= step_therapy_position]

    if not applicable:
        applicable = [b for b in BIOLOGICS if condition_type in b["for_conditions"]]

    biologic = random.choice(applicable)
    brand = random.choice(biologic["brands"])

    return {
        "name": biologic["name"],
        "brand": brand,
        "j_code": biologic["j_codes"][brand],
        "mechanism": biologic["mechanism"],
        "route": biologic["route"],
        "dose": biologic["standard_dose"],
        "step_therapy_position": biologic["step_therapy_position"],
    }


def generate_documentation(
    payer_name: str,
    submission_date: datetime,
    include_calprotectin: bool = True,
    include_severity_scores: bool = True,
    include_step_therapy_docs: bool = True,
    include_tdm: bool = False,
    recent_endoscopy: bool = True,
    completeness_level: str = "complete"  # complete, partial, minimal
) -> tuple[List[str], List[str]]:
    """Generate documentation present and missing lists."""
    present = []
    missing = []

    payer = PAYERS[payer_name]

    # Essential docs always present for realistic submissions
    present.extend(DOCUMENTATION_TYPES["essential"])

    # Clinical required
    if completeness_level in ["complete", "partial"]:
        present.extend(DOCUMENTATION_TYPES["clinical_required"])
    else:
        present.extend(["prior_auth_form", "prescription"])
        missing.extend(["colonoscopy_report", "laboratory_results"])

    # Severity evidence
    if include_severity_scores:
        present.extend(DOCUMENTATION_TYPES["severity_evidence"])
    else:
        missing.extend(DOCUMENTATION_TYPES["severity_evidence"])

    # Step therapy evidence
    if include_step_therapy_docs:
        present.extend(DOCUMENTATION_TYPES["step_therapy_evidence"])
    else:
        missing.extend(DOCUMENTATION_TYPES["step_therapy_evidence"])

    # Fecal calprotectin
    fcp_required_date = datetime.strptime(
        payer["requirements"].get("fecal_calprotectin_required_after", "2020-01-01"),
        "%Y-%m-%d"
    )
    if include_calprotectin:
        present.append("fecal_calprotectin")
    elif payer["requirements"].get("fecal_calprotectin_required") and submission_date >= fcp_required_date:
        missing.append("fecal_calprotectin")

    # TDM
    if include_tdm:
        present.append("therapeutic_drug_monitoring")

    # Recent endoscopy
    if recent_endoscopy:
        present.append("endoscopy_within_90_days")
    else:
        if random.random() > 0.5:
            present.append("endoscopy_within_180_days")
        else:
            missing.append("current_endoscopy")

    # CRP results
    if completeness_level == "complete":
        present.append("crp_results")

    return list(set(present)), list(set(missing))


def determine_outcome(
    payer_name: str,
    documentation_present: List[str],
    documentation_missing: List[str],
    has_severity_scores: bool,
    has_step_therapy_docs: bool,
    has_calprotectin: bool,
    prior_treatments_adequate: bool,
    submission_date: datetime,
) -> Dict[str, Any]:
    """Determine case outcome based on documentation and payer requirements."""
    payer = PAYERS[payer_name]

    # Base approval probability
    approval_prob = 0.75
    info_request_prob = 0.15

    # Adjust for documentation completeness
    if not has_severity_scores:
        approval_prob -= 0.30
        if payer["requirements"].get("severity_score_strict"):
            approval_prob -= 0.10

    if not has_step_therapy_docs or not prior_treatments_adequate:
        approval_prob -= 0.25

    # Cigna calprotectin requirement (after 2024)
    if payer_name == "Cigna":
        fcp_required_date = datetime.strptime("2024-01-01", "%Y-%m-%d")
        if submission_date >= fcp_required_date and not has_calprotectin:
            approval_prob -= 0.20
            info_request_prob += 0.25

    # Check for missing essential docs
    essential_missing = any(d in documentation_missing for d in ["tb_screening", "hepatitis_panel"])
    if essential_missing:
        approval_prob -= 0.15
        info_request_prob += 0.20

    # Bonus for comprehensive documentation
    if "therapeutic_drug_monitoring" in documentation_present:
        approval_prob += 0.10
    if "endoscopy_within_90_days" in documentation_present:
        approval_prob += 0.08
    if "crp_results" in documentation_present:
        approval_prob += 0.05

    # Ensure probabilities are valid
    approval_prob = max(0.05, min(0.95, approval_prob))
    info_request_prob = max(0.05, min(0.50, info_request_prob))
    denial_prob = 1 - approval_prob - info_request_prob
    denial_prob = max(0.05, denial_prob)

    # Normalize
    total = approval_prob + info_request_prob + denial_prob
    approval_prob /= total
    info_request_prob /= total
    denial_prob /= total

    # Determine outcome
    rand = random.random()
    if rand < approval_prob:
        outcome = "approved"
        days_to_decision = random.randint(
            payer["avg_decision_days_complete"] - 2,
            payer["avg_decision_days_complete"] + 3
        )
        denial_reason = None
        info_request = None
    elif rand < approval_prob + info_request_prob:
        outcome = "info_request"
        days_to_decision = random.randint(3, 7)
        denial_reason = None
        # Determine what info was requested
        info_request = []
        if not has_severity_scores:
            info_request.append("Disease severity scores required")
        if not has_calprotectin and payer_name == "Cigna":
            info_request.append("Fecal calprotectin test results needed")
        if not has_step_therapy_docs:
            info_request.append("Prior treatment documentation needed")
        if not info_request:
            info_request.append("Additional clinical documentation requested")
    else:
        outcome = "denied"
        days_to_decision = random.randint(
            payer["avg_decision_days_incomplete"],
            payer["avg_decision_days_incomplete"] + 5
        )
        # Determine denial reason
        if not has_severity_scores:
            denial_reason = "Missing disease severity documentation"
        elif not has_step_therapy_docs:
            denial_reason = "Inadequate step therapy documentation"
        elif not prior_treatments_adequate:
            denial_reason = "Step therapy requirement not met"
        else:
            denial_reason = random.choice(DENIAL_REASONS)
        info_request = None

    return {
        "outcome": outcome,
        "days_to_decision": max(1, days_to_decision),
        "denial_reason": denial_reason,
        "info_request_details": info_request,
    }


def generate_appeal(outcome: str, denial_reason: str, days_since_denial: int = None) -> Dict[str, Any]:
    """Generate appeal information for denied cases."""
    if outcome != "denied":
        return {"appeal_filed": False, "appeal_outcome": None, "appeal_details": None}

    # 60% of denials are appealed
    if random.random() > 0.60:
        return {"appeal_filed": False, "appeal_outcome": None, "appeal_details": None}

    days_since_denial = days_since_denial or random.randint(3, 30)

    # Appeal success rate depends on timing and reason
    success_rate = 0.35

    # Appeals within 7 days have higher success
    if days_since_denial <= 7:
        success_rate += 0.12
    elif days_since_denial <= 14:
        success_rate += 0.05

    # Some denial reasons are harder to overturn
    if "medical necessity" in denial_reason.lower():
        success_rate -= 0.10
    if "step therapy" in denial_reason.lower():
        success_rate -= 0.05
    if "documentation" in denial_reason.lower():
        success_rate += 0.15  # Can often be resolved with additional docs

    appeal_outcome = "approved" if random.random() < success_rate else "denied"

    return {
        "appeal_filed": True,
        "appeal_filed_days_after_denial": days_since_denial,
        "appeal_outcome": appeal_outcome,
        "appeal_details": {
            "additional_documentation_submitted": random.random() > 0.3,
            "peer_to_peer_conducted": random.random() > 0.5,
            "days_to_appeal_decision": random.randint(10, 30),
        }
    }


def generate_case(case_id: str, submission_date: datetime) -> Dict[str, Any]:
    """Generate a complete PA case."""
    # Randomly determine case characteristics
    condition_type = random.choice(["crohns", "crohns", "crohns", "uc", "uc"])  # 60% Crohn's
    payer_name = random.choice(list(PAYERS.keys()))

    # Determine documentation completeness (affects outcome)
    completeness_rand = random.random()
    if completeness_rand < 0.45:
        completeness = "complete"
        include_calprotectin = True
        include_severity = True
        include_step_therapy = True
        include_tdm = random.random() > 0.4
        recent_endoscopy = True
        adequate_duration = True
    elif completeness_rand < 0.75:
        completeness = "partial"
        include_calprotectin = random.random() > 0.4
        include_severity = random.random() > 0.3
        include_step_therapy = random.random() > 0.2
        include_tdm = random.random() > 0.7
        recent_endoscopy = random.random() > 0.4
        adequate_duration = random.random() > 0.3
    else:
        completeness = "minimal"
        include_calprotectin = random.random() > 0.7
        include_severity = random.random() > 0.6
        include_step_therapy = random.random() > 0.5
        include_tdm = False
        recent_endoscopy = random.random() > 0.6
        adequate_duration = random.random() > 0.5

    # Generate case components
    demographics = generate_patient_demographics()
    diagnosis = generate_diagnosis(condition_type)
    severity = generate_disease_severity(condition_type, include_calprotectin)
    prior_treatments = generate_prior_treatments(condition_type, include_tdm, adequate_duration)
    medication = generate_medication(condition_type)

    payer = PAYERS[payer_name]
    payer_info = {
        "name": payer_name,
        "plan_type": random.choice(payer["plan_types"]),
    }

    docs_present, docs_missing = generate_documentation(
        payer_name=payer_name,
        submission_date=submission_date,
        include_calprotectin=include_calprotectin,
        include_severity_scores=include_severity,
        include_step_therapy_docs=include_step_therapy,
        include_tdm=include_tdm,
        recent_endoscopy=recent_endoscopy,
        completeness_level=completeness,
    )

    # Determine outcome
    outcome_data = determine_outcome(
        payer_name=payer_name,
        documentation_present=docs_present,
        documentation_missing=docs_missing,
        has_severity_scores=include_severity,
        has_step_therapy_docs=include_step_therapy,
        has_calprotectin=include_calprotectin,
        prior_treatments_adequate=adequate_duration,
        submission_date=submission_date,
    )

    # Generate appeal if denied
    appeal_data = generate_appeal(
        outcome_data["outcome"],
        outcome_data.get("denial_reason", ""),
    )

    # Build case record
    case = {
        "case_id": case_id,
        "patient_demographics": demographics,
        "diagnosis": diagnosis,
        "medication": medication,
        "payer": payer_info,
        "disease_severity": severity,
        "prior_treatments": prior_treatments,
        "documentation_present": docs_present,
        "documentation_missing": docs_missing,
        "submission_date": submission_date.strftime("%Y-%m-%d"),
        "submission_day_of_week": get_day_of_week(submission_date),
        "submission_month": submission_date.month,
        "outcome": outcome_data["outcome"],
        "days_to_decision": outcome_data["days_to_decision"],
        "info_request_details": outcome_data["info_request_details"],
        "denial_reason": outcome_data["denial_reason"],
        **appeal_data,
    }

    # Add notes for context
    notes = []
    if completeness == "complete":
        notes.append("Complete documentation package submitted.")
    if include_tdm:
        notes.append("TDM results included for prior immunomodulator therapy.")
    if outcome_data["outcome"] == "approved" and outcome_data["days_to_decision"] <= 5:
        notes.append("Fast-tracked due to comprehensive documentation.")
    if outcome_data["outcome"] == "denied":
        notes.append(f"Denied: {outcome_data['denial_reason']}")
    if appeal_data.get("appeal_filed") and appeal_data.get("appeal_outcome") == "approved":
        notes.append("Successfully appealed with additional documentation.")

    case["notes"] = " ".join(notes) if notes else None

    return case


def generate_dataset(num_cases: int = 250) -> Dict[str, Any]:
    """Generate the complete dataset."""
    cases = []

    # Generate cases across date range
    start_date = "2023-01-01"
    end_date = "2025-12-31"

    for i in range(num_cases):
        case_id = f"HC-{2023 + i // 100:04d}-{(i % 1000) + 1:04d}"
        submission_date = generate_date_range(start_date, end_date)

        case = generate_case(case_id, submission_date)
        cases.append(case)

    # Sort by submission date
    cases.sort(key=lambda x: x["submission_date"])

    # Renumber case IDs sequentially
    for i, case in enumerate(cases):
        year = case["submission_date"][:4]
        case["case_id"] = f"HC-{year}-{(i % 1000) + 1:04d}"

    # Calculate statistics for metadata
    outcomes = [c["outcome"] for c in cases]
    approval_count = sum(1 for o in outcomes if o == "approved")
    denial_count = sum(1 for o in outcomes if o == "denied")
    info_request_count = sum(1 for o in outcomes if o == "info_request")

    # Payer breakdown
    cigna_cases = [c for c in cases if c["payer"]["name"] == "Cigna"]
    uhc_cases = [c for c in cases if c["payer"]["name"] == "UnitedHealthcare"]

    cigna_approval = sum(1 for c in cigna_cases if c["outcome"] == "approved") / len(cigna_cases) if cigna_cases else 0
    uhc_approval = sum(1 for c in uhc_cases if c["outcome"] == "approved") / len(uhc_cases) if uhc_cases else 0

    # Documentation impact analysis
    cases_with_tdm = [c for c in cases if "therapeutic_drug_monitoring" in c["documentation_present"]]
    cases_without_tdm = [c for c in cases if "therapeutic_drug_monitoring" not in c["documentation_present"]]
    tdm_approval = sum(1 for c in cases_with_tdm if c["outcome"] == "approved") / len(cases_with_tdm) if cases_with_tdm else 0
    no_tdm_approval = sum(1 for c in cases_without_tdm if c["outcome"] == "approved") / len(cases_without_tdm) if cases_without_tdm else 0

    cases_with_fcp = [c for c in cases if "fecal_calprotectin" in c["documentation_present"]]
    cases_without_fcp = [c for c in cases if "fecal_calprotectin" not in c["documentation_present"]]
    fcp_approval = sum(1 for c in cases_with_fcp if c["outcome"] == "approved") / len(cases_with_fcp) if cases_with_fcp else 0
    no_fcp_approval = sum(1 for c in cases_without_fcp if c["outcome"] == "approved") / len(cases_without_fcp) if cases_without_fcp else 0

    # Appeal statistics
    appeals = [c for c in cases if c.get("appeal_filed")]
    appeal_success = sum(1 for c in appeals if c.get("appeal_outcome") == "approved") / len(appeals) if appeals else 0

    metadata = {
        "version": "2.0.0",
        "created_date": datetime.now().strftime("%Y-%m-%d"),
        "description": "Clinically accurate synthetic PA cases for IBD biologics - designed for AI pattern learning",
        "total_cases": len(cases),
        "date_range": {
            "earliest_submission": min(c["submission_date"] for c in cases),
            "latest_submission": max(c["submission_date"] for c in cases),
        },
        "outcome_distribution": {
            "approved": approval_count,
            "denied": denial_count,
            "info_request": info_request_count,
            "approval_rate": round(approval_count / len(cases), 3),
        },
        "payer_breakdown": {
            "Cigna": {
                "total_cases": len(cigna_cases),
                "approval_rate": round(cigna_approval, 3),
            },
            "UnitedHealthcare": {
                "total_cases": len(uhc_cases),
                "approval_rate": round(uhc_approval, 3),
            },
        },
        "embedded_patterns": {
            "documentation_impact": {
                "therapeutic_drug_monitoring": {
                    "with_tdm_approval_rate": round(tdm_approval, 3),
                    "without_tdm_approval_rate": round(no_tdm_approval, 3),
                    "impact": f"+{round((tdm_approval - no_tdm_approval) * 100, 1)}% approval rate with TDM",
                },
                "fecal_calprotectin": {
                    "with_fcp_approval_rate": round(fcp_approval, 3),
                    "without_fcp_approval_rate": round(no_fcp_approval, 3),
                    "impact": f"+{round((fcp_approval - no_fcp_approval) * 100, 1)}% approval rate with fecal calprotectin",
                },
            },
            "payer_specific": {
                "Cigna": [
                    "Requires fecal calprotectin for IBD cases (policy effective 2024-01-01)",
                    "Strict on disease severity documentation",
                    "Average decision time: 7 days for complete submissions",
                ],
                "UnitedHealthcare": [
                    "Requires documented CDAI/HBI for Crohn's, Mayo for UC",
                    "More lenient on fecal calprotectin",
                    "Average decision time: 5 days for complete submissions",
                ],
            },
            "appeal_patterns": {
                "overall_appeal_rate": round(len(appeals) / denial_count, 3) if denial_count else 0,
                "appeal_success_rate": round(appeal_success, 3),
                "insight": "Appeals within 7 days of denial with additional documentation have highest success rate",
            },
        },
        "clinical_accuracy_notes": [
            "ICD-10 codes match official Crohn's (K50.x) and UC (K51.x) classifications",
            "Disease severity scores use validated instruments (CDAI, HBI, Mayo, UCEIS)",
            "Step therapy reflects real-world biologic sequencing requirements",
            "Lab values (CRP, fecal calprotectin, albumin) within clinically expected ranges",
            "Prior treatment durations reflect minimum therapeutic trial requirements",
        ],
    }

    return {
        "metadata": metadata,
        "cases": cases,
    }


def main():
    """Generate and save the dataset."""
    print("Generating realistic PA historical dataset...")

    # Generate 350 cases for robust pattern learning
    dataset = generate_dataset(num_cases=350)

    # Save to file
    output_path = Path(__file__).parent.parent / "data" / "historical_pa_cases.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(dataset, f, indent=2)

    print(f"Dataset saved to: {output_path}")
    print(f"Total cases: {dataset['metadata']['total_cases']}")
    print(f"Approval rate: {dataset['metadata']['outcome_distribution']['approval_rate']:.1%}")
    print(f"Date range: {dataset['metadata']['date_range']['earliest_submission']} to {dataset['metadata']['date_range']['latest_submission']}")

    # Print pattern insights
    print("\nEmbedded Patterns:")
    patterns = dataset['metadata']['embedded_patterns']
    print(f"  TDM impact: {patterns['documentation_impact']['therapeutic_drug_monitoring']['impact']}")
    print(f"  Fecal calprotectin impact: {patterns['documentation_impact']['fecal_calprotectin']['impact']}")
    print(f"  Appeal success rate: {patterns['appeal_patterns']['appeal_success_rate']:.1%}")


if __name__ == "__main__":
    main()
