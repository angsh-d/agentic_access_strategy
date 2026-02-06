
# Agentic Access Strategy Platform -- Solution Outline (Dual-Payer Scenario)

## 1. Vision & Goals

### Vision
Demonstrate a **goal-driven, agentic access decision platform** that reasons across multiple payer policies, selects optimal access strategies, and autonomously coordinates actions to maximize **speed-to-therapy and reimbursement success**.

This is not a PA automation demo.
It is a demonstration of **judgment, planning, and orchestration at scale**.

### Demo Goals
- Show how Agentic AI owns outcomes, not tasks
- Highlight reasoning across **primary and secondary payers**
- Demonstrate strategy selection, not workflow execution
- Prove immediate value without relying on long-term learning

---

## 2. Demo Use Case Summary

**Therapy:** Infliximab (IV biologic)
**Indication:** Moderate-to-severe Crohn's disease with fistula
**Site of Care:** Infusion center (medical benefit)

**Coverage Scenario**
- **Primary Payer:** Cigna Commercial PPO (employment-based)
- **Secondary Payer:** UnitedHealthcare Commercial (spouse coverage)

**Core Challenge**
Primary approval does not guarantee secondary reimbursement.
The system must reason across **both policies simultaneously**.

---

## 3. Primary User Personas

### 3.1 Access Operations / Hub Team
- Wants fewer denials and rework
- Needs confidence in strategy decisions
- Needs explainability

### 3.2 Specialty Pharmacy / Infusion Provider
- Wants to avoid post-infusion non-payment
- Needs clarity on payer sequencing
- Needs faster throughput

### 3.3 Field Reimbursement / Financial Counselors
- Wants targeted escalation
- Wants to avoid unnecessary manual effort

---

## 4. User Stories

### US-1: Case-Level Goal Definition
As an access coordinator,
I want the system to clearly state the access goal for the case
So that all actions are aligned to outcomes, not tasks.

### US-2: Multi-Payer Policy Reasoning
As the system,
I need to analyze both Cigna and UHC policies
So that I can identify shared and payer-specific requirements.

### US-3: Strategy Planning
As the system,
I want to generate viable access strategies
So that I can choose the option that optimizes speed and reimbursement success.

### US-4: Autonomous Strategy Selection
As the system,
I want to select and commit to a strategy with rationale
So that humans understand why a path was chosen.

### US-5: Coordinated Execution
As the system,
I want to trigger provider, patient, and payer actions in the correct sequence
So that delays and rework are minimized.

### US-6: Human-in-the-Loop Decision Gate
As a reviewer,
I want mandatory human checkpoints at critical decision points
So that AI never unilaterally denies coverage or proceeds without clinical oversight.

### US-7: Counterfactual Analysis *(Backend code complete, not yet integrated into workflow)*
As a stakeholder,
I want to see what would happen under alternative strategies
So that I trust the system's judgment.

> **Implementation note:** `strategy_generator.generate_counterfactual_analysis()` is fully implemented with LLM calls, and `CounterfactualPanel.tsx` exists in the frontend. However, no API route or orchestrator node currently calls this method. This is ready for integration but not yet exposed.

---

## 5. Patient Profiles (Synthetic, Demo-Ready)

### 5.1 Maria R. (Primary Demo Patient)
**Age/Sex:** 38 / Female
**Location:** Dallas, TX

**Clinical Summary**
- Diagnosis: Crohn's disease, moderate-to-severe
- Complication: Perianal fistula
- Recent ER visits: 2 in last 45 days

**Objective Evidence**
- CRP: 28 mg/L
- Fecal Calprotectin: >800 ug/g
- Hemoglobin: 10.2 g/dL
- Albumin: 3.1 g/dL
- Colonoscopy: Deep ulcerations

**Prior Therapy**
- Failed prednisone taper
- Intolerant to azathioprine

**Missing / Risk Items (Intentional for Demo)**
- TB screening result not attached
- Hepatitis B screening not attached
- Prior therapy failure dates not explicit

### 5.2 David C. (Secondary Demo Patient)
Additional synthetic patient available with corresponding clinical documents for expanded demo scenarios.

**Supporting Documents:**

*Maria R. (5 documents):*
- Prior Authorization Request Form (PDF)
- Laboratory Results (PDF)
- Colonoscopy Report (PDF)
- MRI Pelvis Report (PDF)
- Clinical Summary (PDF)

*David C. (4 documents):*
- Prior Authorization Request Form (PDF)
- Laboratory Results (PDF)
- Colonoscopy Report (PDF)
- Clinical Summary (PDF)

---

## 6. Data Used in the Demo

