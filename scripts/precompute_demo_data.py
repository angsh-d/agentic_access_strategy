"""
Precompute Demo Data — runs the full pipeline for all 14 patients and caches results in DB.

Steps:
  1. Initialize database
  2. Digitize all policies (BCBS PDFs + UHC text + Cigna pre-digitized JSON)
  3. Run coverage assessments for each patient via Claude
  4. Generate & score strategies (deterministic, no LLM)
  5. Compute policy diffs for Ibrance (2024 vs 2025)
  6. Generate diff summaries via LLM
  7. Run impact analysis using pre-computed assessments
  8. Print verification report

Usage:
  source venv/bin/activate
  python scripts/precompute_demo_data.py [--fresh] [--skip-digitize] [--skip-assess] [--only PATIENT_ID]
"""

import asyncio
import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Suppress SQLAlchemy echo noise — override app_env to skip echo=True
import os
os.environ["APP_ENV"] = "production"

# Suppress noisy loggers
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from backend.config.logging_config import setup_logging, get_logger
setup_logging(log_level="INFO", log_file="precompute_demo.log")
logger = get_logger(__name__)


# ─── Patient/Policy Configuration ───

POLICY_CONFIGS = [
    # (payer, medication, file, source_type, versions)
    # BCBS medications — single-version PDFs, digitalize as "v1"
    ("bcbs", "spinraza", "data/policies/bcbs_spinraza.pdf", "pdf", [("v1", None)]),
    ("bcbs", "breyanzi", "data/policies/bcbs_breyanzi.pdf", "pdf", [("v1", None)]),
    ("bcbs", "carvykti", "data/policies/bcbs_carvykti.pdf", "pdf", [("v1", None)]),
    # Ibrance — two separate PDFs for 2024 and 2025
    ("bcbs", "ibrance", "data/policies/bcbs_ibrance.pdf", "pdf", [("v1", None)]),
    ("bcbs", "ibrance_v2", "data/policies/bcbs_palbociclib.pdf", "pdf", [("v2", None)]),
    # Cigna — pre-digitized JSON, no LLM calls needed
    ("cigna", "infliximab", "data/policies/cigna_infliximab_digitized.json", "json", [("v1", None)]),
    # UHC — text file, needs digitalization
    ("uhc", "infliximab", "data/policies/uhc_infliximab.txt", "text", [("v1", None)]),
]

PATIENT_CONFIGS = [
    # (patient_file, medication_generic, payer, demo_story)
    ("maria_r.json", "infliximab", "cigna", "pending_docs"),
    ("david_c.json", "infliximab", "cigna", "clean_approval"),
    ("aiden_f.json", "nusinersen", "bcbs", "denial_gene_therapy"),
    ("ethan_w.json", "nusinersen", "bcbs", "clean_approval"),
    ("sofia_r.json", "nusinersen", "bcbs", "denial_smn2_copies"),
    ("sarah_m.json", "lisocabtagene_maraleucel", "bcbs", "clean_approval"),
    ("robert_h.json", "lisocabtagene_maraleucel", "bcbs", "denial_cardiac"),
    ("marcus_b.json", "lisocabtagene_maraleucel", "bcbs", "policy_dependent"),
    ("james_o.json", "ciltacabtagene_autoleucel", "bcbs", "clean_approval"),
    ("diana_k.json", "ciltacabtagene_autoleucel", "bcbs", "policy_dependent"),
    ("linda_n.json", "ciltacabtagene_autoleucel", "bcbs", "policy_dependent"),
    ("catherine_p.json", "palbociclib", "bcbs", "clean_approval"),
    ("margaret_t.json", "palbociclib", "bcbs", "policy_dependent"),
    ("thomas_r.json", "palbociclib", "bcbs", "policy_dependent"),
]


async def step_init_db(fresh: bool = False):
    """Step 1: Initialize database."""
    from backend.storage.database import init_db, drop_db

    print("\n═══ Step 1: Initialize Database ═══")
    if fresh:
        print("  --fresh flag: dropping and recreating tables...")
        await drop_db()
    await init_db()
    print("  Database initialized ✓")


