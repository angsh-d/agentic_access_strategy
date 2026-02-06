"""Integration tests for the complete workflow."""
import pytest
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestIntakeAgent:
    """Test the intake agent with both patients."""

    @pytest.fixture
    def intake_agent(self, mock_env_vars):
        """Get intake agent instance."""
        from backend.agents.intake_agent import IntakeAgent
        return IntakeAgent(patients_dir=PROJECT_ROOT / "data" / "patients")

    def test_intake_agent_initialization(self, intake_agent):
        """Intake agent should initialize correctly."""
        assert intake_agent is not None

    @pytest.mark.asyncio
    async def test_process_maria_r_intake(self, intake_agent):
        """Should process Maria R. intake data."""
        case_state = await intake_agent.process_intake("maria_r")

        assert case_state is not None
        assert case_state.patient.first_name == "Maria"
        assert case_state.patient.last_name == "Rodriguez"
        assert "Cigna" in case_state.payer_states

    @pytest.mark.asyncio
    async def test_process_david_c_intake(self, intake_agent):
        """Should process David C. intake data."""
        case_state = await intake_agent.process_intake("david_c")

        assert case_state is not None
        assert case_state.patient.first_name == "David"
        assert case_state.patient.last_name == "Chen"
        assert "Cigna" in case_state.payer_states

    @pytest.mark.asyncio
    async def test_intake_creates_medication_request(self, intake_agent):
        """Should create medication request from patient data."""
        case_state = await intake_agent.process_intake("maria_r")

        assert case_state.medication is not None
        assert case_state.medication.medication_name == "Infliximab"
        assert case_state.medication.dose == "5mg/kg"


class TestPolicyAnalyzer:
    """Test the policy analyzer agent."""

    @pytest.fixture
    def policy_analyzer(self, mock_env_vars):
        """Get policy analyzer agent."""
        from backend.agents.policy_analyzer import PolicyAnalyzerAgent
        return PolicyAnalyzerAgent()

    def test_policy_analyzer_initialization(self, policy_analyzer):
        """Policy analyzer should initialize."""
        assert policy_analyzer is not None

    def test_get_documentation_gaps_for_maria(self, policy_analyzer, maria_r_data):
        """Should get documentation gaps for Maria R. from patient data."""
        gaps = maria_r_data.get("documentation_gaps", [])

        # Maria has TB and Hep B screening gaps defined in her data
        assert len(gaps) >= 2

    def test_get_no_gaps_for_david(self, policy_analyzer, david_c_data):
        """Should get no documentation gaps for David C. from patient data."""
        gaps = david_c_data.get("documentation_gaps", [])

        # David has all documentation
        assert len(gaps) == 0


class TestRecoveryAgent:
    """Test the recovery agent."""

    @pytest.fixture
    def recovery_agent(self, mock_env_vars):
        """Get recovery agent instance."""
        from backend.agents.recovery_agent import RecoveryAgent
        return RecoveryAgent()

    def test_recovery_agent_initialization(self, recovery_agent):
        """Recovery agent should initialize."""
        assert recovery_agent is not None

    def test_classify_documentation_denial(self, recovery_agent, maria_r_data):
        """Should classify documentation incomplete denial."""
        denial = {
            "denial_reason_code": "DOC_INCOMPLETE",
            "denial_reason": "Missing TB screening documentation",
            "appeal_deadline": "2024-12-15"
        }

        case_state = {
            "patient_data": maria_r_data,
            "documentation_gaps": maria_r_data.get("documentation_gaps", [])
        }

        classification = recovery_agent.classify_denial(denial, case_state)

        assert classification.denial_type == "documentation_incomplete"
        assert classification.is_recoverable is True

    def test_classify_medical_necessity_denial(self, recovery_agent, maria_r_data):
        """Should classify medical necessity denial."""
        denial = {
            "denial_reason_code": "MED_NEC_001",
            "denial_reason": "Medical necessity not established",
            "appeal_deadline": "2024-12-15"
        }

        case_state = {
            "patient_data": maria_r_data,
            "documentation_gaps": []
        }

        classification = recovery_agent.classify_denial(denial, case_state)

        assert classification.denial_type == "medical_necessity"
        assert classification.is_recoverable is True

    def test_generate_recovery_strategies_for_doc_denial(self, recovery_agent, maria_r_data):
        """Should generate recovery strategies for documentation denial."""
        from backend.agents.recovery_agent import DenialClassification

        classification = DenialClassification(
            denial_type="documentation_incomplete",
            is_recoverable=True,
            root_cause="Missing TB screening",
            linked_intake_gap="GAP-001",
            urgency="urgent"
        )

        case_state = {
            "patient_data": maria_r_data,
            "payers": ["Cigna"]
        }

        strategies = recovery_agent.generate_recovery_strategies(
            classification=classification,
            case_state=case_state,
            payer_name="Cigna"
        )

        assert len(strategies) >= 2
        # Should have urgent document chase as an option
        strategy_ids = [s["option_id"] for s in strategies]
        assert "URGENT_DOCUMENT_CHASE" in strategy_ids or "PARALLEL_RECOVERY" in strategy_ids


