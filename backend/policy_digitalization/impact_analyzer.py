"""Policy Impact Analyzer — assesses which active cases are affected by policy changes."""

from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field

from backend.models.policy_schema import DigitizedPolicy
from backend.policy_digitalization.evaluator import (
    CriterionVerdict, evaluate_policy, PolicyEvaluationResult,
)
from backend.policy_digitalization.patient_data_adapter import normalize_patient_data, NormalizedPatientData
from backend.policy_digitalization.differ import PolicyDiffResult
from backend.config.logging_config import get_logger

logger = get_logger(__name__)


class PatientImpact(BaseModel):
    patient_id: str
    case_id: Optional[str] = None
    patient_name: str = ""
    current_verdict: CriterionVerdict = CriterionVerdict.INSUFFICIENT_DATA
    projected_verdict: CriterionVerdict = CriterionVerdict.INSUFFICIENT_DATA
    verdict_changed: bool = False
    affected_criteria: List[str] = Field(default_factory=list)
    risk_level: str = "no_impact"  # verdict_flip, at_risk, no_impact
    recommended_action: str = "no action needed"


class PolicyImpactReport(BaseModel):
    diff: PolicyDiffResult
    total_active_cases: int = 0
    impacted_cases: int = 0
    verdict_flips: int = 0
    at_risk_cases: int = 0
    patient_impacts: List[PatientImpact] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)


class PolicyImpactAnalyzer:
    """Analyzes impact of policy changes on active cases."""

    async def analyze_impact(
        self,
        diff: PolicyDiffResult,
        old_policy: DigitizedPolicy,
        new_policy: DigitizedPolicy,
        active_cases: List[Dict[str, Any]],
    ) -> PolicyImpactReport:
        """
        Analyze impact of policy changes on active cases.

        For each case, re-runs deterministic evaluator against both old and new
        policy versions and compares verdicts.
        """
        logger.info("Analyzing policy impact", cases_count=len(active_cases))

        patient_impacts = []
        verdict_flips = 0
        at_risk = 0
        evaluated_count = 0

        for case in active_cases:
            patient_data = case.get("patient") or case.get("patient_data") or {}
            case_id = case.get("case_id")
            patient_id = patient_data.get("patient_id", case_id or "unknown")
            patient_name = self._get_patient_name(patient_data)

            if not patient_data:
                logger.debug("Skipping case with empty patient_data", case_id=case_id)
                continue

            evaluated_count += 1

            # Normalize patient data
            normalized = normalize_patient_data(patient_data)

            # Evaluate against both versions
            old_result = evaluate_policy(old_policy, normalized)
            new_result = evaluate_policy(new_policy, normalized)

            # Compare verdicts
            old_verdict = old_result.overall_verdict
            new_verdict = new_result.overall_verdict

            verdict_changed = old_verdict != new_verdict
            affected_criteria = self._find_affected_criteria(old_result, new_result, diff)

            # Classify risk
            if verdict_changed and old_verdict == CriterionVerdict.MET and new_verdict != CriterionVerdict.MET:
                risk_level = "verdict_flip"
                recommended_action = "re-evaluate case immediately; prepare preemptive appeal"
                verdict_flips += 1
            elif verdict_changed and new_verdict == CriterionVerdict.NOT_MET and old_verdict == CriterionVerdict.INSUFFICIENT_DATA:
                risk_level = "at_risk"
                recommended_action = "case deteriorated from insufficient data to not met; review changed criteria"
                at_risk += 1
            elif affected_criteria and new_verdict == CriterionVerdict.INSUFFICIENT_DATA:
                risk_level = "at_risk"
                recommended_action = "gather additional documentation for changed criteria"
                at_risk += 1
            else:
                risk_level = "no_impact"
                recommended_action = "no action needed"

            patient_impacts.append(PatientImpact(
                patient_id=patient_id,
                case_id=case_id,
                patient_name=patient_name,
                current_verdict=old_verdict,
                projected_verdict=new_verdict,
                verdict_changed=verdict_changed,
                affected_criteria=affected_criteria,
                risk_level=risk_level,
                recommended_action=recommended_action,
            ))

        impacted = sum(1 for p in patient_impacts if p.risk_level != "no_impact")

        # Build action items
        action_items = []
        if verdict_flips > 0:
            action_items.append(f"URGENT: {verdict_flips} case(s) may flip from APPROVED to NOT MET under new policy")
        if at_risk > 0:
            action_items.append(f"WARNING: {at_risk} case(s) at risk — gather additional documentation")
        if diff.summary.breaking_changes > 0:
            action_items.append(f"Review {diff.summary.breaking_changes} breaking change(s) in policy")

        report = PolicyImpactReport(
            diff=diff,
            total_active_cases=evaluated_count,
            impacted_cases=impacted,
            verdict_flips=verdict_flips,
            at_risk_cases=at_risk,
            patient_impacts=patient_impacts,
            action_items=action_items,
        )

        logger.info(
            "Impact analysis complete",
            total=len(active_cases),
            impacted=impacted,
            verdict_flips=verdict_flips,
            at_risk=at_risk,
        )

        return report

    def _get_patient_name(self, patient_data: Dict) -> str:
        """Extract patient name from data."""
        demographics = patient_data.get("demographics", {})
        first = demographics.get("first_name", "")
        last = demographics.get("last_name", "")
        return f"{first} {last}".strip() or "Unknown"

    def _find_affected_criteria(
        self,
        old_result: PolicyEvaluationResult,
        new_result: PolicyEvaluationResult,
        diff: PolicyDiffResult,
    ) -> List[str]:
        """Find criteria that changed verdict between old and new evaluation."""
        # Check all change types, not just criterion_changes
        all_changes = diff.criterion_changes + diff.step_therapy_changes + diff.exclusion_changes
        changed_criterion_ids = {
            c.criterion_id for c in all_changes
            if c.change_type.value != "unchanged"
        }

        affected = []
        # Build maps of criterion_id -> verdict for both evaluations (including subgroups)
        old_verdicts = self._collect_all_verdicts(old_result)
        new_verdicts = self._collect_all_verdicts(new_result)

        for cid in changed_criterion_ids:
            old_v = old_verdicts.get(cid)
            new_v = new_verdicts.get(cid)
            if old_v != new_v:
                affected.append(cid)

        return affected

    @staticmethod
    def _collect_all_verdicts(result: PolicyEvaluationResult) -> Dict[str, CriterionVerdict]:
        """Collect criterion_id -> verdict from all evaluations, including nested subgroups."""
        verdicts: Dict[str, CriterionVerdict] = {}

        def _collect_from_group(group):
            for cr in group.criteria_results:
                verdicts[cr.criterion_id] = cr.verdict
            for sg in group.subgroup_results:
                _collect_from_group(sg)

        for ie in result.indication_evaluations:
            if ie.approval_criteria_result:
                _collect_from_group(ie.approval_criteria_result)
        # Also collect from exclusion evaluations
        for ee in result.exclusion_evaluations:
            verdicts[ee.criterion_id] = ee.verdict
        return verdicts