async def step_digitize_policies(skip: bool = False):
    """Step 2: Digitize all policies."""
    from backend.policy_digitalization.pipeline import get_digitalization_pipeline
    from backend.policy_digitalization.policy_repository import get_policy_repository
    from backend.models.policy_schema import DigitizedPolicy

    print("\n═══ Step 2: Digitize Policies ═══")
    if skip:
        print("  --skip-digitize: skipping policy digitalization")
        return

    pipeline = get_digitalization_pipeline()
    repo = get_policy_repository()
    results = {}

    for payer, med, filepath, src_type, versions in POLICY_CONFIGS:
        path = Path(filepath)
        if not path.exists():
            print(f"  SKIP {payer}/{med}: file not found ({filepath})")
            continue

        # Handle the ibrance_v2 special case — store under "ibrance" payer/med
        store_med = "ibrance" if med == "ibrance_v2" else med

        for version_label, version_year in versions:
            # Check if already cached
            existing = await repo.load_version(payer, store_med, version_label)
            if existing:
                print(f"  CACHED {payer}/{store_med} {version_label} — skipping")
                results[f"{payer}/{store_med}/{version_label}"] = "cached"
                continue

            try:
                t0 = time.time()
                if src_type == "json":
                    # Pre-digitized JSON — load directly and store
                    with open(path) as f:
                        data = json.load(f)
                    policy = DigitizedPolicy(**data)
                    policy.payer_name = payer
                    policy.medication_name = store_med
                    await repo.store_version(policy, version_label)
                    elapsed = time.time() - t0
                    print(f"  OK {payer}/{store_med} {version_label} (pre-digitized, {elapsed:.1f}s)")
                elif src_type == "pdf":
                    result = await pipeline.digitalize_versioned(
                        source=str(path),
                        source_type="pdf",
                        payer_name=payer,
                        medication_name=store_med,
                        version_label=version_label,
                        version_year=version_year,
                    )
                    elapsed = time.time() - t0
                    print(f"  OK {payer}/{store_med} {version_label} — {result.criteria_count} criteria ({elapsed:.1f}s)")
                else:
                    with open(path, encoding="utf-8") as f:
                        text = f.read()
                    result = await pipeline.digitalize_versioned(
                        source=text,
                        source_type="text",
                        payer_name=payer,
                        medication_name=store_med,
                        version_label=version_label,
                        version_year=version_year,
                    )
                    elapsed = time.time() - t0
                    print(f"  OK {payer}/{store_med} {version_label} — {result.criteria_count} criteria ({elapsed:.1f}s)")

                results[f"{payer}/{store_med}/{version_label}"] = "ok"

            except Exception as e:
                elapsed = time.time() - t0
                print(f"  FAIL {payer}/{store_med} {version_label}: {e} ({elapsed:.1f}s)")
                logger.error("Digitization failed", payer=payer, med=store_med, error=str(e))
                results[f"{payer}/{store_med}/{version_label}"] = f"error: {e}"

    print(f"\n  Summary: {sum(1 for v in results.values() if v in ('ok', 'cached'))}/{len(results)} policies digitized")
    return results


