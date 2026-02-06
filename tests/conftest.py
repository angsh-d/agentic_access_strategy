"""Pytest fixtures for the test suite."""
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any

import pytest

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Data directory
DATA_DIR = PROJECT_ROOT / "data"
PATIENTS_DIR = DATA_DIR / "patients"
POLICIES_DIR = DATA_DIR / "policies"
STRATEGIES_DIR = DATA_DIR / "strategies"


@pytest.fixture
def project_root() -> Path:
    """Return the project root path."""
    return PROJECT_ROOT


@pytest.fixture
def data_dir() -> Path:
    """Return the data directory path."""
    return DATA_DIR


@pytest.fixture
def maria_r_data() -> Dict[str, Any]:
    """Load Maria R. patient data (complex case with gaps)."""
    patient_file = PATIENTS_DIR / "maria_r.json"
    with open(patient_file, "r") as f:
        return json.load(f)


@pytest.fixture
def david_c_data() -> Dict[str, Any]:
    """Load David C. patient data (clean case, no gaps)."""
    patient_file = PATIENTS_DIR / "david_c.json"
    with open(patient_file, "r") as f:
        return json.load(f)


@pytest.fixture
def all_patients(maria_r_data, david_c_data) -> Dict[str, Dict[str, Any]]:
    """Return all patient data keyed by patient_id."""
    return {
        "maria_r": maria_r_data,
        "david_c": david_c_data
    }


@pytest.fixture
def cigna_policy() -> str:
    """Load Cigna infliximab policy text."""
    policy_file = POLICIES_DIR / "cigna_infliximab.txt"
    with open(policy_file, "r") as f:
        return f.read()


@pytest.fixture
def uhc_policy() -> str:
    """Load UHC infliximab policy text."""
    policy_file = POLICIES_DIR / "uhc_infliximab.txt"
    with open(policy_file, "r") as f:
        return f.read()


@pytest.fixture
def strategy_templates() -> Dict[str, Any]:
    """Load strategy templates."""
    templates_file = STRATEGIES_DIR / "templates.json"
    with open(templates_file, "r") as f:
        return json.load(f)


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Set up mock environment variables for testing."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-azure-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "test-deployment")
    monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
