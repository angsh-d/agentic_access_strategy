"""Tests for patient data loading and validation."""
import pytest
from pathlib import Path


class TestPatientDataStructure:
    """Test patient data structure and required fields."""

    def test_maria_r_has_required_demographics(self, maria_r_data):
        """Maria R. should have all required demographic fields."""
        assert "demographics" in maria_r_data
        demo = maria_r_data["demographics"]

        assert demo["first_name"] == "Maria"
        assert demo["last_name"] == "Rodriguez"
        assert demo["gender"] == "Female"
        assert demo["address"]["city"] == "Dallas"
        assert demo["address"]["state"] == "TX"

    def test_david_c_has_required_demographics(self, david_c_data):
        """David C. should have all required demographic fields."""
        assert "demographics" in david_c_data
        demo = david_c_data["demographics"]

        assert demo["first_name"] == "David"
        assert demo["last_name"] == "Chen"
        assert demo["gender"] == "Male"
        assert demo["address"]["city"] == "Houston"
        assert demo["address"]["state"] == "TX"

    def test_both_patients_have_primary_insurance(self, all_patients):
        """Both patients should have Cigna primary insurance."""
        for patient_id, data in all_patients.items():
            assert "insurance" in data, f"{patient_id} missing insurance"
            assert "primary" in data["insurance"]
            assert data["insurance"]["primary"]["payer_name"] == "Cigna"


class TestClinicalProfile:
    """Test clinical profile data for both patients."""

    def test_maria_r_has_crohns_diagnosis(self, maria_r_data):
        """Maria R. should have Crohn's disease with fistula."""
        diagnoses = maria_r_data["diagnoses"]

        crohns = next(
            (d for d in diagnoses if d["icd10_code"].startswith("K50")),
            None
        )
        assert crohns is not None, "Maria R. should have Crohn's disease"
        assert "fistula" in crohns["description"].lower()

    def test_david_c_has_crohns_diagnosis(self, david_c_data):
        """David C. should have Crohn's disease."""
        diagnoses = david_c_data["diagnoses"]

        crohns = next(
            (d for d in diagnoses if d["icd10_code"].startswith("K50")),
            None
        )
        assert crohns is not None, "David C. should have Crohn's disease"

    def test_maria_r_has_elevated_crp(self, maria_r_data):
        """Maria R. should have elevated CRP."""
        panels = maria_r_data["laboratory_results"]["panels"]
        inflammatory = panels.get("inflammatory_markers", {})
        results = inflammatory.get("results", [])
        crp = next((r for r in results if r["test"] == "CRP"), None)

        assert crp is not None
        assert crp["value"] == 28
        assert crp["unit"] == "mg/L"

    def test_david_c_has_lower_crp(self, david_c_data):
        """David C. should have lower CRP than Maria."""
        panels = david_c_data["laboratory_results"]["panels"]
        inflammatory = panels.get("inflammatory_markers", {})
        results = inflammatory.get("results", [])
        crp = next((r for r in results if r["test"] == "CRP"), None)

        assert crp is not None
        assert crp["value"] < 28  # Lower than Maria's

    def test_both_patients_have_disease_activity(self, all_patients):
        """Both patients should have disease activity scores."""
        for patient_id, data in all_patients.items():
            activity = data["disease_activity"]
            assert "cdai_score" in activity, f"{patient_id} missing CDAI"
            assert activity["cdai_score"] >= 220, f"{patient_id} should have moderate+ disease"


class TestDocumentationGaps:
    """Test documentation gap handling."""

    def test_maria_r_has_documentation_gaps(self, maria_r_data):
        """Maria R. should have intentional documentation gaps."""
        gaps = maria_r_data.get("documentation_gaps", [])

        assert len(gaps) >= 2, "Maria R. should have at least 2 gaps"

        gap_descriptions = [g["description"].lower() for g in gaps]
        assert any("tb" in d for d in gap_descriptions), "Missing TB screening gap"
        assert any("hepatitis" in d for d in gap_descriptions), "Missing Hep B gap"

    def test_david_c_has_no_documentation_gaps(self, david_c_data):
        """David C. should have no documentation gaps (clean case)."""
        gaps = david_c_data.get("documentation_gaps", [])
        assert len(gaps) == 0, "David C. should have no gaps"

    def test_david_c_has_tb_screening(self, david_c_data):
        """David C. should have TB screening completed."""
        screening = david_c_data["pre_biologic_screening"]
        tb = screening.get("tuberculosis_screening", {})

        assert tb["status"] == "COMPLETE", "David C. should have TB screening complete"
        assert tb["result"] == "Negative"

    def test_david_c_has_hepatitis_screening(self, david_c_data):
        """David C. should have Hepatitis B screening completed."""
        screening = david_c_data["pre_biologic_screening"]
        hep_b = screening.get("hepatitis_b_screening", {})

        assert hep_b["status"] == "COMPLETE", "David C. should have Hep B screening complete"


class TestMedicationRequest:
    """Test medication request data."""

    def test_both_patients_request_infliximab(self, all_patients):
        """Both patients should be requesting infliximab."""
        for patient_id, data in all_patients.items():
            med_req = data["medication_request"]
            assert med_req["medication_name"] == "Infliximab"
            assert med_req["dose"] == "5mg/kg"

            # Diagnosis codes are in separate diagnoses array
            diagnoses = data["diagnoses"]
            has_crohns = any(d["icd10_code"].startswith("K50") for d in diagnoses)
            assert has_crohns, f"{patient_id} should have Crohn's ICD code"

    def test_maria_r_requests_remicade(self, maria_r_data):
        """Maria R. requests Remicade (reference product)."""
        assert maria_r_data["medication_request"]["brand_name"] == "Remicade"

    def test_david_c_requests_biosimilar(self, david_c_data):
        """David C. requests Inflectra (preferred biosimilar)."""
        assert david_c_data["medication_request"]["brand_name"] == "Inflectra"


class TestPrescriber:
    """Test prescriber data."""

    def test_both_patients_have_gastroenterologist(self, all_patients):
        """Both patients should have a gastroenterologist prescriber."""
        for patient_id, data in all_patients.items():
            prescriber = data["prescriber"]
            assert prescriber["specialty"] == "Gastroenterology", \
                f"{patient_id} prescriber should be gastroenterologist"
            assert "FACG" in prescriber["credentials"] or "MD" in prescriber["credentials"]


class TestPriorTherapy:
    """Test prior therapy documentation."""

    def test_maria_r_failed_prednisone(self, maria_r_data):
        """Maria R. should have steroid-dependent prednisone outcome."""
        treatments = maria_r_data["prior_treatments"]
        prednisone = next(
            (t for t in treatments if t["medication_name"].lower() == "prednisone"),
            None
        )
        assert prednisone is not None
        assert prednisone["outcome"] == "steroid_dependent"

    def test_maria_r_intolerant_to_azathioprine(self, maria_r_data):
        """Maria R. should be intolerant to azathioprine."""
        treatments = maria_r_data["prior_treatments"]
        aza = next(
            (t for t in treatments if t["medication_name"].lower() == "azathioprine"),
            None
        )
        assert aza is not None
        assert aza["outcome"] == "intolerance"

    def test_david_c_adequate_azathioprine_trial(self, david_c_data):
        """David C. should have completed adequate azathioprine trial."""
        treatments = david_c_data["prior_treatments"]
        aza = next(
            (t for t in treatments if t["medication_name"].lower() == "azathioprine"),
            None
        )
        assert aza is not None
        assert aza["outcome"] == "inadequate_response"
        assert aza["duration_weeks"] >= 12, "Should have adequate trial duration"
