"""Tests for the digitalization pipeline components.

Tests reference_validator and pipeline integration without requiring LLM calls.
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from backend.policy_digitalization.extractor import RawExtractionResult, GeminiPolicyExtractor
from backend.policy_digitalization.validator import ValidatedExtractionResult, ClaudePolicyValidator
from backend.policy_digitalization.reference_validator import ReferenceDataValidator


@pytest.fixture
def sample_extracted_data():
    """Minimal extracted policy data for testing."""
    return {
        "policy_id": "TEST_001",
        "policy_number": "TEST_001",
        "policy_title": "Test Policy",
        "payer_name": "TestPayer",
        "medication_name": "TestDrug",
        "medication_brand_names": [],
        "medication_generic_names": ["testdrug"],
        "medication_codes": [
            {"system": "HCPCS", "code": "J1745", "display": "Test drug"}
        ],
        "effective_date": "2026-01-01",
        "atomic_criteria": {
            "AGE_18": {
                "criterion_id": "AGE_18",
                "criterion_type": "age",
                "name": "Age >= 18",
                "description": "Patient must be 18+",
                "policy_text": "Age >= 18 years",
                "clinical_codes": [],
                "comparison_operator": "gte",
                "threshold_value": 18,
                "threshold_unit": "years",
                "is_required": True,
                "category": "demographics",
                "extraction_confidence": "high",
            },
            "DIAG_TEST": {
                "criterion_id": "DIAG_TEST",
                "criterion_type": "diagnosis_confirmed",
                "name": "Confirmed Diagnosis",
                "description": "Test diagnosis",
                "policy_text": "Confirmed diagnosis required",
                "clinical_codes": [
                    {"system": "ICD-10", "code": "K50.10", "display": "Crohn's"}
                ],
                "is_required": True,
                "category": "diagnosis",
                "extraction_confidence": "medium",
            },
        },
        "criterion_groups": {
            "GRP_INITIAL": {
                "group_id": "GRP_INITIAL",
                "name": "Initial Criteria",
                "operator": "AND",
                "criteria": ["AGE_18", "DIAG_TEST"],
                "subgroups": [],
                "negated": False,
            }
        },
        "indications": [
            {
                "indication_id": "IND_TEST",
                "indication_name": "Test Indication",
                "indication_codes": [
                    {"system": "ICD-10", "code": "K50.10", "display": "Crohn's"}
                ],
                "initial_approval_criteria": "GRP_INITIAL",
                "initial_approval_duration_months": 6,
            }
        ],
        "exclusions": [],
        "step_therapy_requirements": [],
        "required_specialties": [],
        "safety_screenings": [],
    }


@pytest.fixture
def raw_extraction_result(sample_extracted_data):
    return RawExtractionResult(
        extracted_data=sample_extracted_data,
        source_hash="abc123",
        source_type="text",
        extraction_model="gemini",
        extraction_timestamp="2026-01-01T00:00:00",
    )


class TestReferenceValidator:
    @pytest.mark.asyncio
    async def test_validate_codes_builds_policy(self, raw_extraction_result):
        """Reference validator should build a valid DigitizedPolicy."""
        validated = ValidatedExtractionResult(
            extracted_data=raw_extraction_result.extracted_data,
            validation_status="valid",
            quality_score=0.9,
        )
        validator = ReferenceDataValidator()
        policy = await validator.validate_codes(validated)

        assert policy.policy_id == "TEST_001"
        assert len(policy.atomic_criteria) == 2
        assert "AGE_18" in policy.atomic_criteria
        assert "DIAG_TEST" in policy.atomic_criteria
        assert len(policy.indications) == 1
        assert len(policy.provenances) == 2

    @pytest.mark.asyncio
    async def test_code_format_validation(self, raw_extraction_result):
        """ICD-10 codes should be format-validated."""
        validated = ValidatedExtractionResult(
            extracted_data=raw_extraction_result.extracted_data,
            validation_status="valid",
            quality_score=0.9,
        )
        validator = ReferenceDataValidator()
        policy = await validator.validate_codes(validated)

        # DIAG_TEST has ICD-10 K50.10 — should be valid format
        diag = policy.atomic_criteria["DIAG_TEST"]
        assert diag.codes_validated is True

    @pytest.mark.asyncio
    async def test_provenance_populated(self, raw_extraction_result):
        validated = ValidatedExtractionResult(
            extracted_data=raw_extraction_result.extracted_data,
            validation_status="valid",
            quality_score=0.85,
        )
        validator = ReferenceDataValidator()
        policy = await validator.validate_codes(validated)

        assert "AGE_18" in policy.provenances
        assert policy.provenances["AGE_18"].extraction_confidence.value == "high"
        assert policy.provenances["DIAG_TEST"].extraction_confidence.value == "medium"

    @pytest.mark.asyncio
    async def test_quality_assessment(self, raw_extraction_result):
        """Quality assessment based on quality_score."""
        # Good quality
        validated = ValidatedExtractionResult(
            extracted_data=raw_extraction_result.extracted_data,
            validation_status="valid",
            quality_score=0.9,
        )
        validator = ReferenceDataValidator()
        policy = await validator.validate_codes(validated)
        assert policy.extraction_quality == "good"

        # Needs review
        validated.quality_score = 0.6
        policy = await validator.validate_codes(validated)
        assert policy.extraction_quality == "needs_review"

        # Poor
        validated.quality_score = 0.3
        policy = await validator.validate_codes(validated)
        assert policy.extraction_quality == "poor"


class TestCodeFormatValidation:
    def test_icd10_valid(self):
        validator = ReferenceDataValidator()
        assert validator._validate_code_format("ICD-10", "K50.10") is True
        assert validator._validate_code_format("ICD-10-CM", "M05.79") is True
        assert validator._validate_code_format("ICD-10", "K50") is True

    def test_icd10_invalid(self):
        validator = ReferenceDataValidator()
        assert validator._validate_code_format("ICD-10", "50.10") is False
        assert validator._validate_code_format("ICD-10", "") is False

    def test_hcpcs_valid(self):
        validator = ReferenceDataValidator()
        assert validator._validate_code_format("HCPCS", "J1745") is True
        assert validator._validate_code_format("HCPCS", "Q5103") is True

    def test_cpt_valid(self):
        validator = ReferenceDataValidator()
        assert validator._validate_code_format("CPT", "86480") is True

    def test_loinc_valid(self):
        validator = ReferenceDataValidator()
        assert validator._validate_code_format("LOINC", "71774-4") is True

    def test_unknown_system(self):
        validator = ReferenceDataValidator()
        # Unknown systems accept any non-empty string
        assert validator._validate_code_format("SNOMED", "123456") is True
        assert validator._validate_code_format("RxNorm", "12345") is True


class TestValidatorCorrections:
    @pytest.mark.asyncio
    async def test_apply_corrections(self):
        """Validator should apply field-level corrections."""
        validator = ClaudePolicyValidator()
        extracted = {
            "atomic_criteria": {
                "AGE_TEST": {
                    "criterion_id": "AGE_TEST",
                    "threshold_value": 18,
                }
            }
        }
        validation_data = {
            "corrections": [
                {
                    "criterion_id": "AGE_TEST",
                    "field": "threshold_value",
                    "corrected_value": 6,
                }
            ],
            "completeness": {"missing_criteria": []},
            "confidence_overrides": [],
        }
        result = validator._apply_corrections(extracted, validation_data)
        assert result["atomic_criteria"]["AGE_TEST"]["threshold_value"] == 6

    @pytest.mark.asyncio
    async def test_add_missing_criteria(self):
        """Validator should add missing criteria."""
        validator = ClaudePolicyValidator()
        extracted = {"atomic_criteria": {}}
        validation_data = {
            "corrections": [],
            "completeness": {
                "missing_criteria": [
                    {
                        "criterion_id": "NEW_CRIT",
                        "name": "New Criterion",
                    }
                ]
            },
            "confidence_overrides": [],
        }
        result = validator._apply_corrections(extracted, validation_data)
        assert "NEW_CRIT" in result["atomic_criteria"]


class TestCignaDigitizedPolicyLoading:
    """Test that the real Cigna policy loads correctly."""

    def test_load_cigna_digitized(self):
        """Verify existing digitized JSON loads as DigitizedPolicy."""
        from backend.models.policy_schema import DigitizedPolicy

        path = Path("data/policies/cigna_infliximab_digitized.json")
        with open(path) as f:
            data = json.load(f)
        policy = DigitizedPolicy(**data)

        assert policy.policy_id == "IP0660"
        assert len(policy.atomic_criteria) > 20
        assert len(policy.indications) > 5
        assert len(policy.step_therapy_requirements) > 0
