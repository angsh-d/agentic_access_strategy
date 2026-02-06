"""Tests for policy differ and impact analyzer."""

import json
import copy
from pathlib import Path

import pytest

from backend.models.policy_schema import (
    DigitizedPolicy, AtomicCriterion, CriterionGroup, CriterionType,
    ComparisonOperator, LogicalOperator, ClinicalCode, IndicationCriteria,
    StepTherapyRequirement,
)
from backend.policy_digitalization.differ import (
    PolicyDiffer, ChangeType, PolicyDiffResult,
)
from backend.policy_digitalization.impact_analyzer import PolicyImpactAnalyzer
from backend.policy_digitalization.patient_data_adapter import normalize_patient_data
from backend.policy_digitalization.evaluator import CriterionVerdict


def _make_policy(version="v1", age_threshold=18, extra_criteria=None):
    """Helper to create a test policy."""
    criteria = {
        "AGE_TEST": AtomicCriterion(
            criterion_id="AGE_TEST",
            criterion_type=CriterionType.AGE,
            name="Age Requirement",
            description="Age threshold",
            policy_text=f"Age >= {age_threshold}",
            comparison_operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
            threshold_value=age_threshold,
            threshold_unit="years",
            is_required=True,
            category="demographics",
        ),
        "DIAG_TEST": AtomicCriterion(
            criterion_id="DIAG_TEST",
            criterion_type=CriterionType.DIAGNOSIS_CONFIRMED,
            name="Diagnosis Required",
            description="Confirmed diagnosis",
            policy_text="Confirmed diagnosis",
            clinical_codes=[ClinicalCode(system="ICD-10", code="K50.10", display="Crohn's")],
            is_required=True,
            category="diagnosis",
        ),
    }
    if extra_criteria:
        criteria.update(extra_criteria)

    return DigitizedPolicy(
        policy_id="TEST",
        policy_number="TEST",
        policy_title="Test Policy",
        payer_name="TestPayer",
        medication_name="TestDrug",
        effective_date="2026-01-01",
        version=version,
        atomic_criteria=criteria,
        criterion_groups={
            "GRP_INITIAL": CriterionGroup(
                group_id="GRP_INITIAL",
                name="Initial",
                operator=LogicalOperator.AND,
                criteria=list(criteria.keys()),
            ),
        },
        indications=[
            IndicationCriteria(
                indication_id="IND_TEST",
                indication_name="Test Indication",
                initial_approval_criteria="GRP_INITIAL",
                initial_approval_duration_months=6,
            ),
        ],
    )


