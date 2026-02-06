"""Tests for scenario manager functionality."""
import pytest
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestScenarioManager:
    """Test the scenario manager."""

    @pytest.fixture
    def scenario_manager(self, mock_env_vars):
        """Get a fresh scenario manager instance."""
        from backend.mock_services.scenarios.scenario_manager import ScenarioManager
        return ScenarioManager()

    @pytest.fixture
    def scenario_enum(self):
        """Get the Scenario enum."""
        from backend.mock_services.scenarios.scenario_manager import Scenario
        return Scenario

    def test_manager_initialization(self, scenario_manager, scenario_enum):
        """Scenario manager should initialize with happy_path."""
        assert scenario_manager.current_scenario == scenario_enum.HAPPY_PATH

    def test_list_scenarios(self, scenario_manager):
        """Should list all available scenarios."""
        scenarios = scenario_manager.list_scenarios()

        assert len(scenarios) >= 6  # At least 6 defined scenarios
        assert all("id" in s for s in scenarios)
        assert all("name" in s for s in scenarios)
        assert all("description" in s for s in scenarios)

    def test_switch_to_missing_docs(self, scenario_manager, scenario_enum):
        """Should switch to missing_docs scenario."""
        config = scenario_manager.set_scenario(scenario_enum.MISSING_DOCS)

        assert scenario_manager.current_scenario == scenario_enum.MISSING_DOCS
        assert config.name == "Missing Documentation"
        assert config.uhc_behavior == "pending_info"

    def test_switch_to_primary_deny(self, scenario_manager, scenario_enum):
        """Should switch to primary_deny scenario."""
        config = scenario_manager.set_scenario(scenario_enum.PRIMARY_DENY)

        assert scenario_manager.current_scenario == scenario_enum.PRIMARY_DENY
        assert config.cigna_behavior == "deny"
        assert config.uhc_behavior == "approve"

    def test_switch_to_recovery_success(self, scenario_manager, scenario_enum):
        """Should switch to recovery_success scenario."""
        config = scenario_manager.set_scenario(scenario_enum.RECOVERY_SUCCESS)

        assert scenario_manager.current_scenario == scenario_enum.RECOVERY_SUCCESS
        assert config.cigna_behavior == "deny_then_approve_appeal"

    def test_get_scenario_info(self, scenario_manager, scenario_enum):
        """Should get detailed scenario info."""
        info = scenario_manager.get_scenario_info(scenario_enum.DUAL_APPROVAL)

        assert info["id"] == "dual_approval"
        assert info["name"] == "Optimized Strategy Demo"
        assert "payer_behaviors" in info
        assert info["payer_behaviors"]["cigna"] == "slow_approval"
        assert info["payer_behaviors"]["uhc"] == "fast_approval"

    def test_scenario_has_demo_highlights(self, scenario_manager, scenario_enum):
        """Each scenario should have demo highlights."""
        for scenario in scenario_enum:
            config = scenario_manager.set_scenario(scenario)
            assert len(config.demo_highlights) > 0, f"{scenario.value} missing highlights"


class TestScenarioConfigs:
    """Test scenario configuration details."""

    @pytest.fixture
    def configs(self):
        """Get all scenario configs."""
        from backend.mock_services.scenarios.scenario_manager import SCENARIO_CONFIGS
        return SCENARIO_CONFIGS

    def test_happy_path_both_approve(self, configs):
        """Happy path should have both payers approve."""
        from backend.mock_services.scenarios.scenario_manager import Scenario

        config = configs[Scenario.HAPPY_PATH]
        assert config.cigna_behavior == "approve"
        assert config.uhc_behavior == "approve"

    def test_missing_docs_uhc_pends(self, configs):
        """Missing docs should have UHC request info."""
        from backend.mock_services.scenarios.scenario_manager import Scenario

        config = configs[Scenario.MISSING_DOCS]
        assert config.cigna_behavior == "approve"
        assert config.uhc_behavior == "pending_info"

    def test_secondary_deny_biosimilar_redirect(self, configs):
        """Secondary deny should trigger biosimilar redirect."""
        from backend.mock_services.scenarios.scenario_manager import Scenario

        config = configs[Scenario.SECONDARY_DENY]
        assert config.uhc_behavior == "biosimilar_redirect"

    def test_all_scenarios_have_expected_outcome(self, configs):
        """All scenarios should have expected outcome defined."""
        for scenario, config in configs.items():
            assert config.expected_outcome, f"{scenario.value} missing expected_outcome"
            assert len(config.expected_outcome) > 10  # Not just empty string


class TestScenarioPatientCompatibility:
    """Test scenarios work with both patient profiles."""

    @pytest.fixture
    def scenario_manager(self, mock_env_vars):
        """Get scenario manager."""
        from backend.mock_services.scenarios.scenario_manager import ScenarioManager
        return ScenarioManager()

    @pytest.fixture
    def scenario_enum(self):
        """Get Scenario enum."""
        from backend.mock_services.scenarios.scenario_manager import Scenario
        return Scenario

    def test_missing_docs_relevant_for_maria(self, scenario_manager, scenario_enum, maria_r_data):
        """Missing docs scenario should be relevant for Maria (has gaps)."""
        config = scenario_manager.set_scenario(scenario_enum.MISSING_DOCS)

        # Maria has documentation gaps
        gaps = maria_r_data.get("documentation_gaps", [])
        assert len(gaps) > 0, "Maria should have gaps for this scenario"

    def test_happy_path_ideal_for_david(self, scenario_manager, scenario_enum, david_c_data):
        """Happy path should be ideal for David (no gaps)."""
        config = scenario_manager.set_scenario(scenario_enum.HAPPY_PATH)

        # David has no documentation gaps
        gaps = david_c_data.get("documentation_gaps", [])
        assert len(gaps) == 0, "David should have no gaps for clean happy path"

    def test_biosimilar_redirect_relevant_for_maria(self, scenario_manager, scenario_enum, maria_r_data):
        """Biosimilar redirect relevant for Maria (requests Remicade)."""
        config = scenario_manager.set_scenario(scenario_enum.SECONDARY_DENY)

        # Maria requests Remicade (non-preferred)
        assert maria_r_data["medication_request"]["brand_name"] == "Remicade"

    def test_biosimilar_redirect_less_relevant_for_david(self, scenario_manager, scenario_enum, david_c_data):
        """Biosimilar redirect less relevant for David (requests Inflectra)."""
        config = scenario_manager.set_scenario(scenario_enum.SECONDARY_DENY)

        # David requests Inflectra (preferred)
        assert david_c_data["medication_request"]["brand_name"] == "Inflectra"
