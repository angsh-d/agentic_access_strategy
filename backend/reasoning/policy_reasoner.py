"""Policy Reasoner - Analyzes payer policies using LLM."""
import json
from typing import Dict, Any, Optional
from pathlib import Path
from uuid import uuid4

from backend.models.coverage import CoverageAssessment, CriterionAssessment, DocumentationGap
from backend.models.enums import CoverageStatus
from backend.reasoning.prompt_loader import get_prompt_loader
from backend.reasoning.llm_gateway import get_llm_gateway
from backend.reasoning.rubric_loader import get_rubric_loader
from backend.policy_digitalization.exceptions import PolicyNotFoundError
from backend.config.logging_config import get_logger

logger = get_logger(__name__)


class PolicyReasoner:
    """
    Analyzes payer policies to assess coverage eligibility.
    Uses LLM for policy reasoning - Claude for clinical accuracy.
    """

    def __init__(self, policies_dir: Optional[Path] = None):
        """
        Initialize the Policy Reasoner.

        Args:
            policies_dir: Directory containing policy documents
        """
        self.policies_dir = policies_dir or Path("data/policies")
        self.prompt_loader = get_prompt_loader()
        self.llm_gateway = get_llm_gateway()
        self.rubric_loader = get_rubric_loader()
        logger.info(
            "Policy Reasoner initialized",
            policies_dir=str(self.policies_dir)
        )

    def load_policy(self, payer_name: str, medication_name: str) -> str:
        """
        Load a policy document for a payer/medication combination.

        Args:
            payer_name: Name of the payer (e.g., "cigna", "uhc")
            medication_name: Name of the medication

        Returns:
            Policy document text
        """
        # Normalize names for file lookup
        payer_key = payer_name.lower().replace(" ", "_")
        med_key = medication_name.lower().replace(" ", "_")

        # Try specific policy first
        policy_path = (self.policies_dir / f"{payer_key}_{med_key}.txt").resolve()
        policies_root = self.policies_dir.resolve()
        try:
            policy_path.relative_to(policies_root)
        except ValueError:
            raise ValueError(f"Invalid policy path: {payer_name}/{medication_name}")
        if not policy_path.exists():
            # Try generic payer policy
            policy_path = (self.policies_dir / f"{payer_key}.txt").resolve()
            try:
                policy_path.relative_to(policies_root)
            except ValueError:
                raise ValueError(f"Invalid policy path: {payer_name}/{medication_name}")

        if not policy_path.exists():
            logger.error("Policy file not found", path=str(policy_path), payer=payer_name, medication=medication_name)
            raise FileNotFoundError(
                f"Policy not found for {payer_name}/{medication_name}"
            )

        with open(policy_path, "r", encoding="utf-8") as f:
            return f.read()

    async def assess_coverage(
        self,
        patient_info: Dict[str, Any],
        medication_info: Dict[str, Any],
        payer_name: str
    ) -> CoverageAssessment:
        """
        Assess coverage eligibility for a patient/medication/payer combination.

        Enhanced: Runs deterministic evaluator first, then passes structured
        evaluation results to Claude for clinical validation and nuance.

        Args:
            patient_info: Patient demographic and clinical data
            medication_info: Medication request details
            payer_name: Name of the payer

        Returns:
            Complete coverage assessment
        """
        logger.info(
            "Assessing coverage",
            payer=payer_name,
            medication=medication_info.get("medication_name")
        )

        # Load policy document
        policy_text = self.load_policy(
            payer_name=payer_name,
            medication_name=medication_info.get("medication_name", "unknown")
        )

        # Run deterministic evaluator if digitized policy is available
        deterministic_evaluation = ""
        eval_step_therapy = None
        try:
            deterministic_evaluation, eval_step_therapy = await self._run_deterministic_evaluation(
                patient_info, payer_name, medication_info.get("medication_name", "unknown")
            )
        except (FileNotFoundError, PolicyNotFoundError):
            logger.info("No digitized policy available, proceeding with LLM-only", payer=payer_name)
        except Exception as e:
            logger.error(
                "Deterministic evaluation failed unexpectedly, proceeding with LLM-only",
                error=str(e), error_type=type(e).__name__, payer=payer_name,
            )

        # Load decision rubric for this payer
        rubric = self.rubric_loader.load(payer_name=payer_name)
        rubric_context = rubric.to_prompt_context()

        # Build prompt with rubric context and deterministic evaluation
        prompt = self.prompt_loader.load(
            "policy_analysis/coverage_assessment.txt",
            {
                "patient_info": patient_info,
                "medication_info": medication_info,
                "policy_document": policy_text,
                "decision_rubric": rubric_context,
                "deterministic_evaluation": deterministic_evaluation,
            }
        )

        # Get system prompt
        system_prompt = self.prompt_loader.load("system/clinical_reasoning_base.txt")

        # Analyze with LLM
        result = await self.llm_gateway.analyze_policy(
            prompt=prompt,
            system_prompt=system_prompt
        )

        # Parse response into CoverageAssessment, using real criterion IDs from evaluator
        assessment = self._parse_assessment(
            result=result,
            payer_name=payer_name,
            policy_text=policy_text,
            medication_name=medication_info.get("medication_name", "unknown")
        )

        # Inject evaluator step therapy data for strategy scorer consumption
        # Copy to avoid mutating the original LLM response dict
        if eval_step_therapy and assessment.llm_raw_response is not None:
            import copy
            assessment.llm_raw_response = copy.deepcopy(assessment.llm_raw_response)
            assessment.llm_raw_response["_evaluator_step_therapy"] = eval_step_therapy

        logger.info(
            "Coverage assessment complete",
            payer=payer_name,
            status=assessment.coverage_status.value,
            likelihood=assessment.approval_likelihood
        )

        return assessment

    async def _run_deterministic_evaluation(
        self, patient_info: Dict[str, Any], payer_name: str, medication_name: str
    ) -> tuple:
        """Run deterministic evaluator and format results for the LLM prompt.

        Returns:
            Tuple of (formatted_text, step_therapy_dict) — step_therapy_dict
            is passed to CoverageAssessment.llm_raw_response for strategy scorer.
        """
        from backend.policy_digitalization.pipeline import get_digitalization_pipeline
        from backend.policy_digitalization.patient_data_adapter import normalize_patient_data
        from backend.policy_digitalization.evaluator import evaluate_policy

        pipeline = get_digitalization_pipeline()
        policy = await pipeline.get_or_digitalize(payer_name, medication_name)
        patient = normalize_patient_data(patient_info)
        eval_result = evaluate_policy(policy, patient)

        step_therapy_data = eval_result.step_therapy_evaluation

        # Format for prompt
        lines = ["## Deterministic Criteria Evaluation (Programmatic — use as starting point)"]
        lines.append(f"Overall Readiness: {eval_result.overall_readiness:.1%}")
        lines.append(f"Overall Verdict: {eval_result.overall_verdict.value}")

        for ie in eval_result.indication_evaluations:
            lines.append(f"\n### {ie.indication_name}: {ie.overall_verdict.value}")
            lines.append(f"  Criteria met: {ie.criteria_met_count}/{ie.criteria_total_count}")
            for uc in ie.unmet_criteria:
                lines.append(f"  - NOT MET: {uc.criterion_id} ({uc.criterion_name}): {uc.reasoning}")
            for ic in ie.insufficient_criteria:
                lines.append(f"  - INSUFFICIENT DATA: {ic.criterion_id} ({ic.criterion_name}): {ic.reasoning}")

        if eval_result.step_therapy_evaluation:
            st = eval_result.step_therapy_evaluation
            lines.append(f"\n### Step Therapy: {'Satisfied' if st.get('satisfied') else 'Not Satisfied'}")

        return "\n".join(lines), step_therapy_data

    def _parse_assessment(
        self,
        result: Dict[str, Any],
        payer_name: str,
        policy_text: str,
        medication_name: str
    ) -> CoverageAssessment:
        """Parse LLM response into CoverageAssessment."""
        from uuid import uuid4

        # Validate the LLM returned usable data
        if not result.get("criteria_assessments") and not result.get("coverage_status"):
            logger.error(
                "LLM returned no usable assessment data",
                payer=payer_name,
                keys=list(result.keys()),
            )
            raise ValueError(f"LLM response missing required assessment fields for {payer_name}")

        # Parse criteria assessments
        criteria = []
        raw_criteria = result.get("criteria_assessments", [])
        for c in raw_criteria:
            criteria.append(CriterionAssessment(
                criterion_id=c.get("criterion_id", str(uuid4())),
                criterion_name=c.get("criterion_name", "Unknown"),
                criterion_description=c.get("criterion_description", ""),
                is_met=c.get("is_met", False),
                confidence=c.get("confidence", 0.5),
                supporting_evidence=c.get("supporting_evidence", []),
                gaps=c.get("gaps", []),
                reasoning=c.get("reasoning", "")
            ))

        # Parse documentation gaps
        gaps = []
        raw_gaps = result.get("documentation_gaps", [])
        for g in raw_gaps:
            gaps.append(DocumentationGap(
                gap_id=g.get("gap_id", str(uuid4())),
                gap_type=g.get("gap_type", "other"),
                description=g.get("description", ""),
                required_for=g.get("required_for", []),
                priority=g.get("priority", "medium"),
                suggested_action=g.get("suggested_action", "")
            ))

        # Map coverage status with conservative decision model
        status_str = result.get("coverage_status", "unknown")
        coverage_status = self._apply_conservative_status_mapping(
            status_str,
            result.get("approval_likelihood", 0.5)
        )

        return CoverageAssessment(
            assessment_id=str(uuid4()),
            payer_name=payer_name,
            policy_name=f"{payer_name} Policy",
            medication_name=medication_name,
            coverage_status=coverage_status,
            approval_likelihood=result.get("approval_likelihood", 0.5),
            approval_likelihood_reasoning=result.get("approval_likelihood_reasoning", ""),
            criteria_assessments=criteria,
            criteria_met_count=sum(1 for c in criteria if c.is_met),
            criteria_total_count=len(criteria),
            documentation_gaps=gaps,
            recommendations=result.get("recommendations", []),
            step_therapy_required=result.get("step_therapy_required", False),
            step_therapy_options=result.get("step_therapy_options", []),
            step_therapy_satisfied=result.get("step_therapy_satisfied", False),
            raw_policy_text=policy_text,
            llm_raw_response=result
        )

    def _apply_conservative_status_mapping(
        self,
        status_str: str,
        approval_likelihood: float
    ) -> CoverageStatus:
        """
        Apply conservative decision model to coverage status.

        Following Anthropic's prior-auth-review-skill pattern:
        - AI should NEVER recommend DENY
        - NOT_COVERED maps to REQUIRES_HUMAN_REVIEW
        - Low confidence also triggers human review

        Args:
            status_str: Raw status string from LLM
            approval_likelihood: Confidence score 0.0-1.0

        Returns:
            Mapped CoverageStatus (conservative)
        """
        # Try to parse the status
        try:
            coverage_status = CoverageStatus(status_str.lower())
        except ValueError:
            # Unknown status - requires human review
            logger.warning(
                "Unknown coverage status from LLM",
                status=status_str,
                mapping_to="requires_human_review"
            )
            return CoverageStatus.REQUIRES_HUMAN_REVIEW

        # CRITICAL: Apply conservative mapping
        # AI should NEVER recommend denial - map to human review
        if coverage_status == CoverageStatus.NOT_COVERED:
            logger.info(
                "Conservative mapping: NOT_COVERED -> REQUIRES_HUMAN_REVIEW",
                original_status=status_str,
                reason="AI cannot recommend denial - human must decide"
            )
            return CoverageStatus.REQUIRES_HUMAN_REVIEW

        # Low confidence also triggers human review
        if approval_likelihood < 0.3:
            logger.info(
                "Conservative mapping: Low confidence -> REQUIRES_HUMAN_REVIEW",
                original_status=status_str,
                likelihood=approval_likelihood,
                reason="Low approval likelihood requires human review"
            )
            return CoverageStatus.REQUIRES_HUMAN_REVIEW

        # Borderline cases get PEND instead of denial
        if coverage_status == CoverageStatus.UNKNOWN and approval_likelihood < 0.5:
            logger.info(
                "Conservative mapping: UNKNOWN with low likelihood -> REQUIRES_HUMAN_REVIEW",
                original_status=status_str,
                likelihood=approval_likelihood
            )
            return CoverageStatus.REQUIRES_HUMAN_REVIEW

        # Log passthrough for audit trail
        logger.debug(
            "Coverage status preserved",
            original=status_str,
            result=coverage_status.value,
            likelihood=approval_likelihood
        )

        return coverage_status

    async def identify_gaps(
        self,
        case_summary: Dict[str, Any],
        coverage_assessment: CoverageAssessment,
        available_documents: list
    ) -> list:
        """
        Identify documentation gaps in a case.

        Args:
            case_summary: Summary of the case
            coverage_assessment: Previous coverage assessment
            available_documents: List of available documentation

        Returns:
            List of documentation gaps
        """
        prompt = self.prompt_loader.load(
            "policy_analysis/gap_identification.txt",
            {
                "case_summary": case_summary,
                "coverage_assessment": coverage_assessment.model_dump(),
                "available_documents": available_documents
            }
        )

        result = await self.llm_gateway.analyze_policy(prompt=prompt)

        gaps = []
        for g in result.get("gaps", []):
            gaps.append(DocumentationGap(
                gap_id=g.get("gap_id", ""),
                gap_type=g.get("gap_type", "other"),
                description=g.get("description", ""),
                required_for=g.get("required_for_criteria", []),
                priority=g.get("impact_on_approval", "medium"),
                suggested_action=g.get("suggested_resolution", {}).get("action", ""),
                estimated_resolution_complexity=g.get("suggested_resolution", {}).get(
                    "estimated_complexity", "medium"
                )
            ))

        return gaps


# Global instance
_policy_reasoner: Optional[PolicyReasoner] = None


def get_policy_reasoner() -> PolicyReasoner:
    """Get or create the global Policy Reasoner instance."""
    global _policy_reasoner
    if _policy_reasoner is None:
        _policy_reasoner = PolicyReasoner()
    return _policy_reasoner
