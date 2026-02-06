"""Tests for deterministic criteria evaluator against real data."""

import json
from pathlib import Path

import pytest

from backend.models.policy_schema import (
    DigitizedPolicy, AtomicCriterion, CriterionGroup, CriterionType,
    ComparisonOperator, LogicalOperator, ClinicalCode,
)
from backend.policy_digitalization.evaluator import (
    CriterionVerdict,
    evaluate_criterion,
    evaluate_group,
    evaluate_policy,
    evaluate_step_therapy,
    PolicyEvaluationResult,
)
from backend.policy_digitalization.patient_data_adapter import (
    normalize_patient_data,
    NormalizedPatientData,
    NormalizedTreatment,
    NormalizedScreening,
    NormalizedLabResult,
)


@pytest.fixture
def david_c_normalized():
    """Normalized David Chen patient data."""
    path = Path("data/patients/david_c.json")
    with open(path) as f:
        raw = json.load(f)
    return normalize_patient_data(raw)


@pytest.fixture
def cigna_policy():
    """Load real Cigna Infliximab digitized policy."""
    path = Path("data/policies/cigna_infliximab_digitized.json")
    with open(path) as f:
        data = json.load(f)
    return DigitizedPolicy(**data)


# --- Individual criterion tests ---

class TestAgeCriterion:
    def test_age_met(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="AGE_TEST",
            criterion_type=CriterionType.AGE,
            name="Age >= 18",
            description="Patient must be 18+",
            policy_text="Age >= 18",
            comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
            threshold_value=18,
            threshold_unit="years",
            category="age",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_age_not_met(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="AGE_TEST",
            criterion_type=CriterionType.AGE,
            name="Age >= 65",
            description="Patient must be 65+",
            policy_text="Age >= 65",
            comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
            threshold_value=65,
            threshold_unit="years",
            category="age",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.NOT_MET

    def test_age_missing(self):
        patient = NormalizedPatientData()
        criterion = AtomicCriterion(
            criterion_id="AGE_TEST",
            criterion_type=CriterionType.AGE,
            name="Age >= 18",
            description="Patient must be 18+",
            policy_text="Age >= 18",
            comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
            threshold_value=18,
            category="age",
        )
        result = evaluate_criterion(criterion, patient)
        assert result.verdict == CriterionVerdict.INSUFFICIENT_DATA


class TestDiagnosisCriterion:
    def test_diagnosis_confirmed(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="DIAG_CD",
            criterion_type=CriterionType.DIAGNOSIS_CONFIRMED,
            name="Diagnosis of Crohn's Disease",
            description="Patient has Crohn's Disease",
            policy_text="Crohn's Disease",
            clinical_codes=[
                ClinicalCode(system="ICD-10", code="K50", display="Crohn's disease"),
                ClinicalCode(system="ICD-10", code="K50.1", display="Crohn's of large intestine"),
            ],
            category="diagnosis",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_diagnosis_not_matched(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="DIAG_RA",
            criterion_type=CriterionType.DIAGNOSIS_CONFIRMED,
            name="Diagnosis of Rheumatoid Arthritis",
            description="Patient has RA",
            policy_text="RA",
            clinical_codes=[
                ClinicalCode(system="ICD-10", code="M05", display="RA"),
            ],
            category="diagnosis",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.NOT_MET


class TestPriorTreatmentCriterion:
    def test_treatment_tried_by_drug_class(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="STEP_STEROIDS",
            criterion_type=CriterionType.PRIOR_TREATMENT_TRIED,
            name="Trial of Corticosteroids",
            description="Patient has tried corticosteroids",
            policy_text="corticosteroids tried",
            drug_classes=["corticosteroid"],
            category="step_therapy",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_treatment_tried_by_drug_name(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="STEP_AZA",
            criterion_type=CriterionType.PRIOR_TREATMENT_TRIED,
            name="Trial of Azathioprine",
            description="Patient has tried azathioprine",
            policy_text="azathioprine tried",
            drug_names=["azathioprine"],
            category="step_therapy",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_treatment_not_tried(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="STEP_MTX",
            criterion_type=CriterionType.PRIOR_TREATMENT_TRIED,
            name="Trial of Methotrexate",
            description="Patient has tried methotrexate",
            policy_text="methotrexate tried",
            drug_names=["methotrexate"],
            category="step_therapy",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.NOT_MET

    def test_treatment_failed(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="STEP_AZA_FAIL",
            criterion_type=CriterionType.PRIOR_TREATMENT_FAILED,
            name="Azathioprine Failed",
            description="Patient failed azathioprine",
            policy_text="azathioprine failed",
            drug_names=["azathioprine"],
            category="step_therapy",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET


class TestSafetyScreeningCriterion:
    def test_tb_screening_negative(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="SAFETY_TB",
            criterion_type=CriterionType.SAFETY_SCREENING_NEGATIVE,
            name="TB Screening Negative",
            description="Tuberculosis screening with negative result",
            policy_text="TB screening negative",
            category="safety_screening",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_hepatitis_b_screening_completed(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="SAFETY_HEP_B",
            criterion_type=CriterionType.SAFETY_SCREENING_COMPLETED,
            name="Hepatitis B Screening Completed",
            description="Hepatitis B screening completed",
            policy_text="Hepatitis B screening",
            category="safety_screening",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET


class TestPrescriberCriterion:
    def test_prescriber_gi(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="PRESCRIBER_GI",
            criterion_type=CriterionType.PRESCRIBER_SPECIALTY,
            name="Prescribed by Gastroenterologist",
            description="Prescribed by or in consultation with a gastroenterologist",
            policy_text="prescribed by gastroenterologist",
            category="prescriber",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_prescriber_rheum_not_matched(self, david_c_normalized):
        criterion = AtomicCriterion(
            criterion_id="PRESCRIBER_RHEUM",
            criterion_type=CriterionType.PRESCRIBER_SPECIALTY,
            name="Prescribed by Rheumatologist",
            description="Prescribed by or in consultation with a rheumatologist",
            policy_text="prescribed by rheumatologist",
            category="prescriber",
        )
        result = evaluate_criterion(criterion, david_c_normalized)
        assert result.verdict == CriterionVerdict.NOT_MET


# --- Group evaluation tests ---

class TestGroupEvaluation:
    def test_and_group_all_met(self, david_c_normalized):
        policy = DigitizedPolicy(
            policy_id="TEST",
            policy_number="TEST",
            policy_title="Test",
            payer_name="Test",
            medication_name="Test",
            effective_date="2026-01-01",
            atomic_criteria={
                "C1": AtomicCriterion(
                    criterion_id="C1", criterion_type=CriterionType.AGE,
                    name="Age >= 6", description="", policy_text="",
                    comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    threshold_value=6, category="age",
                ),
                "C2": AtomicCriterion(
                    criterion_id="C2", criterion_type=CriterionType.DIAGNOSIS_CONFIRMED,
                    name="Crohn's", description="Crohn's Disease", policy_text="",
                    clinical_codes=[ClinicalCode(system="ICD-10", code="K50")],
                    category="diagnosis",
                ),
            },
            criterion_groups={
                "GRP1": CriterionGroup(
                    group_id="GRP1", name="Test AND", operator=LogicalOperator.AND,
                    criteria=["C1", "C2"],
                ),
            },
        )
        group = policy.get_group("GRP1")
        result = evaluate_group(group, policy, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_and_group_one_not_met(self, david_c_normalized):
        policy = DigitizedPolicy(
            policy_id="TEST",
            policy_number="TEST",
            policy_title="Test",
            payer_name="Test",
            medication_name="Test",
            effective_date="2026-01-01",
            atomic_criteria={
                "C1": AtomicCriterion(
                    criterion_id="C1", criterion_type=CriterionType.AGE,
                    name="Age >= 65", description="", policy_text="",
                    comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    threshold_value=65, category="age",
                ),
                "C2": AtomicCriterion(
                    criterion_id="C2", criterion_type=CriterionType.DIAGNOSIS_CONFIRMED,
                    name="Crohn's", description="Crohn's Disease", policy_text="",
                    clinical_codes=[ClinicalCode(system="ICD-10", code="K50")],
                    category="diagnosis",
                ),
            },
            criterion_groups={
                "GRP1": CriterionGroup(
                    group_id="GRP1", name="Test AND", operator=LogicalOperator.AND,
                    criteria=["C1", "C2"],
                ),
            },
        )
        group = policy.get_group("GRP1")
        result = evaluate_group(group, policy, david_c_normalized)
        assert result.verdict == CriterionVerdict.NOT_MET

    def test_or_group_one_met(self, david_c_normalized):
        policy = DigitizedPolicy(
            policy_id="TEST",
            policy_number="TEST",
            policy_title="Test",
            payer_name="Test",
            medication_name="Test",
            effective_date="2026-01-01",
            atomic_criteria={
                "C1": AtomicCriterion(
                    criterion_id="C1", criterion_type=CriterionType.AGE,
                    name="Age >= 65", description="", policy_text="",
                    comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    threshold_value=65, category="age",
                ),
                "C2": AtomicCriterion(
                    criterion_id="C2", criterion_type=CriterionType.DIAGNOSIS_CONFIRMED,
                    name="Crohn's", description="Crohn's Disease", policy_text="",
                    clinical_codes=[ClinicalCode(system="ICD-10", code="K50")],
                    category="diagnosis",
                ),
            },
            criterion_groups={
                "GRP1": CriterionGroup(
                    group_id="GRP1", name="Test OR", operator=LogicalOperator.OR,
                    criteria=["C1", "C2"],
                ),
            },
        )
        group = policy.get_group("GRP1")
        result = evaluate_group(group, policy, david_c_normalized)
        assert result.verdict == CriterionVerdict.MET

    def test_not_group(self, david_c_normalized):
        policy = DigitizedPolicy(
            policy_id="TEST",
            policy_number="TEST",
            policy_title="Test",
            payer_name="Test",
            medication_name="Test",
            effective_date="2026-01-01",
            atomic_criteria={
                "C1": AtomicCriterion(
                    criterion_id="C1", criterion_type=CriterionType.AGE,
                    name="Age >= 65", description="", policy_text="",
                    comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    threshold_value=65, category="age",
                ),
            },
            criterion_groups={
                "GRP1": CriterionGroup(
                    group_id="GRP1", name="NOT old", operator=LogicalOperator.NOT,
                    criteria=["C1"],
                ),
            },
        )
        group = policy.get_group("GRP1")
        result = evaluate_group(group, policy, david_c_normalized)
        # NOT(NOT_MET) = MET
        assert result.verdict == CriterionVerdict.MET


# --- Full policy evaluation test ---

class TestFullPolicyEvaluation:
    def test_evaluate_cigna_david_c(self, cigna_policy, david_c_normalized):
        """Evaluate David Chen against real Cigna Infliximab policy."""
        result = evaluate_policy(cigna_policy, david_c_normalized)

        assert isinstance(result, PolicyEvaluationResult)
        assert result.policy_id == "IP0660"
        assert result.patient_id == "david_c"
        assert len(result.indication_evaluations) > 0

        # Find Crohn's Disease evaluation
        cd_eval = next(
            (ie for ie in result.indication_evaluations if "crohn" in ie.indication_name.lower()),
            None
        )
        assert cd_eval is not None
        assert cd_eval.criteria_met_count > 0
        assert cd_eval.criteria_total_count > 0

        # David C should have most Crohn's criteria met
        # AGE_GE_6: met (age 39+), DIAG_CD: met (K50.10), PRESCRIBER_GI: met
        # Step therapy: at least one met (STEP_CD_STEROIDS or STEP_CD_CONVENTIONAL)
        # Safety: TB screening negative met, Hep B screening met
        assert cd_eval.criteria_met_count >= 4

        # Overall readiness considers ALL indications (18 total), so it'll be < 1.0
        # since David only matches Crohn's. Should be > 0.3 (at least Crohn's criteria met)
        assert result.overall_readiness > 0.3

    def test_step_therapy_evaluation(self, cigna_policy, david_c_normalized):
        """Verify step therapy evaluation."""
        result = evaluate_step_therapy(cigna_policy, david_c_normalized)
        assert result["required"] is True
        assert isinstance(result["details"], list)

    def test_overall_readiness_range(self, cigna_policy, david_c_normalized):
        result = evaluate_policy(cigna_policy, david_c_normalized)
        assert 0.0 <= result.overall_readiness <= 1.0

    def test_gaps_populated(self, cigna_policy, david_c_normalized):
        result = evaluate_policy(cigna_policy, david_c_normalized)
        # Some gaps expected (e.g., criteria for non-Crohn indications won't be met)
        assert isinstance(result.gaps, list)