class TestPolicyDiffer:
    def test_no_changes(self):
        old = _make_policy("v1")
        new = _make_policy("v2")
        differ = PolicyDiffer()
        result = differ.diff(old, new)
        assert result.summary.modified_count == 0
        assert result.summary.added_count == 0
        assert result.summary.removed_count == 0
        assert result.summary.severity_assessment == "low_impact"

    def test_threshold_tightened(self):
        """Age threshold raised from 18 to 21 = breaking."""
        old = _make_policy("v1", age_threshold=18)
        new = _make_policy("v2", age_threshold=21)
        differ = PolicyDiffer()
        result = differ.diff(old, new)

        age_change = next(c for c in result.criterion_changes if c.criterion_id == "AGE_TEST")
        assert age_change.change_type == ChangeType.MODIFIED
        assert age_change.severity == "breaking"
        assert result.summary.breaking_changes > 0
        assert result.summary.severity_assessment == "high_impact"

    def test_new_required_criterion_added(self):
        """Adding a new required criterion = breaking."""
        old = _make_policy("v1")
        new = _make_policy("v2", extra_criteria={
            "NEW_REQ": AtomicCriterion(
                criterion_id="NEW_REQ",
                criterion_type=CriterionType.LAB_TEST_COMPLETED,
                name="New Lab Requirement",
                description="Must have new lab",
                policy_text="New lab required",
                is_required=True,
                category="lab_results",
            ),
        })
        differ = PolicyDiffer()
        result = differ.diff(old, new)
        assert result.summary.added_count == 1
        added = next(c for c in result.criterion_changes if c.criterion_id == "NEW_REQ")
        assert added.severity == "breaking"

    def test_code_list_expanded(self):
        """Adding a new ICD-10 code = minor."""
        old = _make_policy("v1")
        new = _make_policy("v2")
        # Add extra code to diagnosis criterion
        new.atomic_criteria["DIAG_TEST"].clinical_codes.append(
            ClinicalCode(system="ICD-10", code="K50.00", display="Crohn's small intestine")
        )
        differ = PolicyDiffer()
        result = differ.diff(old, new)
        diag_change = next(c for c in result.criterion_changes if c.criterion_id == "DIAG_TEST")
        assert diag_change.change_type == ChangeType.MODIFIED
        # Code expansion is material
        assert diag_change.severity == "material"

    def test_criterion_removed(self):
        old = _make_policy("v1", extra_criteria={
            "OLD_CRIT": AtomicCriterion(
                criterion_id="OLD_CRIT",
                criterion_type=CriterionType.CUSTOM,
                name="Old Criterion",
                description="Will be removed",
                policy_text="",
                is_required=False,
                category="documentation",
            ),
        })
        new = _make_policy("v2")
        differ = PolicyDiffer()
        result = differ.diff(old, new)
        assert result.summary.removed_count == 1
        removed = next(c for c in result.criterion_changes if c.criterion_id == "OLD_CRIT")
        assert removed.change_type == ChangeType.REMOVED

    def test_empty_diff(self):
        """Identical policies should produce empty diff."""
        policy = _make_policy("v1")
        differ = PolicyDiffer()
        result = differ.diff(policy, policy)
        assert result.summary.added_count == 0
        assert result.summary.removed_count == 0
        assert result.summary.modified_count == 0


class TestPolicyImpactAnalyzer:
    @pytest.mark.asyncio
    async def test_verdict_flip_detected(self):
        """Patient whose age was 20 should flip when threshold raised to 21."""
        old_policy = _make_policy("v1", age_threshold=18)
        new_policy = _make_policy("v2", age_threshold=21)
        differ = PolicyDiffer()
        diff = differ.diff(old_policy, new_policy)

        case = {
            "case_id": "case_001",
            "patient_data": {
                "patient_id": "patient_001",
                "demographics": {"first_name": "John", "last_name": "Doe", "age": 20},
                "diagnoses": [{"icd10_code": "K50.10"}],
            },
        }

        analyzer = PolicyImpactAnalyzer()
        report = await analyzer.analyze_impact(diff, old_policy, new_policy, [case])

        assert report.total_active_cases == 1
        assert report.verdict_flips == 1
        assert report.patient_impacts[0].risk_level == "verdict_flip"

    @pytest.mark.asyncio
    async def test_no_impact_when_still_meets_criteria(self):
        """Patient age 30 should not be affected by threshold 18->21."""
        old_policy = _make_policy("v1", age_threshold=18)
        new_policy = _make_policy("v2", age_threshold=21)
        differ = PolicyDiffer()
        diff = differ.diff(old_policy, new_policy)

        case = {
            "case_id": "case_002",
            "patient_data": {
                "patient_id": "patient_002",
                "demographics": {"first_name": "Jane", "last_name": "Smith", "age": 30},
                "diagnoses": [{"icd10_code": "K50.10"}],
            },
        }

        analyzer = PolicyImpactAnalyzer()
        report = await analyzer.analyze_impact(diff, old_policy, new_policy, [case])
        assert report.verdict_flips == 0
        assert report.patient_impacts[0].risk_level == "no_impact"

    @pytest.mark.asyncio
    async def test_david_c_impact(self):
        """Test impact analysis with real David C patient data."""
        path = Path("data/patients/david_c.json")
        with open(path) as f:
            patient_data = json.load(f)

        # Same policy, no changes
        policy = _make_policy("v1", age_threshold=6)
        differ = PolicyDiffer()
        diff = differ.diff(policy, policy)

        case = {"case_id": "case_dc", "patient_data": patient_data}
        analyzer = PolicyImpactAnalyzer()
        report = await analyzer.analyze_impact(diff, policy, policy, [case])
        assert report.verdict_flips == 0
