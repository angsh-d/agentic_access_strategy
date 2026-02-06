"""Tests for strategy scoring with both patients."""
import pytest
import sys
from pathlib import Path
from uuid import uuid4

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestStrategyScorer:
    """Test the strategy scoring algorithm."""

    @pytest.fixture
    def scorer(self, mock_env_vars):
        """Get the strategy scorer instance."""
        from backend.reasoning.strategy_scorer import StrategyScorer
        return StrategyScorer()

    @pytest.fixture
    def scoring_weights(self, mock_env_vars):
        """Get ScoringWeights class."""
        from backend.models.strategy import ScoringWeights
        return ScoringWeights()

    def test_scorer_initialization(self, scorer):
        """Strategy scorer should initialize correctly."""
        assert scorer is not None
        assert hasattr(scorer, 'score_strategy')

    def test_scorer_has_weights(self, scorer, scoring_weights):
        """Scorer should have defined weights."""
        weights = scorer.weights

        # Check weights exist as attributes
        assert hasattr(weights, "speed")
        assert hasattr(weights, "approval")
        assert hasattr(weights, "low_rework")
        assert hasattr(weights, "patient_burden")

        # Weights should sum to approximately 1.0
        total = weights.speed + weights.approval + weights.low_rework + weights.patient_burden
        assert 0.99 <= total <= 1.01

    def test_scoring_weights_validation(self, scoring_weights):
        """ScoringWeights should validate correctly."""
        assert scoring_weights.validate() is True

    @pytest.fixture
    def mock_coverage_assessments(self, mock_env_vars):
        """Create mock coverage assessments."""
        from backend.models.coverage import CoverageAssessment
        from backend.models.enums import CoverageStatus

        return {
            "Cigna": CoverageAssessment(
                assessment_id="test-cigna-001",
                payer_name="Cigna",
                policy_name="Cigna Infliximab Policy IP0660",
                medication_name="Infliximab",
                coverage_status=CoverageStatus.LIKELY_COVERED,
                approval_likelihood=0.75,
                approval_likelihood_reasoning="Patient meets most criteria with complete documentation",
                criteria_met_count=8,
                criteria_total_count=10,
                step_therapy_required=True,
                step_therapy_satisfied=True
            ),
            "UHC": CoverageAssessment(
                assessment_id="test-uhc-001",
                payer_name="UHC",
                policy_name="UHC Infliximab Policy 2025D0004AQ",
                medication_name="Infliximab",
                coverage_status=CoverageStatus.LIKELY_COVERED,
                approval_likelihood=0.85,
                approval_likelihood_reasoning="Patient requesting preferred biosimilar with complete documentation",
                criteria_met_count=9,
                criteria_total_count=10,
                step_therapy_required=True,
                step_therapy_satisfied=True
            )
        }

    @pytest.fixture
    def mock_coverage_with_gaps(self, mock_env_vars):
        """Create mock coverage assessments with gaps."""
        from backend.models.coverage import CoverageAssessment, CriterionAssessment, DocumentationGap
        from backend.models.enums import CoverageStatus

        return {
            "Cigna": CoverageAssessment(
                assessment_id="test-cigna-gaps-001",
                payer_name="Cigna",
                policy_name="Cigna Infliximab Policy IP0660",
                medication_name="Infliximab",
                coverage_status=CoverageStatus.LIKELY_COVERED,
                approval_likelihood=0.70,
                approval_likelihood_reasoning="Coverage likely but documentation gaps reduce confidence",
                criteria_met_count=7,
                criteria_total_count=10,
                step_therapy_required=True,
                step_therapy_satisfied=True,
                criteria_assessments=[
                    CriterionAssessment(
                        criterion_id="TB_SCREEN",
                        criterion_name="TB Screening",
                        criterion_description="Negative TB test required",
                        is_met=False,
                        confidence=0.9,
                        reasoning="Missing TB screening documentation"
                    )
                ],
                documentation_gaps=[
                    DocumentationGap(
                        gap_id="GAP-TB-001",
                        gap_type="lab_result",
                        description="Missing TB screening documentation",
                        priority="high",
                        suggested_action="Request TB test results from provider"
                    )
                ]
            ),
            "UHC": CoverageAssessment(
                assessment_id="test-uhc-gaps-001",
                payer_name="UHC",
                policy_name="UHC Infliximab Policy 2025D0004AQ",
                medication_name="Infliximab",
                coverage_status=CoverageStatus.LIKELY_COVERED,
                approval_likelihood=0.80,
                approval_likelihood_reasoning="Coverage likely but Hep B screening missing",
                criteria_met_count=8,
                criteria_total_count=10,
                step_therapy_required=True,
                step_therapy_satisfied=True,
                criteria_assessments=[
                    CriterionAssessment(
                        criterion_id="HEP_B",
                        criterion_name="Hepatitis B Screening",
                        criterion_description="Negative Hepatitis B test required",
                        is_met=False,
                        confidence=0.9,
                        reasoning="Missing Hep B screening"
                    )
                ],
                documentation_gaps=[
                    DocumentationGap(
                        gap_id="GAP-HEPB-001",
                        gap_type="lab_result",
                        description="Missing Hepatitis B screening",
                        priority="high",
                        suggested_action="Request Hep B panel results"
                    )
                ]
            )
        }

    def test_generate_strategies(self, scorer, mock_coverage_assessments):
        """Should generate only valid sequential primary-first strategy."""
        strategies = scorer.generate_strategies(mock_coverage_assessments)

        assert len(strategies) == 1  # Only SEQUENTIAL_PRIMARY_FIRST is valid
        assert strategies[0].strategy_type.value == "sequential_primary_first"
        assert strategies[0].parallel_submission is False

    def test_score_strategy_returns_valid_score(self, scorer, mock_coverage_assessments):
        """Scoring should return valid StrategyScore object."""
        strategies = scorer.generate_strategies(mock_coverage_assessments)
        case_id = str(uuid4())

        for strategy in strategies:
            score = scorer.score_strategy(
                strategy=strategy,
                case_id=case_id,
                coverage_assessments=mock_coverage_assessments
            )

            assert score is not None
            assert 0 <= score.total_score <= 10
            assert score.strategy_id == strategy.strategy_id
            assert score.case_id == case_id

    def test_score_all_strategies_ranks_correctly(self, scorer, mock_coverage_assessments):
        """Should rank strategies by total score descending."""
        strategies = scorer.generate_strategies(mock_coverage_assessments)
        case_id = str(uuid4())

        scores = scorer.score_all_strategies(
            strategies=strategies,
            case_id=case_id,
            coverage_assessments=mock_coverage_assessments
        )

        # Check sorted descending
        for i in range(len(scores) - 1):
            assert scores[i].total_score >= scores[i + 1].total_score

        # Check ranks assigned
        for i, score in enumerate(scores):
            assert score.rank == i + 1

        # Top strategy should be recommended
        assert scores[0].is_recommended is True

    def test_documentation_gaps_penalize_score(self, scorer, mock_coverage_assessments, mock_coverage_with_gaps):
        """Documentation gaps should lower approval score."""
        strategies = scorer.generate_strategies(mock_coverage_assessments)
        case_id = str(uuid4())

        # Score same strategy with and without gaps
        strategy = strategies[0]

        score_clean = scorer.score_strategy(
            strategy=strategy,
            case_id=case_id,
            coverage_assessments=mock_coverage_assessments
        )

        score_gaps = scorer.score_strategy(
            strategy=strategy,
            case_id=case_id,
            coverage_assessments=mock_coverage_with_gaps
        )

        # Score with gaps should be lower or equal
        assert score_gaps.approval_score <= score_clean.approval_score

    def test_select_best_strategy(self, scorer, mock_coverage_assessments):
        """Should select highest scoring strategy."""
        strategies = scorer.generate_strategies(mock_coverage_assessments)
        case_id = str(uuid4())

        best_strategy, all_scores = scorer.select_best_strategy(
            strategies=strategies,
            case_id=case_id,
            coverage_assessments=mock_coverage_assessments
        )

        assert best_strategy is not None
        assert best_strategy.strategy_id == all_scores[0].strategy_id
        assert all_scores[0].is_recommended is True


