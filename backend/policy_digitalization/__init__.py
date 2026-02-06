"""Policy Digitalization Module.

Multi-pass extraction pipeline + deterministic criteria evaluator.
"""

from backend.policy_digitalization.evaluator import (
    CriterionVerdict,
    CriterionEvaluation,
    GroupEvaluation,
    IndicationEvaluation,
    PolicyEvaluationResult,
    evaluate_policy,
    evaluate_criterion,
    evaluate_group,
)
from backend.policy_digitalization.patient_data_adapter import (
    NormalizedPatientData,
    NormalizedTreatment,
    NormalizedLabResult,
    NormalizedScreening,
    normalize_patient_data,
)
from backend.policy_digitalization.exceptions import (
    ExtractionError,
    ValidationError,
    EvaluationError,
    PolicyNotFoundError,
)
from backend.policy_digitalization.differ import (
    PolicyDiffer,
    PolicyDiffResult,
    ChangeType,
)
from backend.policy_digitalization.impact_analyzer import (
    PolicyImpactAnalyzer,
    PolicyImpactReport,
    PatientImpact,
)

__all__ = [
    # Evaluator
    "CriterionVerdict",
    "CriterionEvaluation",
    "GroupEvaluation",
    "IndicationEvaluation",
    "PolicyEvaluationResult",
    "evaluate_policy",
    "evaluate_criterion",
    "evaluate_group",
    # Patient data
    "NormalizedPatientData",
    "NormalizedTreatment",
    "NormalizedLabResult",
    "NormalizedScreening",
    "normalize_patient_data",
    # Exceptions
    "ExtractionError",
    "ValidationError",
    "EvaluationError",
    "PolicyNotFoundError",
    # Differ
    "PolicyDiffer",
    "PolicyDiffResult",
    "ChangeType",
    # Impact
    "PolicyImpactAnalyzer",
    "PolicyImpactReport",
    "PatientImpact",
]