async def step_coverage_assessments(skip: bool = False, only_patient: Optional[str] = None):
    """Step 3: Run coverage assessments for all patients."""
    from backend.reasoning.policy_reasoner import get_policy_reasoner
    from backend.storage.database import get_db
    from backend.storage.models import CaseModel

    print("\n═══ Step 3: Coverage Assessments ═══")
    if skip:
        print("  --skip-assess: skipping coverage assessments")
        return {}

    reasoner = get_policy_reasoner()
    patients_dir = Path("data/patients")
    all_assessments: Dict[str, Dict[str, Any]] = {}  # patient_id -> {payer: assessment_dict}

    for patient_file, med_generic, payer, demo_story in PATIENT_CONFIGS:
        patient_path = patients_dir / patient_file
        if not patient_path.exists():
            print(f"  SKIP {patient_file}: not found")
            continue

        patient_id = patient_path.stem
        if only_patient and patient_id != only_patient:
            continue

        with open(patient_path) as f:
            patient_data = json.load(f)

        med_info = patient_data.get("medication_request", {})
        if not med_info.get("medication_name"):
            med_info["medication_name"] = med_generic

        # Check if assessment already cached in DB
        case_id = patient_id
        async with get_db() as session:
            from sqlalchemy import select
            stmt = select(CaseModel).where(CaseModel.id == case_id)
            result = await session.execute(stmt)
            existing_case = result.scalar_one_or_none()

        if existing_case and existing_case.coverage_assessments and existing_case.coverage_assessments.get(payer):
            print(f"  CACHED {patient_id} ({payer}/{med_generic}) — skipping")
            all_assessments[patient_id] = existing_case.coverage_assessments
            continue

        try:
            t0 = time.time()
            assessment = await reasoner.assess_coverage(
                patient_info=patient_data,
                medication_info=med_info,
                payer_name=payer,
            )
            elapsed = time.time() - t0

            assessment_dict = assessment.model_dump(mode="json")
            status = assessment.coverage_status.value
            likelihood = assessment.approval_likelihood
            met = assessment.criteria_met_count
            total = assessment.criteria_total_count

            print(f"  OK {patient_id:15s} | {payer}/{med_generic:25s} | {status:25s} | "
                  f"likelihood={likelihood:.0%} | criteria={met}/{total} | ({elapsed:.1f}s)")

            # Store/update in CaseModel
            async with get_db() as session:
                stmt = select(CaseModel).where(CaseModel.id == case_id)
                result = await session.execute(stmt)
                case = result.scalar_one_or_none()

                coverage_data = {payer: assessment_dict}

                if case:
                    existing_assessments = case.coverage_assessments or {}
                    existing_assessments[payer] = assessment_dict
                    case.coverage_assessments = existing_assessments
                    case.patient_data = patient_data
                    case.medication_data = med_info
                    case.stage = "policy_analysis"
                else:
                    case = CaseModel(
                        id=case_id,
                        stage="policy_analysis",
                        patient_data=patient_data,
                        medication_data=med_info,
                        payer_states={payer: {"status": "not_submitted"}},
                        coverage_assessments=coverage_data,
                    )
                    session.add(case)

            all_assessments[patient_id] = coverage_data

        except Exception as e:
            elapsed = time.time() - t0
            print(f"  FAIL {patient_id}: {e} ({elapsed:.1f}s)")
            logger.error("Assessment failed", patient=patient_id, error=str(e))

    print(f"\n  Summary: {len(all_assessments)}/{len(PATIENT_CONFIGS)} assessments completed")
    return all_assessments


async def step_strategy_scoring(assessments: Dict[str, Dict]):
    """Step 4: Generate and score strategies for each patient."""
    from backend.reasoning.strategy_scorer import get_strategy_scorer
    from backend.models.coverage import CoverageAssessment
    from backend.storage.database import get_db
    from backend.storage.models import CaseModel
    from sqlalchemy import select

    print("\n═══ Step 4: Strategy Scoring (Deterministic) ═══")
    scorer = get_strategy_scorer()
    scored_count = 0

    for patient_file, med_generic, payer, demo_story in PATIENT_CONFIGS:
        patient_id = Path(patient_file).stem

        if patient_id not in assessments:
            continue

        payer_assessments = assessments[patient_id]
        if not payer_assessments.get(payer):
            continue

        try:
            # Build CoverageAssessment objects for the scorer
            ca_map = {}
            for payer_name, assessment_data in payer_assessments.items():
                ca_map[payer_name] = CoverageAssessment(**assessment_data)

            strategies = scorer.generate_strategies(
                coverage_assessments=ca_map,
                primary_payer=payer,
            )

            scores = scorer.score_all_strategies(
                strategies=strategies,
                case_id=patient_id,
                coverage_assessments=ca_map,
            )

            best = scores[0] if scores else None
            strategies_data = [s.model_dump(mode="json") for s in strategies]
            scores_data = [s.model_dump(mode="json") for s in scores]

            # Store in CaseModel
            async with get_db() as session:
                stmt = select(CaseModel).where(CaseModel.id == patient_id)
                result = await session.execute(stmt)
                case = result.scalar_one_or_none()
                if case:
                    case.available_strategies = scores_data
                    if best:
                        case.selected_strategy_id = best.strategy_id
                        case.strategy_rationale = best.recommendation_reasoning

            scored_count += 1
            rec = f"recommended={best.strategy_id}" if best else "no recommendation"
            print(f"  OK {patient_id:15s} | {len(strategies)} strategies | {rec} | "
                  f"score={best.total_score:.1f}" if best else f"  OK {patient_id:15s} | 0 strategies")

        except Exception as e:
            print(f"  FAIL {patient_id}: {e}")
            logger.error("Strategy scoring failed", patient=patient_id, error=str(e))

    print(f"\n  Summary: {scored_count} patients scored")