class TestMockPayerGateways:
    """Test mock payer gateways."""

    @pytest.fixture
    def cigna_gateway(self, mock_env_vars):
        """Get Cigna gateway."""
        from backend.mock_services.payer.cigna_gateway import CignaGateway
        return CignaGateway()

    @pytest.fixture
    def uhc_gateway(self, mock_env_vars):
        """Get UHC gateway."""
        from backend.mock_services.payer.uhc_gateway import UHCGateway
        return UHCGateway()

    def test_cigna_gateway_initialization(self, cigna_gateway):
        """Cigna gateway should initialize."""
        assert cigna_gateway is not None
        assert cigna_gateway.payer_name == "Cigna"

    def test_uhc_gateway_initialization(self, uhc_gateway):
        """UHC gateway should initialize."""
        assert uhc_gateway is not None
        assert uhc_gateway.payer_name == "UHC"

    @pytest.mark.asyncio
    async def test_cigna_submit_pa_happy_path(self, cigna_gateway, maria_r_data):
        """Cigna should accept PA submission in happy path."""
        from backend.mock_services.payer.payer_interface import PASubmission

        cigna_gateway.set_scenario("happy_path")

        # Get diagnosis codes from diagnoses array
        diagnosis_codes = [d["icd10_code"] for d in maria_r_data["diagnoses"]]

        submission = PASubmission(
            case_id="test-case-001",
            patient_member_id=maria_r_data["insurance"]["primary"]["member_id"],
            patient_name=f"{maria_r_data['demographics']['first_name']} {maria_r_data['demographics']['last_name']}",
            medication_name=maria_r_data["medication_request"]["medication_name"],
            medication_ndc=maria_r_data["medication_request"].get("ndc_code", "00000-0000-00"),
            diagnosis_codes=diagnosis_codes,
            prescriber_npi=maria_r_data["prescriber"]["npi"],
            prescriber_name=maria_r_data["prescriber"]["name"],
            clinical_rationale="Patient has moderate-to-severe Crohn's disease with perianal fistula requiring biologic therapy."
        )

        result = await cigna_gateway.submit_pa(submission)

        assert result is not None
        assert result.reference_number is not None
        assert result.payer_name == "Cigna"

    @pytest.mark.asyncio
    async def test_uhc_submit_pa_happy_path(self, uhc_gateway, david_c_data):
        """UHC should accept PA for clean case."""
        from backend.mock_services.payer.payer_interface import PASubmission

        uhc_gateway.set_scenario("happy_path")

        # Get diagnosis codes from diagnoses array
        diagnosis_codes = [d["icd10_code"] for d in david_c_data["diagnoses"]]

        submission = PASubmission(
            case_id="test-case-002",
            patient_member_id=david_c_data["insurance"]["primary"]["member_id"],
            patient_name=f"{david_c_data['demographics']['first_name']} {david_c_data['demographics']['last_name']}",
            medication_name=david_c_data["medication_request"]["medication_name"],
            medication_ndc=david_c_data["medication_request"].get("ndc_code", "00000-0000-00"),
            diagnosis_codes=diagnosis_codes,
            prescriber_npi=david_c_data["prescriber"]["npi"],
            prescriber_name=david_c_data["prescriber"]["name"],
            clinical_rationale="Patient has moderate-to-severe Crohn's disease with inadequate response to conventional therapy."
        )

        result = await uhc_gateway.submit_pa(submission)

        assert result is not None
        assert result.reference_number is not None
        assert result.payer_name == "UHC"


class TestEndToEndFlow:
    """Test end-to-end workflow."""

    def test_data_files_exist(self, data_dir):
        """All required data files should exist."""
        assert (data_dir / "patients" / "maria_r.json").exists()
        assert (data_dir / "patients" / "david_c.json").exists()
        assert (data_dir / "policies" / "cigna_infliximab.txt").exists()
        assert (data_dir / "policies" / "uhc_infliximab.txt").exists()
        assert (data_dir / "strategies" / "templates.json").exists()

    def test_all_patients_can_load(self, all_patients):
        """All patient data should load successfully."""
        assert "maria_r" in all_patients
        assert "david_c" in all_patients

    def test_policies_are_substantial(self, cigna_policy, uhc_policy):
        """Policy documents should be substantial (not stubs)."""
        # Real policies are thousands of characters
        assert len(cigna_policy) > 50000, "Cigna policy should be real, not stub"
        assert len(uhc_policy) > 100000, "UHC policy should be real, not stub"

    def test_patient_payer_alignment(self, all_patients):
        """Both patients should have Cigna as primary payer."""
        for patient_id, data in all_patients.items():
            primary = data["insurance"]["primary"]["payer_name"]
            assert primary == "Cigna", f"{patient_id} should have Cigna primary"

    def test_infliximab_request_alignment_with_policies(self, all_patients, cigna_policy, uhc_policy):
        """Patient medication requests should align with policies."""
        for patient_id, data in all_patients.items():
            med_name = data["medication_request"]["medication_name"]
            assert med_name == "Infliximab"

            # Both policies should cover infliximab
            assert "infliximab" in cigna_policy.lower()
            assert "infliximab" in uhc_policy.lower()
