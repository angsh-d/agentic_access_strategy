"""Tests for patient data adapter — normalizes raw patient JSON."""

import json
from pathlib import Path

import pytest

from backend.policy_digitalization.patient_data_adapter import (
    normalize_patient_data,
    NormalizedPatientData,
)


@pytest.fixture
def david_c_raw():
    """Load real patient data."""
    path = Path("data/patients/david_c.json")
    with open(path) as f:
        return json.load(f)


class TestNormalizePatientData:
    def test_demographics(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert result.patient_id == "david_c"
        assert result.age_years is not None
        assert result.age_years >= 39  # Born 1985
        assert result.gender == "male"

    def test_diagnosis_codes(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert "K50.10" in result.diagnosis_codes

    def test_disease_severity(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert result.disease_severity == "moderate_to_severe"

    def test_prior_treatments(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert len(result.prior_treatments) == 3
        med_names = [t.medication_name for t in result.prior_treatments]
        assert "Budesonide" in med_names
        assert "Prednisone" in med_names
        assert "Azathioprine" in med_names

    def test_treatment_outcomes_normalized(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        outcomes = {t.medication_name: t.outcome for t in result.prior_treatments}
        # Granular outcomes are preserved (not collapsed to "failed")
        assert outcomes["Budesonide"] == "partial_response"
        assert outcomes["Prednisone"] == "steroid_dependent"
        assert outcomes["Azathioprine"] == "inadequate_response"

    def test_treatment_duration(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        aza = next(t for t in result.prior_treatments if t.medication_name == "Azathioprine")
        assert aza.duration_weeks == 52
        assert aza.adequate_trial is True

    def test_lab_results(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert len(result.lab_results) > 0
        test_names = [l.test_name for l in result.lab_results]
        assert "CRP" in test_names
        assert "ESR" in test_names
        crp = next(l for l in result.lab_results if l.test_name == "CRP")
        assert crp.value == 18
        assert crp.flag == "H"

    def test_screenings(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert len(result.completed_screenings) == 3
        types = {s.screening_type for s in result.completed_screenings}
        assert types == {"tb", "hepatitis_b", "hepatitis_c"}
        tb = next(s for s in result.completed_screenings if s.screening_type == "tb")
        assert tb.completed is True
        assert tb.result_negative is True

    def test_prescriber(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert result.prescriber_specialty == "Gastroenterology"
        assert result.prescriber_npi == "1987654321"

    def test_functional_scores(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        cdai = next((s for s in result.functional_scores if s.score_type == "CDAI"), None)
        assert cdai is not None
        assert cdai.score_value == 265

    def test_imaging_results(self, david_c_raw):
        result = normalize_patient_data(david_c_raw)
        assert len(result.imaging_results) > 0
        colon = result.imaging_results[0]
        assert colon.modality == "colonoscopy"
        assert colon.score_type == "SES-CD"
        assert colon.score_value == 12

    def test_empty_patient(self):
        result = normalize_patient_data({})
        assert result.age_years is None
        assert result.diagnosis_codes == []
        assert result.prior_treatments == []

    def test_missing_optional_fields(self):
        result = normalize_patient_data({
            "demographics": {"date_of_birth": "2000-01-01"},
            "diagnoses": [{"icd10_code": "K50.10"}],
        })
        assert result.age_years is not None
        assert result.diagnosis_codes == ["K50.10"]
        assert result.prior_treatments == []
        assert result.completed_screenings == []