class TestStrategySelection:
    """Test strategy selection logic."""

    @pytest.fixture
    def strategy_generator(self, mock_env_vars):
        """Get strategy generator agent."""
        from backend.agents.strategy_generator import StrategyGeneratorAgent
        return StrategyGeneratorAgent()

    @pytest.fixture
    def mock_case_state(self, mock_env_vars, maria_r_data):
        """Create mock case state."""
        from backend.models.case_state import CaseState, PatientInfo, MedicationRequest, PayerState

        # Get diagnosis codes from diagnoses array
        diagnosis_codes = [d["icd10_code"] for d in maria_r_data["diagnoses"]]
        primary_icd10 = diagnosis_codes[0] if diagnosis_codes else "K50.913"

        return CaseState(
            case_id=str(uuid4()),
            patient=PatientInfo(
                patient_id=maria_r_data["patient_id"],
                first_name=maria_r_data["demographics"]["first_name"],
                last_name=maria_r_data["demographics"]["last_name"],
                date_of_birth=maria_r_data["demographics"]["date_of_birth"],
                primary_payer="Cigna",
                primary_member_id=maria_r_data["insurance"]["primary"]["member_id"],
                diagnosis_codes=diagnosis_codes
            ),
            medication=MedicationRequest(
                medication_name=maria_r_data["medication_request"]["medication_name"],
                generic_name=maria_r_data["medication_request"]["medication_name"],
                ndc_code=maria_r_data["medication_request"].get("ndc_code", "00000-0000-00"),
                dose=maria_r_data["medication_request"]["dose"],
                route=maria_r_data["medication_request"]["route"],
                frequency=str(maria_r_data["medication_request"]["frequency"]),
                duration="ongoing",
                diagnosis="Crohn's disease with perianal fistula",
                icd10_code=primary_icd10,
                prescriber_npi=maria_r_data["prescriber"]["npi"],
                prescriber_name=maria_r_data["prescriber"]["name"],
                clinical_rationale="Patient has moderate-to-severe Crohn's disease requiring biologic therapy."
            ),
            payer_states={
                "Cigna": PayerState(payer_name="Cigna"),
                "UHC": PayerState(payer_name="UHC")
            },
            coverage_assessments={
                "Cigna": {
                    "assessment_id": "test-cigna-001",
                    "payer_name": "Cigna",
                    "policy_name": "Cigna Infliximab Policy IP0660",
                    "medication_name": "Infliximab",
                    "coverage_status": "likely_covered",
                    "approval_likelihood": 0.75,
                    "approval_likelihood_reasoning": "Patient meets most criteria",
                    "criteria_met_count": 8,
                    "criteria_total_count": 10,
                    "step_therapy_required": True,
                    "step_therapy_satisfied": True
                },
                "UHC": {
                    "assessment_id": "test-uhc-001",
                    "payer_name": "UHC",
                    "policy_name": "UHC Infliximab Policy 2025D0004AQ",
                    "medication_name": "Infliximab",
                    "coverage_status": "likely_covered",
                    "approval_likelihood": 0.85,
                    "approval_likelihood_reasoning": "High likelihood with complete docs",
                    "criteria_met_count": 9,
                    "criteria_total_count": 10,
                    "step_therapy_required": True,
                    "step_therapy_satisfied": True
                }
            }
        )

    @pytest.mark.asyncio
    async def test_generate_strategies_from_case(self, strategy_generator, mock_case_state):
        """Should generate strategies from case state."""
        strategies = await strategy_generator.generate_strategies(mock_case_state)

        assert len(strategies) == 1  # Only SEQUENTIAL_PRIMARY_FIRST is valid
        assert all(hasattr(s, 'strategy_type') for s in strategies)

    @pytest.mark.asyncio
    async def test_score_strategies_from_case(self, strategy_generator, mock_case_state):
        """Should score strategies for a case."""
        strategies = await strategy_generator.generate_strategies(mock_case_state)
        scores = await strategy_generator.score_strategies(mock_case_state, strategies)

        assert len(scores) == len(strategies)
        assert all(0 <= s.total_score <= 10 for s in scores)

    def test_strategy_comparison(self, strategy_generator, mock_env_vars):
        """Should generate strategy comparison."""
        from backend.reasoning.strategy_scorer import get_strategy_scorer
        from backend.models.coverage import CoverageAssessment
        from backend.models.enums import CoverageStatus
        from uuid import uuid4

        scorer = get_strategy_scorer()
        case_id = str(uuid4())

        assessments = {
            "Cigna": CoverageAssessment(
                assessment_id="test-cigna-001",
                payer_name="Cigna",
                policy_name="Cigna Infliximab Policy IP0660",
                medication_name="Infliximab",
                coverage_status=CoverageStatus.LIKELY_COVERED,
                approval_likelihood=0.75,
                approval_likelihood_reasoning="Patient meets most criteria",
                criteria_met_count=8,
                criteria_total_count=10,
                step_therapy_required=True,
                step_therapy_satisfied=True
            ),
            "UHC": CoverageAssessment(
                assessment_id="test-uhc-001",
                payer_name="UHC",
                policy_name="UHC Infliximab Policy 2025D0004AQ",
                medication_name="Infliximab",
                coverage_status=CoverageStatus.LIKELY_COVERED,
                approval_likelihood=0.85,
                approval_likelihood_reasoning="High likelihood with preferred biosimilar",
                criteria_met_count=9,
                criteria_total_count=10,
                step_therapy_required=True,
                step_therapy_satisfied=True
            )
        }

        strategies = scorer.generate_strategies(assessments)
        scores = scorer.score_all_strategies(strategies, case_id, assessments)

        comparison = strategy_generator.get_strategy_comparison(strategies, scores)

        assert "strategies" in comparison
        assert "recommended" in comparison
        assert len(comparison["strategies"]) == 1
        assert comparison["recommended"] is not None
