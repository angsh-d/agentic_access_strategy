"""Tests for policy document loading and content."""
import pytest


class TestPolicyFileExists:
    """Test that policy files exist and are readable."""

    def test_cigna_policy_exists(self, cigna_policy):
        """Cigna policy file should exist and be readable."""
        assert cigna_policy is not None
        assert len(cigna_policy) > 0

    def test_uhc_policy_exists(self, uhc_policy):
        """UHC policy file should exist and be readable."""
        assert uhc_policy is not None
        assert len(uhc_policy) > 0


class TestCignaPolicyContent:
    """Test Cigna policy document content."""

    def test_cigna_policy_is_real_not_synthetic(self, cigna_policy):
        """Cigna policy should be real extracted policy, not synthetic."""
        # Real policy has policy number IP0660
        assert "IP0660" in cigna_policy or "ip_0660" in cigna_policy.lower()

    def test_cigna_policy_covers_crohns(self, cigna_policy):
        """Cigna policy should cover Crohn's disease."""
        policy_lower = cigna_policy.lower()
        assert "crohn" in policy_lower

    def test_cigna_policy_covers_infliximab(self, cigna_policy):
        """Cigna policy should cover infliximab products."""
        policy_lower = cigna_policy.lower()
        assert "infliximab" in policy_lower

    def test_cigna_policy_mentions_remicade(self, cigna_policy):
        """Cigna policy should mention Remicade."""
        assert "Remicade" in cigna_policy or "remicade" in cigna_policy.lower()

    def test_cigna_policy_mentions_biosimilars(self, cigna_policy):
        """Cigna policy should mention biosimilars."""
        policy_lower = cigna_policy.lower()
        assert any(bs in policy_lower for bs in ["inflectra", "avsola", "renflexis"])

    def test_cigna_policy_has_coverage_criteria(self, cigna_policy):
        """Cigna policy should have coverage criteria section."""
        policy_lower = cigna_policy.lower()
        assert "coverage" in policy_lower
        assert "criteria" in policy_lower

    def test_cigna_policy_mentions_gastroenterologist(self, cigna_policy):
        """Cigna policy should require gastroenterologist for Crohn's."""
        policy_lower = cigna_policy.lower()
        assert "gastroenterolog" in policy_lower


class TestUHCPolicyContent:
    """Test UHC policy document content."""

    def test_uhc_policy_is_real_not_synthetic(self, uhc_policy):
        """UHC policy should be real extracted policy, not synthetic."""
        # Real policy has policy number 2025D0004AQ
        assert "2025D0004AQ" in uhc_policy or "2025D0004" in uhc_policy

    def test_uhc_policy_covers_crohns(self, uhc_policy):
        """UHC policy should cover Crohn's disease."""
        policy_lower = uhc_policy.lower()
        assert "crohn" in policy_lower

    def test_uhc_policy_covers_infliximab(self, uhc_policy):
        """UHC policy should cover infliximab products."""
        policy_lower = uhc_policy.lower()
        assert "infliximab" in uhc_policy.lower()

    def test_uhc_policy_has_preferred_products(self, uhc_policy):
        """UHC policy should specify preferred products (Inflectra/Avsola)."""
        policy_lower = uhc_policy.lower()
        # UHC prefers biosimilars
        assert "inflectra" in policy_lower or "avsola" in policy_lower
        assert "preferred" in policy_lower

    def test_uhc_policy_has_crohns_criteria(self, uhc_policy):
        """UHC policy should have Crohn's-specific criteria."""
        # Look for Crohn's disease section
        assert "Crohn's disease" in uhc_policy or "Crohn's Disease" in uhc_policy

    def test_uhc_policy_mentions_fistula(self, uhc_policy):
        """UHC policy should mention fistulizing disease."""
        policy_lower = uhc_policy.lower()
        assert "fistul" in policy_lower

    def test_uhc_policy_mentions_gastroenterologist(self, uhc_policy):
        """UHC policy should require gastroenterologist for Crohn's."""
        policy_lower = uhc_policy.lower()
        assert "gastroenterolog" in policy_lower

    def test_uhc_policy_has_step_therapy(self, uhc_policy):
        """UHC policy should mention conventional therapy requirements."""
        policy_lower = uhc_policy.lower()
        # Check for conventional therapy mentions
        assert any(term in policy_lower for term in [
            "corticosteroid", "prednisone", "azathioprine",
            "6-mercaptopurine", "methotrexate", "conventional"
        ])


class TestPolicyAlignment:
    """Test that policies align with patient data requirements."""

    def test_both_policies_cover_crohns_with_fistula(self, cigna_policy, uhc_policy):
        """Both policies should cover Crohn's with fistula (Maria R.'s condition)."""
        # ICD-10 K50.x13 codes are for Crohn's with fistula
        cigna_lower = cigna_policy.lower()
        uhc_lower = uhc_policy.lower()

        # Both should mention fistula coverage
        assert "fistul" in cigna_lower or "k50" in cigna_lower
        assert "fistul" in uhc_lower

    def test_policies_require_prior_therapy_failure(self, cigna_policy, uhc_policy):
        """Both policies should require prior therapy failure."""
        cigna_lower = cigna_policy.lower()
        uhc_lower = uhc_policy.lower()

        # Check for failure/inadequate response language
        assert "fail" in cigna_lower or "inadequate" in cigna_lower
        assert "fail" in uhc_lower or "inadequate" in uhc_lower


class TestStrategyTemplates:
    """Test strategy templates data."""

    def test_templates_exist(self, strategy_templates):
        """Strategy templates should exist."""
        assert strategy_templates is not None
        assert "strategy_templates" in strategy_templates

    def test_templates_have_required_strategies(self, strategy_templates):
        """Templates should have sequential, parallel, and optimized strategies."""
        templates = strategy_templates["strategy_templates"]
        strategy_ids = list(templates.keys())

        assert "sequential_cigna_first" in strategy_ids
        assert "parallel" in strategy_ids
        assert "optimized_uhc_first" in strategy_ids

    def test_optimized_strategy_has_highest_base_score(self, strategy_templates):
        """Optimized (UHC first) should have highest base approval score."""
        templates = strategy_templates["strategy_templates"]

        optimized = templates["optimized_uhc_first"]
        sequential = templates["sequential_cigna_first"]

        # UHC-first should have higher approval probability due to biosimilar preference
        assert optimized["base_scores"]["approval"] >= sequential["base_scores"]["approval"]