async def step_policy_diffs():
    """Step 5: Compute policy diffs for medications with multiple versions."""
    from backend.policy_digitalization.policy_repository import get_policy_repository
    from backend.policy_digitalization.differ import PolicyDiffer

    print("\n═══ Step 5: Policy Diffs ═══")
    repo = get_policy_repository()
    differ = PolicyDiffer()
    diffs = {}

    # Only Ibrance has two versions currently
    diff_configs = [
        ("bcbs", "ibrance", "v1", "v2"),
    ]

    for payer, med, old_ver, new_ver in diff_configs:
        old_policy = await repo.load_version(payer, med, old_ver)
        new_policy = await repo.load_version(payer, med, new_ver)

        if not old_policy or not new_policy:
            print(f"  SKIP {payer}/{med}: missing version ({old_ver} or {new_ver})")
            continue

        try:
            t0 = time.time()
            diff_result = differ.diff(old_policy, new_policy)
            elapsed = time.time() - t0

            summary = diff_result.summary
            print(f"  OK {payer}/{med} {old_ver}→{new_ver} | "
                  f"added={summary.added_count} removed={summary.removed_count} "
                  f"modified={summary.modified_count} | "
                  f"breaking={summary.breaking_changes} material={summary.material_changes} | ({elapsed:.1f}s)")

            diffs[f"{payer}/{med}"] = diff_result

        except Exception as e:
            print(f"  FAIL {payer}/{med}: {e}")
            logger.error("Diff failed", payer=payer, med=med, error=str(e))

    return diffs


async def step_diff_summaries(diffs: Dict):
    """Step 6: Generate LLM-powered diff summaries."""
    import hashlib
    import uuid
    from backend.reasoning.llm_gateway import get_llm_gateway
    from backend.reasoning.prompt_loader import get_prompt_loader
    from backend.models.enums import TaskCategory
    from backend.policy_digitalization.policy_repository import get_policy_repository
    from backend.storage.database import get_db
    from backend.storage.models import PolicyDiffCacheModel
    from sqlalchemy import select

    print("\n═══ Step 6: Diff Summaries (LLM) ═══")
    if not diffs:
        print("  No diffs to summarize")
        return

    gateway = get_llm_gateway()
    prompt_loader = get_prompt_loader()
    repo = get_policy_repository()

    for key, diff_result in diffs.items():
        payer, med = key.split("/")

        # Check DB cache
        async with get_db() as session:
            stmt = (
                select(PolicyDiffCacheModel)
                .where(PolicyDiffCacheModel.payer_name == payer)
                .where(PolicyDiffCacheModel.medication_name == med)
            )
            result = await session.execute(stmt)
            cached = result.scalar_one_or_none()

        if cached and cached.summary_data:
            print(f"  CACHED {key} — skipping")
            continue

        try:
            t0 = time.time()
            diff_dict = diff_result.model_dump()

            prompt = prompt_loader.load(
                "policy_digitalization/change_summary.txt",
                {"diff_data": json.dumps(diff_dict, default=str, indent=2)},
            )

            llm_result = await gateway.generate(
                task_category=TaskCategory.SUMMARY_GENERATION,
                prompt=prompt,
                temperature=0.2,
                response_format="json",
            )

            summary = {}
            raw = llm_result.get("response")
            if raw is None:
                summary = {k: v for k, v in llm_result.items() if k not in ("provider", "task_category")}
            elif isinstance(raw, str):
                summary = json.loads(raw)
            else:
                summary = raw

            # Build diff payload for cache
            def _remap_field_changes(changes_list):
                for change in changes_list:
                    if "field_changes" in change:
                        change["field_changes"] = [
                            {"field": fc["field_name"], "old": fc["old"], "new": fc["new"]}
                            for fc in change["field_changes"]
                        ]
                return changes_list

            diff_payload = {
                "summary": {
                    "total_criteria_old": diff_dict["summary"]["total_criteria_old"],
                    "total_criteria_new": diff_dict["summary"]["total_criteria_new"],
                    "added": diff_dict["summary"]["added_count"],
                    "removed": diff_dict["summary"]["removed_count"],
                    "modified": diff_dict["summary"]["modified_count"],
                    "unchanged": diff_dict["summary"]["unchanged_count"],
                    "breaking_changes": diff_dict["summary"]["breaking_changes"],
                    "material_changes": diff_dict["summary"]["material_changes"],
                    "severity_assessment": diff_dict["summary"]["severity_assessment"],
                },
                "changes": {
                    "criteria": _remap_field_changes(diff_dict["criterion_changes"]),
                    "indications": diff_dict["indication_changes"],
                    "step_therapy": _remap_field_changes(diff_dict["step_therapy_changes"]),
                    "exclusions": _remap_field_changes(diff_dict["exclusion_changes"]),
                },
            }

            # Compute content hashes
            old_policy = await repo.load_version(payer, med, "v1")
            new_policy = await repo.load_version(payer, med, "v2")
            old_hash = hashlib.sha256(old_policy.model_dump_json().encode()).hexdigest() if old_policy else ""
            new_hash = hashlib.sha256(new_policy.model_dump_json().encode()).hexdigest() if new_policy else ""

            # Store in DB
            async with get_db() as session:
                # Delete any existing row
                existing_stmt = (
                    select(PolicyDiffCacheModel)
                    .where(PolicyDiffCacheModel.payer_name == payer)
                    .where(PolicyDiffCacheModel.medication_name == med)
                )
                existing_result = await session.execute(existing_stmt)
                existing_row = existing_result.scalar_one_or_none()
                if existing_row:
                    await session.delete(existing_row)

                new_row = PolicyDiffCacheModel(
                    id=str(uuid.uuid4()),
                    payer_name=payer,
                    medication_name=med,
                    old_version="v1",
                    new_version="v2",
                    old_content_hash=old_hash,
                    new_content_hash=new_hash,
                    diff_data=diff_payload,
                    summary_data=summary,
                )
                session.add(new_row)

            elapsed = time.time() - t0
            print(f"  OK {key} — summary generated and cached ({elapsed:.1f}s)")

        except Exception as e:
            elapsed = time.time() - t0
            print(f"  FAIL {key}: {e} ({elapsed:.1f}s)")
            logger.error("Diff summary failed", key=key, error=str(e))