### 6.1 Clinical Data
- Synthetic patient chart summaries (JSON + PDF documents per patient)
- Synthetic labs and procedure notes
- Synthetic provider documentation

### 6.2 Payer Policy Data (Public)

#### Primary -- Cigna
Infliximab IV Products Prior Authorization Policy (Crohn's Disease)
Source: https://static.cigna.com/assets/chcp/pdf/coveragePolicies/pharmacy/ip_0660_coveragepositioncriteria_inflammatory_conditions_infliximab_intravenous_products_pa.pdf

#### Secondary -- UnitedHealthcare
Infliximab Medical Policy
Source: https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/infliximab-remicade-inflectra.pdf

#### CMS Reference (Medical Necessity Context)
CMS LCD L35677 -- Infliximab
Source: https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=35677

### 6.3 Policy Digitization
Payer PDF policies are digitized into structured JSON via Gemini LLM (`backend/reasoning/policy_digitizer.py`). Digitized policies are cached in the database (`PolicyCacheModel`) and can be pre-cached as `*_digitized.json` files in `data/policies/`.

**Current pre-digitized files:**
- `cigna_infliximab_digitized.json` -- pre-digitized and ready
- UHC policy exists as raw text (`uhc_infliximab.txt`) but does not have a pre-digitized JSON file. It can be digitized on-demand via the policy digitizer API endpoint.

### 6.4 Historical Data
`data/historical_pa_cases.json` -- Historical prior authorization cases used by the Strategic Intelligence Agent for pattern-based recommendations and approval rate analysis.

### 6.5 Strategy Templates
`data/strategies/templates.json` -- Strategy template definitions used by the strategy scorer for generating access strategies.

### 6.6 Decision Rubrics
`data/rubrics/default_rubric.md` -- Scoring rubric used by the policy reasoner to structure coverage assessment decisions.

---

## 7. System Architecture

### 7.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.10), async/await throughout |
| **Workflow Engine** | LangGraph (state machine with conditional edges) |
| **Frontend** | React 18 + TypeScript + Vite |
| **UI Framework** | Tailwind CSS + Framer Motion (glassmorphism design) |
| **Server State** | TanStack Query v5 with IndexedDB persistence |
| **Database** | SQLite + aiosqlite, async sessions via SQLAlchemy |
| **Real-time** | WebSocket (per-case subscriptions with reconnect) |
| **LLM Providers** | Claude (Anthropic), Gemini (Google), Azure OpenAI |

### 7.2 Backend Module Structure

```
backend/
  main.py                    # FastAPI app, lifespan, health check, CORS, global error handler
  config/
    settings.py              # Pydantic BaseSettings from .env (all credentials, model configs)
    logging_config.py        # Centralized structured logging (all logs -> ./tmp/)
  orchestrator/
    case_orchestrator.py     # LangGraph state machine (10 nodes, conditional routing)
    state.py                 # OrchestratorState TypedDict, create_initial_state()
    transitions.py           # Stage transition helpers, payer response checks
  agents/
    intake_agent.py          # Patient/medication validation, MCP calls
    policy_analyzer.py       # Coverage assessment orchestration
    strategy_generator.py    # Strategy generation driver
    action_coordinator.py    # Payer submission, status checks, recovery actions
    recovery_agent.py        # Appeal workflow, P2P scheduling
    strategic_intelligence_agent.py  # Historical pattern analysis
  reasoning/
    llm_gateway.py           # Task-based model routing with fallback chains
    claude_pa_client.py      # AsyncAnthropic, policy reasoning (NO FALLBACK)
    gemini_client.py         # Async Gemini, general tasks (Azure fallback)
    openai_client.py         # AsyncAzureOpenAI, fallback for general tasks
    policy_reasoner.py       # Coverage assessment with conservative decision model
    policy_digitizer.py      # PDF -> structured JSON policy digitization
    strategy_scorer.py       # Deterministic scoring algorithm (no LLM)
    prompt_loader.py         # Template loading with {variable} substitution
    rubric_loader.py         # Decision rubric loading
    json_utils.py            # Shared 3-step JSON extraction (direct/markdown/brace-counting)
  models/
    enums.py                 # CaseStage, PayerStatus, CoverageStatus, StrategyType, etc.
    case_state.py            # CaseState dataclass, PatientInfo, MedicationRequest
    coverage.py              # CoverageAssessment, CriterionAssessment, DocumentationGap
    strategy.py              # Strategy, StrategyScore, ScoringWeights, STRATEGY_TEMPLATES
    audit.py                 # DecisionEvent (with crypto chaining), AuditTrail
  storage/
    database.py              # Async engine, session factory, init_db()
    models.py                # SQLAlchemy ORM: CaseModel, DecisionEventModel, CaseStateSnapshotModel, PolicyCacheModel, StrategicIntelligenceCacheModel
    case_repository.py       # Async CRUD with versioning and snapshots
    audit_logger.py          # Immutable audit chain with signature verification
    waypoint_writer.py       # Intermediate reasoning output persistence
  api/routes/
    cases.py                 # Case CRUD, process, run-stage, approve-stage, human decision gate
    strategies.py            # Strategy scoring and templates
    policies.py              # Policy analysis, digitization, criteria lookup
    patients.py              # Patient data and document access (path traversal protected)
    validation.py            # NPI/ICD-10/medication validation via MCP
    activity.py              # AI activity feed
    websocket.py             # Per-case WebSocket subscriptions
  api/
    requests.py              # Pydantic request models (DecisionAction enum validation)
  mcp/
    mcp_client.py            # Unified MCP client (httpx async)
    npi_validator.py         # NPI Registry lookup (CMS public API)
    icd10_validator.py       # ICD-10 code validation (NLM clinical tables)
    cms_coverage.py          # CMS Medicare coverage database lookup
  mock_services/
    payer/
      payer_interface.py     # PayerGateway ABC
      cigna_gateway.py       # Cigna mock gateway (scenario-driven)
      uhc_gateway.py         # UHC mock gateway (scenario-driven)
    scenarios/
      scenario_manager.py    # 6 demo scenarios with payer behavior configs
```

### 7.3 Frontend Module Structure

```
frontend/src/
  App.tsx                    # Router, animated page transitions, cache restoration
  main.tsx                   # React entry, QueryClientProvider with IndexedDB persistence
  pages/
    Dashboard.tsx            # Case queue, workspace stats, AI activity feed
    CaseDetail.tsx           # Full case view with HITL wizard workflow
    NewCase.tsx              # Case creation wizard (patient + medication selection)
    Policies.tsx             # Policy library with digitization viewer
    Settings.tsx             # Demo scenario selector, system configuration
  components/
    domain/                  # PA-specific components (25+ components)
      AgentWorkflow.tsx      # LangGraph node visualization
      AIActivityFeed.tsx     # Real-time AI action stream
      AIAnalysisCard.tsx     # LLM analysis result display
      AIPerformanceCard.tsx  # LLM performance metrics
      CaseCard.tsx           # Case summary card
      CaseQueueCard.tsx      # Dashboard queue item
      CaseTimeline.tsx       # Stage progression timeline
      ChainOfThought.tsx     # LLM reasoning transparency
      CounterfactualPanel.tsx # What-if strategy comparison
      CoverageAssessment.tsx # Payer coverage detail view
      DecisionTrace.tsx      # Audit trail visualization
      DigitizedPolicyViewer.tsx # Structured policy criteria viewer
      DocumentationGaps.tsx  # Gap identification display
      ExtractedDataReview.tsx # AI-extracted data for human review
      HeroCTA.tsx            # Dashboard hero call-to-action
      PayerComparisonCard.tsx # Side-by-side payer comparison
      PayerStatusBadge.tsx   # Payer status indicator
      PolicyCard.tsx         # Policy summary card (glassmorphism)
      PolicyCriteriaAnalysis.tsx # Criteria-by-criteria breakdown
      PolicyCriteriaViewer.tsx   # Full criteria display
      PolicyMatchViewer.tsx  # Patient-to-criteria matching
      PolicyValidationCard.tsx   # Policy validation with digitized data
      ScoringRationale.tsx   # Strategy scoring breakdown
      StageIndicator.tsx     # Workflow stage progress
      StrategicIntelligence.tsx  # Historical intelligence panel
      StrategyComparison.tsx # Side-by-side strategy comparison
      WizardStep.tsx         # HITL wizard step container
      WizardStepper.tsx      # Multi-step wizard navigation
      WorkspaceStats.tsx     # Dashboard statistics
    ui/                      # Reusable components
      Badge.tsx, Button.tsx, Card.tsx, GlassPanel.tsx,
      Input.tsx, MetricCard.tsx, Progress.tsx, Select.tsx,
      Skeleton.tsx, AgentBadge.tsx
    layout/
      MainLayout.tsx         # Sidebar + header + content area
      Sidebar.tsx            # Navigation sidebar
      Header.tsx             # Top bar with breadcrumbs
    ErrorBoundary.tsx        # Global error boundary
  hooks/
    useCase.ts               # Single case data fetching
    useCases.ts              # Case list with pagination
    usePolicies.ts           # Policy data fetching
    useStrategies.ts         # Strategy scoring data
    useWebSocket.ts          # Real-time case updates (ref-based callbacks)
    usePatientData.ts        # Patient data/documents
    useDelayedNavigate.ts    # Unmount-safe delayed navigation
  services/
    api.ts                   # Central API client (timeout, error handling, 204 support)
    websocket.ts             # CaseWebSocket class (reconnect with timer leak protection)
  types/
    api.ts                   # API request/response types
    case.ts                  # Case state types
    coverage.ts              # Coverage assessment types
    strategy.ts              # Strategy types
  lib/
    constants.ts             # Endpoints, stages, query keys, agent colors
    animations.ts            # Framer Motion animation variants
    queryCache.ts            # TanStack Query cache configuration
    utils.ts                 # Utility functions (cn, etc.)
```

---

## 8. LangGraph Workflow (State Machine)

### 8.1 Workflow Stages

```
INTAKE -> POLICY_ANALYSIS -> [AWAITING_HUMAN_DECISION] -> STRATEGY_GENERATION
  -> STRATEGY_SELECTION -> ACTION_COORDINATION -> MONITORING -> [RECOVERY]
  -> COMPLETED / FAILED
```

### 8.2 Node Descriptions

| Node | Purpose | Key Logic |
|------|---------|-----------|
| `intake` | Validate patient & medication data | Returns error if missing |
| `policy_analysis` | Analyze payer policies via Claude | Calls `PolicyReasoner.assess_coverage()` per payer, checks if human decision required |
| `human_decision_gate` | Mandatory human checkpoint | Pauses workflow (routes to `END`); resumes via `resume_after_human_decision()` |
| `strategy_generation` | Generate access strategies | Uses `StrategyScorer.generate_strategies()` (deterministic) |
| `strategy_selection` | Score and rank strategies | Uses `StrategyScorer.select_best_strategy()` (weighted formula) |
| `action_coordination` | Execute payer submissions | Calls `ActionCoordinator.execute_next_action()` |
| `monitoring` | Track payer responses | Checks status per payer, enforces max 10 iterations loop guard |
| `recovery` | Handle denials/appeals | Selects recovery option (appeal, P2P, document chase), executes via action coordinator |
| `completion` | Finalize successful case | Marks case complete with outcome |
| `failure` | Handle case failure | Records error, marks failed |

### 8.3 Conditional Routing

| From | Condition | Routes To |
|------|-----------|-----------|
| `policy_analysis` | `requires_human_decision` | `human_decision_gate` or `strategy_generation` |
| `human_decision_gate` | Human action | `strategy_generation` (approved), `END` (waiting), `failure` (rejected) |
| `action_coordination` | Error / recovery / normal | `failure`, `recovery`, or `monitoring` |
| `monitoring` | Complete / recovery / continue | `completion`, `recovery`, or `action_coordination` (max 10 loops) |
| `recovery` | Error / complete / normal | `failure`, `completion`, or `monitoring` |

### 8.4 State Definition (`OrchestratorState`)

A `TypedDict` with accumulating lists via `Annotated[List, add]`:
- **Identity:** `case_id`, `patient_id`
- **Stage tracking:** `stage`, `previous_stage`
- **Data:** `patient_data`, `medication_data`, `payers`
- **Analysis:** `coverage_assessments`, `documentation_gaps`
- **Strategy:** `available_strategies`, `strategy_scores`, `selected_strategy`, `strategy_rationale`
- **Actions:** `current_action`, `pending_actions`, `completed_actions` (accumulates)
- **Human gate:** `requires_human_decision`, `human_decision`, `human_decisions`
- **Recovery:** `recovery_needed`, `recovery_reason`, `recovery_strategy`
- **Control:** `monitoring_iterations` (loop guard), `is_complete`, `final_outcome`
- **Messages:** `messages` (accumulates across all nodes)

---

## 9. LLM Integration

### 9.1 Multi-Model Architecture

The platform uses three LLM providers, each serving specific roles:

| Provider | Model | Role | Async Client |
|----------|-------|------|-------------|
| **Claude** (Anthropic) | `claude-sonnet-4-20250514` | Clinical policy reasoning, appeal strategy | `AsyncAnthropic` with 60s timeout |
| **Gemini** (Google) | `gemini-3-pro-preview` | Data extraction, summarization, notifications, policy digitization | `generate_content_async` with 60s timeout |
| **Azure OpenAI** | `gpt-4o` | Fallback for general tasks | `AsyncAzureOpenAI` with 60s timeout |

### 9.2 Task-Based Routing (`LLMGateway`)

| Task Category | Provider Chain | Fallback |
|---------------|---------------|----------|
| `POLICY_REASONING` | Claude ONLY | **No fallback** -- error propagates |
| `APPEAL_STRATEGY` | Claude ONLY | **No fallback** -- error propagates |
| `APPEAL_DRAFTING` | Gemini | Azure OpenAI |
| `SUMMARY_GENERATION` | Gemini | Azure OpenAI |
| `DATA_EXTRACTION` | Gemini | Azure OpenAI |
| `NOTIFICATION` | Gemini | Azure OpenAI |

**Key principle:** Claude is locked-in for clinical reasoning tasks. `ClaudePolicyReasoningError` propagates immediately without attempting any fallback. This ensures clinical accuracy is never compromised by model substitution.

### 9.3 Claude PA Client

- **No fallback** -- `ClaudePolicyReasoningError` is a hard failure
- Temperature 0.0 for deterministic clinical reasoning
- Tenacity retry: 3 attempts with exponential backoff on `APIConnectionError` and `RateLimitError`
- Retry wraps the raw `_make_api_call()` method, not the error-handling wrapper
- Max tokens: 8192

### 9.4 Gemini Client

- Primary model for non-clinical tasks
- Tenacity retry: 2 attempts with exponential backoff on Google SDK exceptions (`GoogleAPIError`, `ServiceUnavailable`, `TooManyRequests`, `DeadlineExceeded`)
- Max output tokens: 65536

### 9.5 Azure OpenAI Client

- Fallback for Gemini failures on general tasks
- Tenacity retry: 2 attempts on `APIConnectionError` and `RateLimitError`
- Max output tokens: 4096

### 9.6 JSON Response Parsing

All LLM clients share `json_utils.extract_json_from_text()` -- a robust 3-step parser:
1. Direct JSON parse
2. Markdown code block extraction (`\`\`\`json ... \`\`\``)
3. Brace-counting parser (handles nested JSON with trailing text)

### 9.7 Conservative Decision Model

The `PolicyReasoner` applies Anthropic's conservative decision pattern:
- AI **never** recommends DENY -- `NOT_COVERED` is mapped to `REQUIRES_HUMAN_REVIEW`
- Low confidence (< 0.3 likelihood) triggers `REQUIRES_HUMAN_REVIEW`
- Borderline `UNKNOWN` with low likelihood also triggers human review
- Only `APPROVE` or `PEND` (needs documentation) can proceed without human intervention

---

## 10. Human-in-the-Loop (HITL) Design

### 10.1 Decision Gate Pattern

The `AWAITING_HUMAN_DECISION` stage implements a mandatory human checkpoint:

1. **Policy analysis** completes and identifies coverage status
2. If any payer returns `NOT_COVERED`, `REQUIRES_HUMAN_REVIEW`, or low confidence: the workflow **pauses**
3. The LangGraph node routes to `END`, stopping execution
4. Frontend renders the decision gate UI with coverage details and AI recommendation
5. Human reviewer can: **Approve**, **Reject**, **Override**, or **Escalate**
6. Decision is submitted via `POST /api/v1/cases/{case_id}/confirm-decision`
7. Backend calls `resume_after_human_decision()` which builds a continuation graph and continues processing

### 10.2 Decision Actions

| Action | Effect |
|--------|--------|
| `approve` | Continue to strategy generation |
| `reject` | Mark case as failed with reason |
| `override` | Continue with human-specified override status |
| `escalate` | Keep case paused, flag for senior review |

### 10.3 Decision Recording

All human decisions are:
- Validated via `DecisionAction` enum (Pydantic, returns 422 on invalid values)
- Stored in `human_decisions` list in case state (persisted in `CaseModel`)
- Logged in the immutable audit trail with reviewer ID, timestamp, and reason
- Available for chain integrity verification

---

## 11. Strategy Scoring

### 11.1 Deterministic Algorithm (No LLM)

Strategy scoring is **purely algorithmic** for auditability. Same inputs always produce same outputs.

**Formula:**
```
Score = (
  weights.speed * speed_score +
  weights.approval * adjusted_approval +
  weights.low_rework * (10 - rework_risk) +
  weights.patient_burden * (10 - patient_burden)
)
```

### 11.2 Score Adjustments

| Factor | Adjustment |
|--------|-----------|
| First payer approval likelihood | `(likelihood - 0.5) * 4` added to approval score |
| Critical documentation gaps | `-0.5` per gap from approval score |
| Unsatisfied step therapy | `-2.0` from approval score |

### 11.3 Strategy Constraint

**Only `SEQUENTIAL_PRIMARY_FIRST` strategies are valid** (COB compliance):
- Never submit primary and secondary in parallel
- Never submit to secondary before primary
- Payer sequence is always: Primary -> wait for decision -> Secondary -> COB coordination

---

## 12. Audit & Transparency

### 12.1 Immutable Audit Chain

Every decision is recorded as a `DecisionEvent` with:
- **Cryptographic chaining:** Each event's signature includes the previous event's signature
- **Input hashing:** SHA-256 hash of input data for tamper detection
- **Alternatives recorded:** What other options were considered
- **Actor tracking:** System vs. human decisions
- **Chain verification:** `verify_chain_integrity()` validates the entire audit chain

### 12.2 Event Types

```
CASE_CREATED -> STAGE_CHANGED -> POLICY_ANALYZED -> STRATEGY_GENERATED
  -> STRATEGY_SELECTED -> ACTION_EXECUTED -> PAYER_RESPONSE
  -> RECOVERY_INITIATED -> CASE_COMPLETED / ERROR_OCCURRED
```

### 12.3 State Snapshots

`CaseStateSnapshotModel` records full state snapshots at every version change, enabling point-in-time reconstruction of any case state.

---

## 13. MCP Integration (External Validation)

The platform uses Model Context Protocol for external healthcare validation:

| Service | Endpoint | Purpose |
|---------|----------|---------|
| **NPI Registry** | CMS NPI API | Validate provider NPI numbers |
| **ICD-10 Codes** | NLM Clinical Tables | Validate diagnosis codes |
| **CMS Coverage** | Medicare Coverage DB | Lookup Medicare policy references |

Implemented via `backend/mcp/mcp_client.py` (async httpx client) with per-service configuration. Lifecycle managed in the FastAPI lifespan handler.

---

## 14. Mock Payer Gateways

### 14.1 Gateway Architecture

Both `CignaGateway` and `UHCGateway` implement the `PayerGateway` ABC. Behavior is **scenario-driven** -- responses change based on the active scenario.

### 14.2 Demo Scenarios

| Scenario | Cigna Behavior | UHC Behavior | Expected Outcome |
|----------|---------------|-------------|-----------------|
| `HAPPY_PATH` | Approve | Approve | Both approved, treatment begins |
| `MISSING_DOCS` | Approve | Request TB screening | Approval after document submission |
| `PRIMARY_DENY` | Deny (step therapy) | Approve | Recovery via appeal |
| `SECONDARY_DENY` | Approve | Biosimilar redirect | Formulary exception handling |
| `RECOVERY_SUCCESS` | Deny then approve appeal | Approve | Full appeal workflow demo |
| `DUAL_APPROVAL` | Slow approval | Fast approval | Strategy scoring comparison |

Scenarios are switchable via API: `POST /api/v1/scenarios/{scenario_id}`

---

## 15. Prompt Management

All prompts are externalized as `.txt` files in the `/prompts` directory, loaded at runtime via `PromptLoader` with `{variable_name}` placeholder substitution.

### 15.1 Prompt Inventory

```
prompts/
  system/
    clinical_reasoning_base.txt    # Claude system prompt for policy reasoning
    policy_interpretation.txt      # Policy interpretation guidelines
  policy_analysis/
    coverage_assessment.txt        # Coverage eligibility assessment
    gap_identification.txt         # Documentation gap detection
    policy_digitization.txt        # PDF -> structured JSON digitization
  strategy/
    strategy_generation.txt        # Access strategy generation
    counterfactual_analysis.txt    # What-if scenario evaluation (not yet called from workflow)
    strategic_intelligence.txt     # Historical pattern analysis
  appeals/
    appeal_strategy.txt            # Appeal strategy generation
    appeal_letter_draft.txt        # Appeal letter drafting
    peer_to_peer_prep.txt          # P2P review preparation (not yet called from workflow)
  general/
    summarize.txt                  # Text summarization
    extract_data.txt               # Structured data extraction
    draft_notification.txt         # Provider/patient notifications
```

### 15.2 Path Traversal Protection

The `PromptLoader` validates all paths using `Path.relative_to()` to prevent directory traversal attacks. The same protection is applied in `PolicyReasoner` for policy file loading and in all patient data endpoints.

---

## 16. Real-Time Communication

### 16.1 WebSocket Architecture

- **Per-case subscriptions:** `ws://<host>/ws/cases/{case_id}`
- **Protocol auto-detection:** `ws://` for HTTP, `wss://` for HTTPS (lazy `getWsBaseUrl()`)
- **Reconnection:** Exponential backoff (up to 5 attempts), timer leak protection
- **Message types:** `case_updated`, `stage_changed`, `strategy_selected`

### 16.2 Frontend Integration

The `useWebSocket` hook:
- Stores callbacks in `useRef` to prevent reconnection on every render
- Updates TanStack Query cache on incoming messages
- Invalidates related queries (cases list, strategies) on relevant updates
- Cleans up connections and timers on unmount

---

## 17. Security Measures

| Measure | Implementation |
|---------|---------------|
| **Error sanitization** | Global exception handler logs details server-side, returns generic message + error ID to client |
| **Path traversal protection** | `Path.relative_to()` validation in prompt loader, policy reasoner, and patient endpoints |
| **Input validation** | Pydantic models with enum validation (e.g., `DecisionAction` enum returns 422 on invalid values) |
| **No error leaking** | All route handlers return generic error messages, not `str(exception)` |
| **Human decision body** | Decision data sent in POST body, not query parameters |
| **Health check** | Returns `"degraded"` status when any LLM provider is down |
| **Database URL protection** | Only database type is logged, never the full connection URL |

---

## 18. Frontend Design

### 18.1 Design System

- **Glassmorphism** UI with backdrop blur and subtle transparency
- **Framer Motion** page transitions and micro-interactions
- **Apple-inspired** spring/ease animations
- **Agent color coding:** Each AI agent has a consistent color (blue=intake, purple=policy, green=strategy, orange=coordination, red=recovery)

### 18.2 Key Pages

| Page | Purpose |
|------|---------|
| **Dashboard** | Case queue, workspace stats, AI activity feed, hero CTA |
| **CaseDetail** | Full HITL wizard workflow (step-by-step stage execution with approve/reject gates) |
| **NewCase** | Patient selection, medication request, payer configuration |
| **Policies** | Policy library browser with digitized criteria viewer |
| **Settings** | Demo scenario selector, system configuration |

### 18.3 Central API Client

All API calls use `services/api.ts` with:
- 30-second default timeout (2 minutes for LLM-backed endpoints)
- `AbortController` for request cancellation
- Typed error responses (`ApiRequestError` with retry hints)
- 204 No Content handling
- Consistent error normalization across all components

---

## 19. Database Schema

### 19.1 Tables

| Table | Purpose | Key Indexes |
|-------|---------|------------|
| `cases` | Core case data (JSON columns for flexible schema) | `stage`, `updated_at` |
| `decision_events` | Immutable audit trail with crypto chaining | `case_id` |
| `case_state_snapshots` | Point-in-time state versioning | `case_id` |
| `policy_cache` | Cached digitized policy documents | `(payer_name, medication_name)` |
| `strategic_intelligence_cache` | Cached intelligence analysis results | `case_id`, `cache_key_hash` |

### 19.2 Case Model Columns

Core fields stored directly: `stage`, `requires_human_decision`, `human_decision_reason`, `strategy_rationale`, `error_message`

JSON columns for flexible schema: `patient_data`, `medication_data`, `payer_states`, `coverage_assessments`, `documentation_gaps`, `available_strategies`, `pending_actions`, `completed_actions`, `human_decisions`

---

## 20. API Endpoints

### 20.1 Case Management
- `GET /api/v1/cases` -- List cases with pagination
- `POST /api/v1/cases` -- Create new case
- `GET /api/v1/cases/{id}` -- Get case detail
- `POST /api/v1/cases/{id}/process` -- Process case (full workflow)
- `POST /api/v1/cases/{id}/run-stage/{stage}` -- Run single stage (HITL)
- `POST /api/v1/cases/{id}/approve-stage/{stage}` -- Approve stage (HITL)
- `POST /api/v1/cases/{id}/confirm-decision` -- Human decision gate
- `GET /api/v1/cases/{id}/decision-status` -- Check decision status
- `POST /api/v1/cases/{id}/select-strategy` -- Select strategy
- `GET /api/v1/cases/{id}/audit-trail` -- Get audit trail
- `GET /api/v1/cases/{id}/strategic-intelligence` -- On-demand strategic intelligence analysis
- `DELETE /api/v1/cases/{id}/strategic-intelligence/cache` -- Invalidate cached intelligence

### 20.2 Strategy & Policy
- `POST /api/v1/strategies/score` -- Score strategies for a case
- `GET /api/v1/strategies/templates` -- Get strategy templates
- `POST /api/v1/policies/analyze` -- Analyze policy coverage
- `GET /api/v1/policies/available` -- List available policies
- `GET /api/v1/policies/{payer}/{medication}` -- Get policy content
- `GET /api/v1/policies/{payer}/{medication}/digitized` -- Get digitized policy
- `GET /api/v1/policies/criteria/{payer}/{medication}` -- Get policy criteria

### 20.3 Supporting
- `GET /api/v1/patients/{id}/data` -- Get patient data
- `GET /api/v1/patients/{id}/documents` -- List patient documents
- `GET /api/v1/activity/recent` -- Get AI activity feed
- `POST /api/v1/validate/npi` -- Validate NPI number
- `POST /api/v1/validate/icd10` -- Validate ICD-10 codes
- `POST /api/v1/validate/cms-coverage` -- Search CMS Medicare coverage database
- `GET /api/v1/validate/health` -- Validation service health check

### 20.4 System
- `GET /health` -- Health check (returns `healthy` or `degraded`)
- `GET /api/v1/scenarios` -- List demo scenarios
- `POST /api/v1/scenarios/{id}` -- Set active scenario
- `WS /ws/cases/{id}` -- Real-time case updates

---

## 21. Testing

### 21.1 Test Suite

| Test File | Coverage |
|-----------|----------|
| `test_strategy_scoring.py` | Deterministic scoring algorithm, weight validation, adjustment calculations |
| `test_policy_loading.py` | Policy file loading, path resolution |
| `test_patient_data.py` | Patient data access, document listing |
| `test_scenario_manager.py` | Scenario switching, payer behavior mapping |
| `test_integration.py` | End-to-end workflow integration |
| `conftest.py` | Shared fixtures, test database setup |

### 21.2 Running Tests

```bash
source venv/bin/activate
pytest tests/ -v                # All tests
pytest tests/test_strategy_scoring.py  # Specific test
pytest --cov=backend tests/     # With coverage
```

---

## 22. Configuration

### 22.1 Environment Variables (`.env`)

```
# LLM Providers
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Database
DATABASE_URL=sqlite+aiosqlite:///./data/access_strategy.db

# Application
APP_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# Model Configuration
CLAUDE_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-3-pro-preview
```

### 22.2 Development Commands

```bash
# Backend
source venv/bin/activate
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm run dev    # Dev server on :3000, proxies /api to backend

# Production build
cd frontend && npm run build
```

---

## 23. Demo Flow / Script

See **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** for the full demo walkthrough including:
- Prerequisites and startup commands
- Happy path step-by-step (8 steps through the 5-step wizard)
- Scenario variations (missing docs, primary denial, recovery, biosimilar redirect, dual approval)
- Key talking points per stage
- Additional demo paths (Policy Library, Strategic Intelligence, Activity Feed)

---

## 24. Agentic Capabilities Demonstrated

### Goal Ownership
- Explicit outcome defined per case (speed-to-therapy + reimbursement success)
- System owns the end-to-end workflow, not individual tasks

### Planning & Reasoning
- Multi-payer policy analysis with coverage assessment
- Strategy generation with deterministic scoring
- Documentation gap identification and resolution planning

### Autonomous Decision-Making
- System commits to optimal strategy with transparent rationale
- Human override always available at decision gates
- Conservative model ensures AI never unilaterally denies

### Tool Use
- Live Claude API calls for clinical reasoning
- Gemini for data extraction and summarization
- Mock payer gateways with scenario-driven responses
- MCP integration for NPI/ICD-10/CMS validation

### Transparency & Explainability
- Chain-of-thought reasoning visible in UI
- Scoring breakdown with adjustment explanations
- Cryptographically chained audit trail
- Strategic intelligence with historical pattern analysis (on-demand via API)

### Recovery & Adaptation
- Automatic denial detection and recovery initiation
- Appeal strategy generation with Claude (no fallback)
- Recovery option scoring: written appeal, P2P review, document chase (deterministic selection)
- Appeal submission and tracking via mock payer gateways
- Scenario-driven demonstration of recovery workflows

---

## 25. What This Demo Explicitly Does NOT Claim

- No long-term learning loops
- No automated policy updates
- No replacement of EHR or hub systems
- No regulatory-ready submissions
- No production authentication/authorization layer
- No real payer integrations (mock gateways only)

**Code-complete but not yet integrated into workflow:**
- Counterfactual analysis (backend method + frontend panel exist, no API route exposes them)
- P2P review preparation prompt (file exists, not loaded by any code)
- UHC policy digitization (raw text available, no pre-digitized JSON cached yet)

This keeps the demo credible and honest.

---

## 26. Key Takeaway

This platform demonstrates that access operations can be:
- **Outcome-owned** -- the system pursues therapy access, not task completion
- **Strategy-driven** -- deterministic scoring with transparent rationale
- **Multi-payer aware** -- simultaneous reasoning across primary and secondary coverage
- **Explainable** -- every decision auditable with crypto-chained integrity
- **Human-supervised** -- mandatory checkpoints where AI cannot override clinical judgment
- **Immediately valuable** -- no training period, no historical data dependency

**Every case becomes a decision problem, not a checklist.**
