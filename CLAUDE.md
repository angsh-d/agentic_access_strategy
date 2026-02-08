# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agentic Access Strategy Platform - A goal-driven AI platform that autonomously reasons across multiple payer policies, selects optimal access strategies, and coordinates actions to maximize speed-to-therapy and reimbursement success in prior authorization (PA) workflows.

**Demo Use Case:** Infliximab (IV biologic) for moderate-to-severe Crohn's disease with fistula, dual payer scenario (Cigna Commercial PPO primary + UnitedHealthcare Commercial secondary).

## Development Commands

### Backend (FastAPI + Python 3.10)

```bash
# Activate virtual environment (REQUIRED before any Python commands)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Run all tests
pytest

# Run specific test file
pytest tests/test_strategy_scoring.py

# Run with coverage
pytest --cov=backend tests/
```

### Frontend (React + TypeScript + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Development server (http://localhost:3000, proxies /api to backend)
npm run dev

# Production build
npm run build

# Linting
npm run lint
```

### API Endpoints

- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- WebSocket: ws://localhost:8000/ws

## Architecture Overview

### LangGraph Workflow (State Machine)

The case orchestrator (`backend/orchestrator/case_orchestrator.py`) uses LangGraph with these workflow stages:
```
INTAKE → POLICY_ANALYSIS → AWAITING_HUMAN_DECISION → STRATEGY_GENERATION
→ STRATEGY_SELECTION → ACTION_COORDINATION → MONITORING → [RECOVERY]
→ COMPLETED / FAILED
```

State is defined as `OrchestratorState` TypedDict in `backend/orchestrator/state.py`. Uses `Annotated[List, add]` for accumulating actions/messages across nodes. Factory: `create_initial_state()`, transitions: `transition_stage()`.

The `AWAITING_HUMAN_DECISION` stage implements a human-in-the-loop gate. The workflow pauses, the frontend renders decision options, and resumes via `POST /api/v1/cases/{case_id}/decision`. Decisions are recorded as `HumanDecision` objects with reviewer, timestamp, and audit trail.

### LLM Gateway (Task-Based Routing)

Models are routed by task type in `backend/reasoning/llm_gateway.py`:

| Task | Primary Model | Fallback |
|------|--------------|----------|
| POLICY_REASONING | Claude | Gemini |
| APPEAL_STRATEGY | Claude | Gemini |
| APPEAL_DRAFTING | Gemini | Azure OpenAI |
| SUMMARY_GENERATION | Gemini | Azure OpenAI |
| DATA_EXTRACTION | Gemini | Azure OpenAI |

**Claude is locked-in for clinical policy reasoning - no fallback.**

LLM clients: `backend/reasoning/claude_pa_client.py`, `gemini_client.py`, `openai_client.py`. Each lazily initialized.

### LLM-First Policy Evaluation

Coverage assessment uses an **LLM-first** approach — Claude evaluates each policy criterion directly. No deterministic evaluator.

**Flow**: `DigitizedPolicy → _format_policy_criteria() → coverage_assessment.txt prompt → Claude → _parse_assessment() → CoverageAssessment`

Key rules:
- Digitized policy criteria (IDs, types, thresholds, durations, codes, exclusions) are passed to Claude in the prompt
- Claude must echo exact `criterion_id` values from the digitized policy — backend validates returned IDs
- **Conservative decision model**: Claude NEVER recommends denial. `NOT_COVERED` maps to `REQUIRES_HUMAN_REVIEW`
- Frontend displays LLM assessment per criterion. Before analysis runs, all criteria show "Pending AI Analysis"
- The `POST /{payer}/{medication}/evaluate` endpoint returns HTTP 410 (deprecated)
- `evaluator.py` and `patient_data_adapter.py` still exist for `impact_analyzer.py` policy-vs-policy comparison but are NOT used for coverage assessment

### Settings & Configuration

All config via `backend/config/settings.py` (Pydantic BaseSettings loading from `.env`). Access with `get_settings()` (cached via `@lru_cache`). Model defaults: `claude-sonnet-4-20250514`, `gemini-3-pro-preview`.

### Storage Layer

- **Database**: SQLite + aiosqlite, async sessions via `backend/storage/database.py`
- **ORM**: `backend/storage/models.py` — `CaseModel` (JSON columns for patient_data, payer_states, coverage_assessments, strategies), `DecisionEventModel`, `CaseStateSnapshotModel`
- **Repository**: `backend/storage/case_repository.py` — async CRUD operations
- **Audit**: `backend/storage/audit_logger.py` — records all state changes
- **Waypoints**: `backend/storage/waypoint_writer.py` — writes intermediate reasoning outputs for transparency

### MCP Integration

`backend/mcp/` provides external validation via Model Context Protocol:
- `npi_validator.py` — NPI number validation
- `icd10_validator.py` — ICD-10 code validation
- `cms_coverage.py` — Medicare policy lookups

MCP client lifecycle managed in `backend/main.py` lifespan. The intake agent (`backend/agents/intake_agent.py`) calls these validators during case creation.

### Frontend Stack

React 18 + TypeScript + Vite. TanStack Query v5 for server state (with IndexedDB persistence via `idb-keyval`). Tailwind CSS + Framer Motion for UI. Path alias: `@/*` → `src/*`.

Key directories: `src/pages/` (5 routes), `src/components/domain/` (PA-specific components), `src/components/ui/` (reusable), `src/hooks/` (data fetching), `src/services/` (API/WebSocket clients), `src/types/` (TypeScript types mirroring backend models).

### Key Modules

| Directory | Purpose |
|-----------|---------|
| `backend/agents/` | Agent implementations (intake, policy analyzer, strategy generator, action coordinator, recovery) |
| `backend/reasoning/` | LLM integration layer (llm_gateway, policy_reasoner, strategy_scorer, prompt_loader, rubric_loader) |
| `backend/policy_digitalization/` | Multi-pass policy extraction pipeline (extractor, validator, differ, impact_analyzer) |
| `backend/orchestrator/` | LangGraph workflow engine |
| `backend/models/` | Pydantic data models and enums |
| `backend/api/routes/` | FastAPI route handlers (cases, strategies, policies, validation, activity, patients, websocket) |
| `backend/storage/` | Database, ORM models, repository, audit logging |
| `backend/mock_services/` | Mock payer gateways (Cigna, UHC) and scenario management |
| `backend/mcp/` | MCP client for external validations (NPI, ICD-10, CMS) |
| `prompts/` | Externalized LLM prompts (.txt files), organized by subdirectory |
| `data/` | Demo patient data (JSON + PDFs), digitized policies, strategy templates |

## Critical Development Rules

### Prompt Management
ALL prompts must be stored as separate `.txt` files in the `/prompts` directory. Never hardcode prompts in Python code. Use `backend/reasoning/prompt_loader.py` for loading with `{variable_name}` placeholder substitution.

### Logging Policy
ALL log files go in `./tmp/` directory only. Use centralized logging:
```python
from backend.config.logging_config import setup_logging, get_logger
setup_logging(log_level='INFO', log_file='my_module.log')  # Creates ./tmp/my_module.log
logger = get_logger(__name__)
```

### LLM Configuration
Always set `max_output_tokens` to model maximums:
- Gemini 2.5 Flash/Pro: 65536
- Gemini 2.0/1.5 models: 8192
- Claude: 8192 (from settings)

Credentials are in `.env`: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`

### Archive Policy
When creating new versions of files, immediately archive previous versions to `.archive/<timestamp>/` with descriptive README. Never keep multiple versions (v1, v2, _old suffixes) in the active workspace.

### Policy Criterion Evaluation
Policy criterion evaluation is **LLM-first** via `backend/reasoning/policy_reasoner.py`. Claude evaluates each criterion using the digitized policy structure passed in `{policy_criteria}`. Never add deterministic evaluation logic — all criterion assessment flows through Claude. The `evaluateCriterion()` function was removed from all frontend components.

### Strategy Scoring
Strategy scoring in `backend/reasoning/strategy_scorer.py` is **deterministic, no LLM** - pure algorithmic scoring for auditability. Same inputs must produce same outputs.

### Multi-Payer Sequencing
Strategies must always be **sequential primary-first** (COB compliance). Never generate parallel submission or secondary-first strategies. Only `StrategyType.SEQUENTIAL_PRIMARY_FIRST` is valid.

### Conservative Decision Model
AI NEVER recommends denial. In `policy_reasoner.py`:
- `NOT_COVERED` → `REQUIRES_HUMAN_REVIEW`
- Low confidence (< 0.3) → `REQUIRES_HUMAN_REVIEW`
- Approval likelihood is cross-validated against criteria met ratio (capped if contradictory)
- Human reviewers own all denial decisions

### Mock Payer Gateways
`backend/mock_services/payer/cigna_gateway.py` and `uhc_gateway.py` implement `PayerGateway` ABC (`payer_interface.py`). Behavior is scenario-driven — responses change based on the active scenario set via `ScenarioManager`.

## Demo Scenarios

Controlled via `backend/mock_services/scenarios/scenario_manager.py`:
- `HAPPY_PATH` - Both payers approve
- `MISSING_DOCS` - UHC requests TB screening
- `PRIMARY_DENY` - Cigna denies; recovery activated
- `SECONDARY_DENY` - UHC denies; escalation workflow
- `RECOVERY_SUCCESS` - Appeal succeeds after denial

Set via API: `POST /api/v1/scenarios/{scenario_id}`

## Data Models

Key enums in `backend/models/enums.py`:
- `CaseStage` - Workflow stages
- `PayerStatus` - NOT_SUBMITTED → SUBMITTED → APPROVED/DENIED → APPEAL_*
- `CoverageStatus` - COVERED, LIKELY_COVERED, REQUIRES_PA, NOT_COVERED, etc.
- `LLMTaskCategory` - POLICY_REASONING, APPEAL_STRATEGY, etc.

Case state in `backend/models/case_state.py`, coverage in `backend/models/coverage.py`, strategy in `backend/models/strategy.py`.