async def step_impact_analysis(diffs: Dict, assessments: Dict):
    """Step 7: Run impact analysis using pre-computed assessments."""
    from backend.policy_digitalization.impact_analyzer import PolicyImpactAnalyzer
    from backend.policy_digitalization.policy_repository import get_policy_repository
    from backend.models.coverage import CoverageAssessment

    print("\n═══ Step 7: Impact Analysis ═══")
    if not diffs:
        print("  No diffs to analyze impact for")
        return

    repo = get_policy_repository()
    analyzer = PolicyImpactAnalyzer()

    for key, diff_result in diffs.items():
        payer, med = key.split("/")

        old_policy = await repo.load_version(payer, med, "v1")
        new_policy = await repo.load_version(payer, med, "v2")

        if not old_policy or not new_policy:
            print(f"  SKIP {key}: missing policy versions")
            continue

        # Build case list and pre-computed assessment maps
        patients_dir = Path("data/patients")
        active_cases = []
        old_assessment_map = {}
        new_assessment_map = {}

        # Map medication names for matching
        from backend.policy_digitalization.pipeline import MEDICATION_NAME_ALIASES
        med_names = {med}
        alias = MEDICATION_NAME_ALIASES.get(med)
        if alias:
            med_names.add(alias)

        for patient_file, med_generic, pt_payer, _ in PATIENT_CONFIGS:
            if pt_payer != payer:
                continue
            if med_generic not in med_names and not med_names.intersection({med_generic}):
                continue

            patient_id = Path(patient_file).stem
            patient_path = patients_dir / patient_file
            if not patient_path.exists():
                continue

            with open(patient_path) as f:
                patient_data = json.load(f)

            active_cases.append({
                "patient_data": patient_data,
                "case_id": patient_id,
            })

            # Don't pass pre-computed assessments — _lazy_assess() will run
            # version-specific evaluations using old_policy and new_policy
            # criteria separately for accurate impact comparison

        if not active_cases:
            print(f"  SKIP {key}: no matching patients")
            continue

        try:
            t0 = time.time()
            report = await analyzer.analyze_impact(
                diff=diff_result,
                old_policy=old_policy,
                new_policy=new_policy,
                active_cases=active_cases,
                old_assessments=old_assessment_map,
                new_assessments=new_assessment_map,
            )
            elapsed = time.time() - t0

            print(f"  OK {key} | cases={report.total_active_cases} | "
                  f"impacted={report.impacted_cases} | flips={report.verdict_flips} | "
                  f"at_risk={report.at_risk_cases} | ({elapsed:.1f}s)")

            for impact in report.patient_impacts:
                if impact.risk_level != "no_impact":
                    print(f"    → {impact.patient_name} ({impact.patient_id}): {impact.risk_level} — {impact.recommended_action}")

        except Exception as e:
            elapsed = time.time() - t0
            print(f"  FAIL {key}: {e} ({elapsed:.1f}s)")
            logger.error("Impact analysis failed", key=key, error=str(e))


def step_verification_report(assessments: Dict):
    """Step 8: Print verification report."""
    print("\n═══ Step 8: Verification Report ═══")
    print()
    print(f"{'Patient':15s} | {'Payer':6s} | {'Medication':28s} | {'Story':20s} | {'Status':25s} | {'Likelihood':10s} | {'Criteria':10s}")
    print("─" * 130)

    for patient_file, med_generic, payer, demo_story in PATIENT_CONFIGS:
        patient_id = Path(patient_file).stem
        pa = assessments.get(patient_id, {}).get(payer, {})

        if pa:
            status = pa.get("coverage_status", "?")
            likelihood = pa.get("approval_likelihood", 0)
            met = pa.get("criteria_met_count", 0)
            total = pa.get("criteria_total_count", 0)
            print(f"{patient_id:15s} | {payer:6s} | {med_generic:28s} | {demo_story:20s} | "
                  f"{status:25s} | {likelihood:10.0%} | {met}/{total}")
        else:
            print(f"{patient_id:15s} | {payer:6s} | {med_generic:28s} | {demo_story:20s} | "
                  f"{'NOT ASSESSED':25s} | {'—':10s} | {'—':10s}")

    print()

    # Clinical anomaly checks
    print("Clinical Anomaly Checks:")
    anomalies = 0
    for patient_file, med_generic, payer, demo_story in PATIENT_CONFIGS:
        patient_id = Path(patient_file).stem
        pa = assessments.get(patient_id, {}).get(payer, {})
        if not pa:
            continue

        status = pa.get("coverage_status", "")
        likelihood = pa.get("approval_likelihood", 0)

        # Check: clean approval patients should have high likelihood
        if demo_story == "clean_approval" and likelihood < 0.7:
            print(f"  WARNING: {patient_id} is a 'clean_approval' story but likelihood is {likelihood:.0%}")
            anomalies += 1

        # Check: denial patients should have low likelihood
        if "denial" in demo_story and likelihood > 0.7:
            print(f"  WARNING: {patient_id} is a '{demo_story}' story but likelihood is {likelihood:.0%}")
            anomalies += 1

        # Check: pending_docs should have requires_pa or requires_human_review
        if demo_story == "pending_docs" and status not in ("requires_pa", "requires_human_review", "pend"):
            print(f"  WARNING: {patient_id} is 'pending_docs' but status is '{status}'")
            anomalies += 1

    if anomalies == 0:
        print("  No anomalies detected ✓")
    else:
        print(f"  {anomalies} anomalies detected — review patient data")


async def main():
    parser = argparse.ArgumentParser(description="Precompute demo data for all 14 patients")
    parser.add_argument("--fresh", action="store_true", help="Drop and recreate database tables")
    parser.add_argument("--skip-digitize", action="store_true", help="Skip policy digitalization step")
    parser.add_argument("--skip-assess", action="store_true", help="Skip coverage assessment step")
    parser.add_argument("--only", type=str, default=None, help="Only process this patient ID")
    args = parser.parse_args()

    start = time.time()
    print("═" * 60)
    print("  Agentic Access Strategy — Demo Precomputation")
    print(f"  Started: {datetime.now().isoformat()}")
    print("═" * 60)

    # Step 1: Init DB
    await step_init_db(fresh=args.fresh)

    # Step 2: Digitize policies
    await step_digitize_policies(skip=args.skip_digitize)

    # Step 3: Coverage assessments
    assessments = await step_coverage_assessments(skip=args.skip_assess, only_patient=args.only)

    # Step 4: Strategy scoring
    if assessments:
        await step_strategy_scoring(assessments)

    # Step 5: Policy diffs
    diffs = await step_policy_diffs()

    # Step 6: Diff summaries
    await step_diff_summaries(diffs)

    # Step 7: Impact analysis
    await step_impact_analysis(diffs, assessments)

    # Step 8: Verification report
    step_verification_report(assessments)

    elapsed = time.time() - start
    print(f"\n═══ Complete — Total time: {elapsed:.0f}s ({elapsed/60:.1f} min) ═══")


if __name__ == "__main__":
    asyncio.run(main())
