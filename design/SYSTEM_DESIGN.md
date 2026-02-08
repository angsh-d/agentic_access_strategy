# Agentic Access Strategy Platform - System Design

## Document Information
- **Version**: 1.5
- **Status**: Draft
- **Last Updated**: 2026-02-08
- **Changes**:
  - v1.5: **LLM-First Policy Evaluation** — Replaced deterministic evaluator with Claude-driven per-criterion assessment. Added Section 3.2.1 (LLM-First Coverage Assessment Architecture), updated prompt architecture, added policy digitalization pipeline to project structure, added conservative decision model, added criterion_id alignment protocol
  - v1.4: Added "Why Agentic AI?" differentiation section, elevated agentic capabilities to Executive Summary, added Demo Walkthrough section, added "Judgment Under Uncertainty" design principle
  - v1.3: Critical review - fixed section numbering, scoring consistency, added provenance for architectural decisions, added missing implementations
  - v1.2: Updated tech stack to React/Tailwind frontend, FastAPI backend; Added Apple-inspired UI/UX design system
  - v1.1: Added LLM-First Architecture principle, multi-model configuration (Claude PA Skill + Gemini primary + GPT fallback)

---

## 1. Executive Summary

This document defines the system architecture for an **Agentic Access Decision Platform** that autonomously reasons across multiple payer policies, selects optimal access strategies, and coordinates actions to maximize speed-to-therapy and reimbursement success.

### Design Principles

1. **LLM-First Architecture**: Design all reasoning, analysis, and generation tasks to leverage LLM capabilities as the primary mechanism. Traditional rule-based logic serves only as guardrails, validation, and deterministic scoring. The system assumes LLMs are the core intelligence layer, not an afterthought.

2. **Clinical Defensibility First**: Every decision must be traceable to policy criteria and clinical evidence

3. **Deterministic Scoring, LLM-First Evaluation**: Strategy scoring is deterministic (same inputs = same outputs) for auditability. Policy criterion evaluation is LLM-first — Claude assesses each criterion with structured reasoning, confidence scores, and evidence citations. The deterministic evaluator has been removed in favor of direct LLM assessment with criterion_id alignment.

4. **Human-in-the-Loop**: Autonomous action with transparent override capability

5. **Separation of Concerns**: Claude PA Skill handles policy reasoning; orchestrator handles strategy coordination; auxiliary LLMs handle generation tasks

6. **Fail-Safe Design**: Graceful degradation with model fallback, never silent failures

7. **Model Specialization**: Use purpose-built models for specific tasks - Claude for clinical policy reasoning, Gemini/GPT for general generation and analysis

8. **Judgment Under Uncertainty**: The system makes informed decisions with incomplete information, quantifies uncertainty through confidence scores, and escalates to humans when confidence is low. Unlike rule-based systems that halt on ambiguity, agentic systems reason through uncertainty and act proportionally to their confidence level.

### Agentic Capabilities at a Glance

This platform demonstrates true agentic AI capabilities—not just task automation, but autonomous reasoning, planning, and adaptation:

| Agentic Capability | Where Demonstrated | Why It Matters |
|--------------------|-------------------|----------------|
| **Situational Awareness** | Denial classification (Section 12) | Recognizes context and adapts behavior based on situation type |
| **Autonomous Decision-Making** | Strategy selection (Section 11) | Evaluates trade-offs and selects optimal approach without human prompting |
| **Adaptive Re-planning** | Failure recovery (Section 12) | When plans fail, autonomously generates and executes new strategies |
| **Parallel Execution** | Multi-payer analysis (Section 3.1) | Coordinates concurrent workflows across multiple systems |
| **Human-in-Loop Escalation** | Override patterns (Section 7) | Knows when to ask for help vs. proceed autonomously |
| **Explainable Reasoning** | Decision trace (Section 6.3) | Every decision traceable with full rationale |
| **Counterfactual Analysis** | Strategy comparison (Section 14) | Shows "what would have happened" under alternative choices |
| **Judgment Under Uncertainty** | Confidence scoring throughout | Acts on incomplete information with calibrated confidence |

---

## 1.1 Why Agentic AI? (Differentiation from Traditional Automation)

This section explicitly contrasts the Agentic Access Platform with traditional prior authorization automation to clarify the value proposition.

### Traditional PA Automation

| Aspect | Traditional Approach | Limitation |
|--------|---------------------|------------|
| **Decision Logic** | Rule-based decision trees | Cannot handle novel situations; requires manual rule updates |
| **Workflow** | Fixed, linear workflows | One path through the process; no adaptation |
| **Exception Handling** | Human handles all exceptions | Bottleneck at every deviation from expected path |
| **Trade-off Analysis** | None | Follows rules without considering alternatives |
| **Failure Recovery** | Alert and wait for human | System stops at first obstacle |
| **Explainability** | Log files and status codes | No reasoning, just execution records |

### Agentic Access Platform

| Aspect | Agentic Approach | Advantage |
|--------|-----------------|-----------|
| **Decision Logic** | Policy-aware reasoning (Claude PA Skill) | Interprets policy language, handles edge cases, reasons through ambiguity |
| **Workflow** | Dynamic strategy selection with scoring | Evaluates 3+ strategies, selects optimal based on case context |
| **Exception Handling** | Autonomous failure recovery | Classifies denials, re-plans, executes recovery without human intervention |
| **Trade-off Analysis** | Counterfactual reasoning | Shows stakeholders what would happen under alternative strategies |
| **Failure Recovery** | Adaptive re-planning | Generates new strategies when original plan fails |
| **Explainability** | Full decision trace with rationale | Every decision documented with inputs, reasoning, and alternatives considered |

### The Core Differentiation

> **Traditional automation asks**: "Did I follow the rules correctly?"
>
> **Agentic AI asks**: "What is the best decision given everything I know, and how confident am I?"

This platform demonstrates **judgment, planning, and orchestration**—not just workflow execution. The system:

1. **Reasons** about policy requirements using Claude PA Skill with per-criterion LLM assessment
2. **Plans** optimal access strategies using deterministic scoring informed by LLM confidence scores
3. **Adapts** when encountering obstacles (denials, missing documentation)
4. **Explains** every decision with full provenance — criterion-level reasoning, confidence, and evidence citations

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  React/Tailwind │  │  API Gateway    │  │  Notification Service       │  │
│  │  (Apple-style)  │  │  (FastAPI)      │  │  (SMS/Email/Slack)          │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  │
└───────────┼─────────────────────┼─────────────────────────┼─────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATION LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    CASE ORCHESTRATOR (LangGraph)                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │  Intake  │─▶│  Policy  │─▶│ Strategy │─▶│  Action  │            │    │
│  │  │  Agent   │  │ Analyzer │  │ Selector │  │Coordinator│            │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │    │
│  │       │              │             │             │                  │    │
│  │       ▼              ▼             ▼             ▼                  │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │              STATE MANAGER (Case Context)                     │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REASONING LAYER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Claude Policy  │  │  Strategy       │  │  LLM Gateway                │  │
│  │  Reasoner       │  │  Scorer         │  │  (Multi-Model)              │  │
│  │ (LLM-First Eval)│  │  (Deterministic)│  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                                     │                        │
│                              ┌──────────────────────┴──────────────────────┐ │
│                              │  ┌─────────────┐      ┌─────────────┐       │ │
│                              │  │ Gemini 3    │      │ GPT-5 Mini  │       │ │
│                              │  │ Pro Preview │      │ (Fallback)  │       │ │
│                              │  │ (Primary)   │      │             │       │ │
│                              │  └─────────────┘      └─────────────┘       │ │
│                              └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Policy Store   │  │  Case State DB  │  │  Audit Log                  │  │
│  │  (Cached PDFs)  │  │  (SQLite/PG)    │  │  (Immutable)                │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION LAYER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Payer APIs     │  │  Provider APIs  │  │  EHR Connectors             │  │
│  │  (Mock/Real)    │  │  (Mock/Real)    │  │  (Mock)                     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Case Orchestrator (LangGraph)

The central coordination engine that manages case lifecycle and agent interactions.

#### State Machine Definition

```python
from enum import Enum
from typing import Optional, List
from dataclasses import dataclass, field
from datetime import datetime

class CaseStage(Enum):
    INTAKE = "intake"
    POLICY_ANALYSIS = "policy_analysis"
    STRATEGY_GENERATION = "strategy_generation"
    STRATEGY_SELECTION = "strategy_selection"
    ACTION_COORDINATION = "action_coordination"
    MONITORING = "monitoring"
    RECOVERY = "recovery"
    COMPLETED = "completed"
    FAILED = "failed"

class PayerStatus(Enum):
    NOT_STARTED = "not_started"
    SUBMITTED = "submitted"
    PENDING_INFO = "pending_info"
    APPROVED = "approved"
    DENIED = "denied"
    APPEALED = "appealed"

@dataclass
class CaseState:
    """Immutable case state - all changes create new versions"""
    case_id: str
    version: int
    stage: CaseStage

    # Patient & Therapy
    patient_id: str
    therapy_code: str
    therapy_name: str
    indication: str
    site_of_care: str

    # Payer Information
    primary_payer: str
    primary_payer_status: PayerStatus
    primary_payer_submission_id: Optional[str] = None
    secondary_payer: Optional[str] = None
    secondary_payer_status: PayerStatus = PayerStatus.NOT_STARTED
    secondary_payer_submission_id: Optional[str] = None

    # Policy Analysis Results
    primary_coverage_assessment: Optional[dict] = None
    secondary_coverage_assessment: Optional[dict] = None
    documentation_gaps: List[str] = field(default_factory=list)

    # Strategy
    available_strategies: List[dict] = field(default_factory=list)
    selected_strategy_id: Optional[str] = None
    strategy_rationale: Optional[str] = None

    # Actions
    pending_actions: List[dict] = field(default_factory=list)
    completed_actions: List[dict] = field(default_factory=list)

    # Audit
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    decision_trace: List[dict] = field(default_factory=list)
```

#### Stage Transition Graph

```
                    ┌─────────────┐
                    │   INTAKE    │
                    └──────┬──────┘
                           │
              [Patient & payer verified]
                           │
                           ▼
              ┌────────────────────────┐
              │    POLICY_ANALYSIS     │
              │  (Parallel: P1 + P2)   │
              └───────────┬────────────┘
                          │
              [Both policies analyzed]
                          │
                          ▼
              ┌────────────────────────┐
              │  STRATEGY_GENERATION   │
              │  (Generate 3 options)  │
              └───────────┬────────────┘
                          │
              [Strategies scored]
                          │
                          ▼
              ┌────────────────────────┐
              │  STRATEGY_SELECTION    │
              │  (Pick optimal + log)  │
              └───────────┬────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
[Human override requested]        [Auto-select highest]
          │                               │
          ▼                               ▼
   ┌─────────────┐               ┌─────────────────┐
   │HUMAN_REVIEW │──[Approved]──▶│ACTION_COORDINATE│
   └─────────────┘               └────────┬────────┘
                                          │
                              [Actions dispatched]
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │   MONITORING    │◀──────┐
                                 └────────┬────────┘       │
                                          │                │
                    ┌─────────────────────┼────────────────┤
                    │                     │                │
             [Approved]            [Denied/Error]    [Pending]
                    │                     │                │
                    ▼                     ▼                │
           ┌─────────────┐       ┌─────────────┐          │
           │  COMPLETED  │       │  RECOVERY   │──────────┘
           └─────────────┘       └──────┬──────┘
                                        │
                                [Recovery failed]
                                        │
                                        ▼
                                 ┌─────────────┐
                                 │   FAILED    │
                                 └─────────────┘
```

### 3.2 Claude Policy Reasoner

The LLM component responsible for clinical and policy reasoning.

#### Interface Contract

```python
from pydantic import BaseModel
from typing import List, Literal

class CriterionAssessment(BaseModel):
    criterion_id: str
    criterion_text: str
    status: Literal["met", "not_met", "unclear", "not_applicable"]
    evidence: str
    confidence: float  # 0.0 - 1.0
    source_location: str  # Page/section in policy

class CoverageAssessment(BaseModel):
    payer: str
    policy_version: str
    therapy: str
    indication: str

    # Overall determination
    overall_status: Literal["likely_approved", "likely_denied", "needs_review"]
    overall_confidence: float

    # Criterion-level breakdown
    criteria_assessments: List[CriterionAssessment]

    # Gaps
    missing_documentation: List[str]
    missing_clinical_evidence: List[str]

    # Supporting artifacts
    medical_necessity_summary: str
    appeal_considerations: str  # If denial likely, what to argue

    # Audit
    reasoning_trace: str  # Step-by-step reasoning
    model_version: str
    timestamp: str

class AppealStrategy(BaseModel):
    """
    Clinical appeal strategy generated by Claude PA Skill.
    Used as input to LLM Gateway for appeal letter drafting.
    """
    denial_reason_code: str
    denial_reason_text: str

    # Clinical arguments (Claude's reasoning)
    primary_argument: str                    # Main clinical justification
    supporting_arguments: List[str]          # Additional clinical points
    evidence_citations: List[dict]           # {"source": "...", "quote": "...", "relevance": "..."}
    medical_necessity_summary: str           # Why therapy is necessary

    # Regulatory/policy references
    policy_sections_to_cite: List[str]       # Policy sections that support approval
    clinical_guidelines: List[str]           # ACG, AGA, etc. guidelines
    supporting_literature: List[dict]        # Peer-reviewed studies

    # Recommended approach
    recommended_appeal_type: Literal["standard", "expedited", "peer_to_peer"]
    urgency_justification: Optional[str]     # For expedited appeals

    # Confidence
    success_probability: float               # 0.0 - 1.0
    reasoning_trace: str

class PolicyReasonerInterface:
    """Abstract interface for policy reasoning"""

    async def analyze_coverage(
        self,
        policy_text: str,
        patient_summary: dict,
        therapy_request: dict,
        prior_authorizations: List[dict] = None
    ) -> CoverageAssessment:
        """
        Analyze whether therapy meets payer coverage criteria.

        Args:
            policy_text: Full text of payer policy document
            patient_summary: Structured patient clinical data
            therapy_request: Therapy details (drug, dose, route, frequency)
            prior_authorizations: Previous PA attempts if any

        Returns:
            CoverageAssessment with criterion-level breakdown
        """
        pass

    async def generate_appeal_strategy(
        self,
        denial_reason: str,
        coverage_assessment: CoverageAssessment,
        patient_summary: dict,
        supporting_literature: List[str] = None
    ) -> AppealStrategy:
        """
        Generate appeal STRATEGY with clinical arguments (Claude PA Skill).

        This method identifies the clinical arguments to make, evidence to cite,
        and medical necessity justification. The actual appeal LETTER drafting
        is handled by LLM Gateway (Gemini/GPT) using this strategy as input.

        Returns:
            AppealStrategy with structured arguments and evidence citations
        """
        pass
```

#### Prompt Architecture

Prompts are stored in `/prompts/` directory with parameter substitution:

```
/prompts/
├── policy_analysis/
│   ├── coverage_assessment.txt       # Main coverage analysis prompt
│   ├── criterion_evaluation.txt      # Per-criterion evaluation
│   └── gap_identification.txt        # Missing documentation finder
├── strategy/
│   ├── strategy_generation.txt       # Generate access strategies
│   └── counterfactual_analysis.txt   # What-if scenarios
├── appeals/
│   ├── appeal_letter_template.txt    # Appeal letter generation
│   └── peer_to_peer_prep.txt         # P2P talking points
└── system/
    ├── clinical_reasoning_base.txt   # Base clinical reasoning instructions
    └── policy_interpretation.txt     # How to interpret payer policies
```

**Example: `coverage_assessment.txt`** (v1.5 — LLM-First with Criterion ID Alignment)

```text
You are a clinical policy analyst specializing in prior authorization
requirements for specialty medications.

## Patient Information
{patient_info}

## Medication Requested
{medication_info}

## Payer Policy Document
{policy_document}

## Decision Rubric
{decision_rubric}

## Digitized Policy Criteria Structure
{policy_criteria}
← Includes atomic criteria with IDs, types, thresholds, durations,
   exclusion criteria, step therapy requirements, and criterion groups.

## CRITICAL: Criterion ID Alignment Rules
1. Use EXACT criterion_id values from the digitized criteria above.
2. Evaluate EVERY criterion listed. Do not skip any.
3. Exclusion criteria: is_met=true means exclusion IS triggered.
4. [REQUIRED] criteria are mandatory for approval.
5. [EXTRACTION: low/unconfident] — cross-reference with raw policy.
6. Duration requirements: verify against exact threshold.
7. Requirements NOT in structured criteria: use ADDITIONAL_ prefix.

## CRITICAL: Conservative Decision Model
YOU MUST NEVER RECOMMEND DENIAL.
- AI recommends APPROVE or PEND only
- NOT_COVERED → requires_human_review
- Low confidence → requires_human_review

## Output Format
Return JSON with: coverage_status, approval_likelihood,
criteria_assessments[{criterion_id, is_met, confidence, reasoning, ...}],
documentation_gaps, step_therapy_*, recommendations
```

#### 3.2.1 LLM-First Coverage Assessment Architecture (v1.5)

The system uses an **LLM-first** approach for policy criterion evaluation. The previous deterministic evaluator (~1500 lines of brittle pattern-matching code) has been removed. Claude now directly evaluates each criterion using the digitized policy structure.

**Architecture**:
```
Digitized Policy (AtomicCriteria + CriterionGroups + Exclusions)
       │
       ▼
PolicyReasoner._format_policy_criteria()  ← Formats all criteria with IDs,
       │                                     thresholds, durations, codes
       ▼
coverage_assessment.txt prompt            ← Includes structured criteria +
       │                                     criterion_id alignment rules
       ▼
Claude (temp=0.0)                         ← Evaluates EACH criterion by ID
       │                                     Returns is_met, confidence, reasoning
       ▼
PolicyReasoner._parse_assessment()        ← Validates criterion_ids against
       │                                     digitized policy, logs mismatches
       ▼
CoverageAssessment                        ← Per-criterion results with evidence
       │
       ▼
Frontend (PolicyValidationCard)           ← Displays LLM results by criterion_id
                                             No client-side evaluation
```

**Key Design Decisions**:

| Decision | Rationale |
|----------|-----------|
| **Remove deterministic evaluator** | Failed on BCBS drugs (e.g., "SMA Diagnosis: Not Met" for G12.1 patients). Could not handle cross-payer policy variations without per-payer hardcoding. |
| **Pass digitized criteria to Claude** | Claude gets exact criterion_ids, types, thresholds, and clinical codes — ensuring alignment between policy structure and assessment output. |
| **Criterion_id alignment protocol** | Prompt requires Claude to echo exact criterion_ids. Backend validates returned IDs against policy. Mismatches are logged for monitoring. |
| **Include exclusion criteria** | Safety exclusions (contraindications, pregnancy, active cancer) must be evaluated — omitting them risks unsafe coverage recommendations. |
| **Include step therapy details** | Drug names, classes, minimum trial durations, and failure/intolerance rules are passed so Claude can accurately assess prior treatment history. |
| **Conservative decision model** | Claude NEVER recommends denial. `NOT_COVERED` maps to `REQUIRES_HUMAN_REVIEW`. Low confidence triggers human review. |
| **Frontend shows "Pending AI Analysis"** | Before analysis runs, all criteria show neutral "Pending" state — no client-side guessing. |
| **Graceful degradation** | If digitized policy unavailable, Claude works from raw policy text alone with generated criterion_ids. |

**Criterion_id Validation Flow** (in `_parse_assessment`):
1. Build set of known IDs from `digitized_policy.atomic_criteria.keys()`
2. For each LLM-returned assessment, check if `criterion_id` exists in known set
3. Log warnings for unknown IDs (hallucinated or paraphrased)
4. Log warnings for policy criteria NOT evaluated by LLM
5. Frontend maps `criterion_id → assessment` for display; unmatched criteria show "Pending"

**Fields passed to Claude per criterion**:
- `criterion_id`, `name`, `type`, `category`, `description`, `policy_text`
- `clinical_codes` (ICD-10, HCPCS, CPT)
- `threshold_value`, `threshold_value_upper`, `threshold_unit`, `comparison_operator`
- `minimum_duration_days` (step therapy)
- `drug_names`, `drug_classes`, `allowed_values`
- `is_required` flag (`[REQUIRED]`/`[OPTIONAL]`)
- `extraction_confidence` (`[EXTRACTION: low/unconfident]`)
- `evidence_types` (acceptable evidence)

#### Determinism & Reproducibility

To ensure consistent outputs for auditability:

```python
CLAUDE_PA_CONFIG = {
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.0,  # Deterministic for clinical reasoning
    "max_tokens": 8192,
    "seed": 42,  # Fixed seed for reproducibility
    "response_format": {"type": "json_object"}
}
```

### 3.3 LLM Gateway (Multi-Model Architecture)

The system employs a multi-model architecture with specialized LLMs for different task categories.

#### Model Configuration

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional

class LLMProvider(Enum):
    CLAUDE = "claude"          # Policy reasoning (PA Skill)
    GEMINI = "gemini"          # Primary for general tasks
    OPENAI = "openai"          # Fallback for general tasks

class TaskCategory(Enum):
    # Claude PA Skill exclusive - no fallback, clinical accuracy critical
    POLICY_REASONING = "policy_reasoning"      # Coverage assessment, criterion analysis
    APPEAL_STRATEGY = "appeal_strategy"        # Clinical arguments, evidence selection

    # Gemini primary, GPT fallback - general generation tasks
    APPEAL_DRAFTING = "appeal_drafting"        # Letter writing from AppealStrategy
    SUMMARY_GENERATION = "summary_generation"  # Case summaries, status reports
    DATA_EXTRACTION = "data_extraction"        # Form filling, template population
    NOTIFICATION_DRAFTING = "notification"     # Patient/provider communications

@dataclass
class LLMConfig:
    provider: LLMProvider
    model_id: str
    temperature: float
    max_output_tokens: int
    timeout_seconds: int = 120
    retry_attempts: int = 3

# Model configurations
LLM_CONFIGS = {
    # Claude PA Skill - Policy reasoning ONLY
    "claude_pa": LLMConfig(
        provider=LLMProvider.CLAUDE,
        model_id="claude-sonnet-4-20250514",
        temperature=0.0,
        max_output_tokens=8192,
        timeout_seconds=180
    ),

    # Gemini - Primary for all non-policy tasks
    "gemini_primary": LLMConfig(
        provider=LLMProvider.GEMINI,
        model_id="gemini-3-pro-preview",
        temperature=0.1,
        max_output_tokens=65536,
        timeout_seconds=120
    ),

    # GPT - Fallback when Gemini fails
    "gpt_fallback": LLMConfig(
        provider=LLMProvider.OPENAI,
        model_id="gpt-5-mini",
        temperature=0.1,
        max_output_tokens=16384,
        timeout_seconds=120
    )
}

# Task-to-model routing
TASK_MODEL_ROUTING = {
    # Claude PA Skill exclusive - clinical accuracy critical, no fallback
    TaskCategory.POLICY_REASONING: ["claude_pa"],
    TaskCategory.APPEAL_STRATEGY: ["claude_pa"],

    # Gemini primary, GPT fallback - general generation tasks
    TaskCategory.APPEAL_DRAFTING: ["gemini_primary", "gpt_fallback"],
    TaskCategory.SUMMARY_GENERATION: ["gemini_primary", "gpt_fallback"],
    TaskCategory.DATA_EXTRACTION: ["gemini_primary", "gpt_fallback"],
    TaskCategory.NOTIFICATION_DRAFTING: ["gemini_primary", "gpt_fallback"],
}
```

#### LLM Gateway Implementation

```python
from abc import ABC, abstractmethod
import google.generativeai as genai
from openai import OpenAI
import anthropic

class LLMGateway:
    """
    Unified gateway for multi-model LLM invocations.
    Handles routing, fallback, and error recovery.
    """

    def __init__(self):
        self.claude_client = anthropic.Anthropic()
        self.gemini_client = self._init_gemini()
        self.openai_client = OpenAI()
        self.configs = LLM_CONFIGS

    async def invoke(
        self,
        task_category: TaskCategory,
        prompt: str,
        system_prompt: Optional[str] = None,
        structured_output: bool = False
    ) -> LLMResponse:
        """
        Route request to appropriate model with automatic fallback.

        Args:
            task_category: Determines which model(s) to use
            prompt: User prompt
            system_prompt: Optional system instructions
            structured_output: Whether to enforce JSON output

        Returns:
            LLMResponse with content and metadata
        """
        model_chain = TASK_MODEL_ROUTING[task_category]
        last_error = None

        for model_key in model_chain:
            config = self.configs[model_key]
            try:
                response = await self._call_model(
                    config, prompt, system_prompt, structured_output
                )
                return LLMResponse(
                    content=response,
                    model_used=config.model_id,
                    provider=config.provider.value,
                    was_fallback=(model_key != model_chain[0])
                )
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Model {config.model_id} failed, trying fallback",
                    error=str(e),
                    task=task_category.value
                )
                continue

        raise LLMInvocationError(
            f"All models failed for {task_category.value}",
            last_error=last_error
        )

    async def _call_model(
        self,
        config: LLMConfig,
        prompt: str,
        system_prompt: Optional[str],
        structured_output: bool
    ) -> str:
        """Dispatch to appropriate provider client."""
        if config.provider == LLMProvider.CLAUDE:
            return await self._call_claude(config, prompt, system_prompt)
        elif config.provider == LLMProvider.GEMINI:
            return await self._call_gemini(config, prompt, system_prompt)
        elif config.provider == LLMProvider.OPENAI:
            return await self._call_openai(config, prompt, system_prompt)

    async def _call_claude(
        self,
        config: LLMConfig,
        prompt: str,
        system_prompt: Optional[str]
    ) -> str:
        """Call Claude API for policy reasoning tasks."""
        messages = [{"role": "user", "content": prompt}]

        response = await self.claude_client.messages.create(
            model=config.model_id,
            max_tokens=config.max_output_tokens,
            temperature=config.temperature,
            system=system_prompt,
            messages=messages
        )
        return response.content[0].text

    async def _call_gemini(
        self,
        config: LLMConfig,
        prompt: str,
        system_prompt: Optional[str]
    ) -> str:
        """Call Gemini API."""
        model = genai.GenerativeModel(
            model_name=config.model_id,
            system_instruction=system_prompt
        )
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=config.temperature,
                max_output_tokens=config.max_output_tokens
            )
        )
        return response.text

    async def _call_openai(
        self,
        config: LLMConfig,
        prompt: str,
        system_prompt: Optional[str]
    ) -> str:
        """Call OpenAI API."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.openai_client.chat.completions.create(
            model=config.model_id,
            messages=messages,
            temperature=config.temperature,
            max_tokens=config.max_output_tokens
        )
        return response.choices[0].message.content

@dataclass
class LLMResponse:
    content: str
    model_used: str
    provider: str
    was_fallback: bool
    latency_ms: Optional[float] = None
```

#### Model Selection Rationale

| Task Category | Primary Model | Fallback | Rationale |
|---------------|---------------|----------|-----------|
| Policy Reasoning | Claude PA Skill | None | Specialized for clinical/policy analysis, no substitute. Deterministic at temp=0. |
| Appeal Strategy | Claude PA Skill | None | Clinical argument generation requires policy expertise. Produces `AppealStrategy` object. |
| Appeal Drafting | Gemini 3 Pro Preview | GPT-5 Mini | Letter drafting from `AppealStrategy`. 65K context for full case history. |
| Summary Generation | Gemini 3 Pro Preview | GPT-5 Mini | Fast, accurate summarization. Not clinically critical. |
| Data Extraction | Gemini 3 Pro Preview | GPT-5 Mini | Structured output reliability for forms/templates. |
| Notifications | Gemini 3 Pro Preview | GPT-5 Mini | Simple generation, either works. Low stakes. |

**Appeal Process Flow**:
```
1. Denial received → Claude PA Skill generates AppealStrategy (clinical arguments)
2. AppealStrategy → LLM Gateway (Gemini) drafts appeal letter using strategy
3. Draft reviewed → Human approval → Submission
```

This separation ensures clinical reasoning (Claude) is distinct from letter formatting (Gemini), maintaining auditability of the clinical logic.

### 3.4 Strategy Scorer (Deterministic Engine)

The strategy selection is **not** LLM-based - it uses a deterministic scoring algorithm for auditability.

#### Strategy Definition Schema

```python
@dataclass
class Strategy:
    strategy_id: str
    name: str
    description: str

    # Preconditions (all must be true)
    preconditions: List[str]

    # Execution plan
    actions: List[dict]

    # Scoring factors (normalized 0-10, higher = better for patient outcome)
    speed_score: float          # Higher = faster therapy (10 = immediate, 1 = very slow)
    approval_probability: float  # Higher = more likely to approve (10 = certain, 1 = unlikely)
    rework_risk: float          # Higher = MORE risk (10 = high risk, 1 = low risk) - inverted in scoring
    patient_burden: float       # Higher = MORE burden (10 = high burden, 1 = low burden) - inverted in scoring
    provider_burden: float      # Higher = MORE burden (10 = high burden, 1 = low burden) - for display only

    # Metadata
    applicable_to: List[str]    # Therapy types
    contraindicated_for: List[str]

# Pre-defined strategy templates
STRATEGY_TEMPLATES = {
    "SEQUENTIAL_PRIMARY_FIRST": Strategy(
        strategy_id="SEQUENTIAL_PRIMARY_FIRST",
        name="Sequential Submission (Primary First)",
        description="Submit to primary payer, await determination, then submit to secondary",
        preconditions=["has_dual_coverage", "no_urgent_timeline"],
        actions=[
            {"step": 1, "action": "submit_pa", "payer": "primary"},
            {"step": 2, "action": "await_determination", "payer": "primary"},
            {"step": 3, "action": "submit_pa", "payer": "secondary", "condition": "primary_approved"},
            {"step": 4, "action": "await_determination", "payer": "secondary"}
        ],
        speed_score=3.0,
        approval_probability=8.0,
        rework_risk=2.0,
        patient_burden=5.0,
        provider_burden=6.0,
        applicable_to=["all"],
        contraindicated_for=["urgent_therapy"]
    ),
    "PARALLEL_SUBMISSION": Strategy(...),
    "OPTIMIZED_STRICTER_FIRST": Strategy(...)
}
```

#### Scoring Algorithm

```python
from typing import Dict

class StrategyScorer:
    """Deterministic strategy scoring - no LLM involved"""

    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or {
            "speed": 0.30,
            "approval_probability": 0.40,
            "low_rework_risk": 0.20,
            "patient_burden": 0.10
        }

    def score_strategy(
        self,
        strategy: Strategy,
        coverage_assessment_primary: CoverageAssessment,
        coverage_assessment_secondary: CoverageAssessment,
        case_urgency: str = "standard"
    ) -> float:
        """
        Calculate weighted strategy score.

        Returns: float between 0-10
        """
        # Adjust approval probability based on actual coverage assessment
        adjusted_approval = self._adjust_approval_prob(
            strategy.approval_probability,
            coverage_assessment_primary,
            coverage_assessment_secondary
        )

        # Apply urgency-based weight adjustments
        weights = self._get_urgency_weights(case_urgency)

        score = (
            weights["speed"] * strategy.speed_score +
            weights["approval_probability"] * adjusted_approval +
            weights["low_rework_risk"] * (10 - strategy.rework_risk) +
            weights["patient_burden"] * (10 - strategy.patient_burden)
        )

        return round(score, 2)

    def _adjust_approval_prob(
        self,
        base_prob: float,
        primary: CoverageAssessment,
        secondary: CoverageAssessment
    ) -> float:
        """Adjust base probability using actual coverage assessment"""
        primary_factor = 1.0 if primary.overall_status == "likely_approved" else 0.7
        secondary_factor = 1.0 if secondary.overall_status == "likely_approved" else 0.7

        # Weight by confidence
        primary_weight = primary.overall_confidence
        secondary_weight = secondary.overall_confidence

        adjusted = base_prob * (
            (primary_factor * primary_weight + secondary_factor * secondary_weight) /
            (primary_weight + secondary_weight)
        )
        return min(10.0, adjusted)

    def _get_urgency_weights(self, urgency: str) -> Dict[str, float]:
        """Return weight configuration based on urgency"""
        if urgency == "urgent":
            return {
                "speed": 0.50,
                "approval_probability": 0.30,
                "low_rework_risk": 0.10,
                "patient_burden": 0.10
            }
        elif urgency == "emergent":
            return {
                "speed": 0.70,
                "approval_probability": 0.20,
                "low_rework_risk": 0.05,
                "patient_burden": 0.05
            }
        else:  # standard
            return self.weights
```

### 3.5 Action Coordinator

Manages execution of strategy actions against external systems.

```python
from abc import ABC, abstractmethod
from enum import Enum

class ActionType(Enum):
    SUBMIT_PA = "submit_pa"
    CHECK_STATUS = "check_status"
    REQUEST_DOCUMENTS = "request_documents"
    SEND_NOTIFICATION = "send_notification"
    ESCALATE = "escalate"
    FILE_APPEAL = "file_appeal"

class ActionResult(BaseModel):
    action_id: str
    action_type: ActionType
    status: Literal["success", "failed", "pending"]
    result_data: dict
    error_message: Optional[str]
    timestamp: str

class PayerGateway(ABC):
    """Abstract interface for payer systems"""

    @abstractmethod
    async def submit_prior_auth(
        self,
        patient_id: str,
        therapy_request: dict,
        clinical_documentation: List[str]
    ) -> ActionResult:
        pass

    @abstractmethod
    async def check_pa_status(
        self,
        submission_id: str
    ) -> ActionResult:
        pass

class ActionCoordinator:
    """Executes strategy actions and handles failures"""

    def __init__(
        self,
        payer_gateways: Dict[str, PayerGateway],
        notification_service: NotificationService
    ):
        self.payer_gateways = payer_gateways
        self.notifications = notification_service

    async def execute_action(
        self,
        action: dict,
        case_state: CaseState
    ) -> ActionResult:
        """
        Execute a single action with retry and error handling.
        """
        action_type = ActionType(action["action"])

        try:
            if action_type == ActionType.SUBMIT_PA:
                return await self._submit_pa(action, case_state)
            elif action_type == ActionType.CHECK_STATUS:
                return await self._check_status(action, case_state)
            elif action_type == ActionType.REQUEST_DOCUMENTS:
                return await self._request_documents(action, case_state)
            # ... other action types
        except Exception as e:
            return ActionResult(
                action_id=action.get("action_id"),
                action_type=action_type,
                status="failed",
                result_data={},
                error_message=str(e),
                timestamp=datetime.utcnow().isoformat()
            )
```

### 3.6 Audit & Explainability System

Every decision is logged immutably for clinical defensibility.

```python
@dataclass
class DecisionEvent:
    """Immutable record of a system decision"""
    event_id: str
    case_id: str
    timestamp: str

    # What happened
    event_type: str  # "strategy_selected", "action_executed", "human_override"
    decision_made: str

    # Why it happened
    reasoning: str
    input_data_hash: str  # Hash of inputs for reproducibility

    # Alternatives considered
    alternatives: List[dict]

    # Attribution
    decision_maker: str  # "system", "claude", "human:{user_id}"
    model_version: Optional[str]

    # Verification
    signature: str  # Cryptographic signature for tamper-proofing

class AuditLogger:
    """Immutable audit trail for all decisions"""

    def __init__(self, db_path: str):
        self.db = self._init_db(db_path)

    def log_decision(self, event: DecisionEvent) -> str:
        """
        Log a decision event. Returns event_id.

        Events are append-only - cannot be modified or deleted.
        """
        event.signature = self._sign_event(event)
        self._append_to_log(event)
        return event.event_id

    def get_decision_trace(self, case_id: str) -> List[DecisionEvent]:
        """Retrieve complete decision history for a case"""
        return self._query_events(case_id)

    def verify_integrity(self, case_id: str) -> bool:
        """Verify that audit trail has not been tampered with"""
        events = self.get_decision_trace(case_id)
        for event in events:
            if not self._verify_signature(event):
                return False
        return True
```

---

## 4. Data Models

### 4.1 Patient Clinical Summary

```python
@dataclass
class PatientClinicalSummary:
    """Synthetic patient data structure"""
    patient_id: str

    # Demographics
    name: str  # Synthetic
    age: int
    sex: str
    location: str

    # Diagnosis
    primary_diagnosis: str
    icd10_codes: List[str]
    complications: List[str]

    # Labs (with dates)
    lab_results: List[dict]  # {"name": "CRP", "value": 28, "unit": "mg/L", "date": "2024-01-15"}

    # Procedures
    procedures: List[dict]  # {"name": "Colonoscopy", "findings": "...", "date": "..."}

    # Prior Therapies
    prior_therapies: List[dict]  # {"drug": "prednisone", "outcome": "failed", "dates": "..."}

    # Missing items (intentional for demo)
    missing_documentation: List[str]

    # Insurance
    primary_payer: str
    primary_plan_id: str
    secondary_payer: Optional[str]
    secondary_plan_id: Optional[str]
```

### 4.2 Payer Policy Document

```python
@dataclass
class PayerPolicy:
    """Cached payer policy document"""
    payer: str
    policy_id: str
    policy_name: str
    effective_date: str

    # Source
    source_url: str
    source_hash: str  # SHA-256 of original PDF

    # Extracted content
    full_text: str
    coverage_criteria: List[dict]
    step_therapy_requirements: List[str]
    documentation_requirements: List[str]

    # Metadata
    cached_at: str
    extraction_model: str
```

---

## 5. Integration Design

### 5.1 Mock Services (Demo)

```
/mock_services/
├── __init__.py
├── payer/
│   ├── cigna_gateway.py      # Mock Cigna PA API
│   ├── uhc_gateway.py        # Mock UHC PA API
│   └── scenarios.py          # Response scenarios
├── provider/
│   ├── document_service.py   # Mock document request/response
│   └── ehr_connector.py      # Mock EHR queries
└── scenarios/
    ├── happy_path.json       # Both payers approve
    ├── primary_deny.json     # Cigna denies, UHC approves
    ├── missing_docs.json     # Request additional info
    └── recovery_success.json # Denial → Document chase → Approval
```

**Scenario Configuration**:

```json
{
  "scenario_id": "missing_docs",
  "description": "UHC requests TB screening before approval",
  "cigna_responses": [
    {"trigger": "submit_pa", "delay_seconds": 3, "response": {"status": "pending"}},
    {"trigger": "check_status", "delay_seconds": 5, "response": {"status": "approved"}}
  ],
  "uhc_responses": [
    {"trigger": "submit_pa", "delay_seconds": 2, "response": {"status": "pending_info", "required": ["TB_screening"]}},
    {"trigger": "check_status", "after_docs_received": false, "response": {"status": "pending_info"}},
    {"trigger": "check_status", "after_docs_received": true, "response": {"status": "approved"}}
  ]
}
```

### 5.2 LLM Provider Integration

#### Environment Configuration

All LLM credentials are configured via `.env` file:

```bash
# .env.example

# Claude API (PA Skill - Policy Reasoning)
ANTHROPIC_API_KEY=sk-ant-...

# Gemini API (Primary for general tasks)
GEMINI_API_KEY=...

# OpenAI API (Fallback for general tasks)
OPENAI_API_KEY=sk-...

# Model overrides (optional)
CLAUDE_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-3-pro-preview
OPENAI_MODEL=gpt-5-mini
```

#### Claude PA Skill Client (Policy Reasoning Only)

```python
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

class ClaudePASkillClient:
    """
    Claude API client specifically for Policy Reasoning tasks.
    This is the ONLY component that should use Claude directly.
    All other LLM tasks should go through LLMGateway.
    """

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60)
    )
    async def analyze_policy(
        self,
        prompt: str,
        system_prompt: str = None,
        max_tokens: int = 8192
    ) -> str:
        """
        Call Claude API for policy analysis.
        Temperature is fixed at 0.0 for deterministic clinical reasoning.
        """
        messages = [{"role": "user", "content": prompt}]

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=0.0,  # Always deterministic for policy reasoning
            system=system_prompt,
            messages=messages
        )

        return response.content[0].text
```

#### Gemini Client (Primary General Tasks)

```python
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential

class GeminiClient:
    """Gemini API client for general LLM tasks."""

    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model_id = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60)
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.1,
        max_output_tokens: int = 65536
    ) -> str:
        """Call Gemini API with retry logic."""
        model = genai.GenerativeModel(
            model_name=self.model_id,
            system_instruction=system_prompt
        )

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens
            )
        )

        return response.text
```

#### OpenAI Client (Fallback)

```python
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

class OpenAIClient:
    """OpenAI API client as fallback for general LLM tasks."""

    def __init__(self):
        self.client = AsyncOpenAI()
        self.model = os.getenv("OPENAI_MODEL", "gpt-5-mini")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60)
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.1,
        max_tokens: int = 16384
    ) -> str:
        """Call OpenAI API with retry logic."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content
```

---

## 6. Observability & Monitoring

### 6.1 Structured Logging

```python
import structlog

logger = structlog.get_logger()

# Example log entry
logger.info(
    "strategy_selected",
    case_id="2024-MR-001",
    selected_strategy="OPTIMIZED_STRICTER_FIRST",
    score=7.6,
    alternatives=[
        {"strategy": "PARALLEL_SUBMISSION", "score": 6.6},
        {"strategy": "SEQUENTIAL_PRIMARY_FIRST", "score": 6.2}
    ],
    coverage_assessment_primary="likely_approved",
    coverage_assessment_secondary="likely_approved"
)
```

### 6.2 Metrics

```python
from prometheus_client import Counter, Histogram, Gauge

# Case Processing Counters
cases_processed = Counter('cases_processed_total', 'Total cases processed', ['outcome'])
strategies_selected = Counter('strategies_selected_total', 'Strategies selected', ['strategy_id'])
denials_received = Counter('denials_received_total', 'PA denials received', ['payer', 'reason'])

# LLM Invocation Metrics
llm_requests = Counter(
    'llm_requests_total',
    'Total LLM API requests',
    ['provider', 'model', 'task_category', 'status']
)
llm_fallbacks = Counter(
    'llm_fallbacks_total',
    'LLM fallback invocations',
    ['primary_model', 'fallback_model', 'task_category']
)

# Histograms
policy_analysis_duration = Histogram(
    'policy_analysis_seconds',
    'Policy analysis duration (Claude PA Skill)'
)
llm_request_duration = Histogram(
    'llm_request_seconds',
    'LLM request duration',
    ['provider', 'model', 'task_category']
)
strategy_selection_duration = Histogram('strategy_selection_seconds', 'Strategy selection duration')

# Gauges
active_cases = Gauge('active_cases', 'Currently active cases', ['stage'])

# LLM Cost Tracking (for observability)
llm_tokens_used = Counter(
    'llm_tokens_total',
    'Total tokens used',
    ['provider', 'model', 'token_type']  # token_type: input, output
)
```

### 6.3 Decision Trace Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DECISION TRACE - Case #2024-MR-001                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [10:00:00] INTAKE                                                           │
│ ├─ Patient verified: Maria R.                                               │
│ ├─ Dual coverage confirmed: Cigna (primary) + UHC (secondary)               │
│ └─ Gaps identified: TB screening, HepB screening                            │
│                                                                             │
│ [10:00:15] POLICY_ANALYSIS                                                  │
│ ├─ Cigna: 4/5 criteria met, missing TB (confidence: 0.92)                   │
│ ├─ UHC: 4/6 criteria met, missing TB + step therapy docs (confidence: 0.88) │
│ └─ UHC determined as stricter payer                                         │
│                                                                             │
│ [10:00:45] STRATEGY_GENERATION                                              │
│ ├─ Generated 3 strategies                                                   │
│ └─ Scores: Sequential=6.2, Parallel=6.6, Optimized=7.6                      │
│                                                                             │
│ [10:00:46] STRATEGY_SELECTION                                               │
│ ├─ Selected: OPTIMIZED_STRICTER_FIRST (score: 7.6)                          │
│ ├─ Rationale: Higher approval confidence justifies moderate speed tradeoff  │
│ └─ Decision maker: system (auto-select, score delta > 0.5)                  │
│                                                                             │
│ [10:00:47] ACTION_COORDINATION                                              │
│ ├─ Action dispatched: Request TB/HepB from provider                         │
│ └─ Action dispatched: Prepare UHC PA package                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Security & Compliance

### 7.1 Data Handling

- All patient data is synthetic for demo
- No PHI transmitted to Claude API (only clinical summaries)
- Policy documents are from public sources
- Audit logs are tamper-evident

### 7.2 Access Control

```python
class PermissionLevel(Enum):
    VIEW_ONLY = "view_only"
    OPERATOR = "operator"       # Can view and trigger actions
    OVERRIDE = "override"       # Can override system decisions
    ADMIN = "admin"             # Full access including audit

# Human override requires OVERRIDE permission
def request_human_override(case_id: str, user: User, new_strategy: str):
    if user.permission_level < PermissionLevel.OVERRIDE:
        raise PermissionError("Override permission required")

    audit_logger.log_decision(DecisionEvent(
        event_type="human_override",
        decision_made=f"Strategy changed to {new_strategy}",
        decision_maker=f"human:{user.id}",
        reasoning=user.override_reason
    ))
```

---

## 8. UI/UX Design System

### 8.1 Design Philosophy

The user interface is designed to be **virtually indistinguishable from an Apple product**. Every interaction, animation, and visual element follows Apple Human Interface Guidelines with enterprise SaaS adaptations.

#### Core Principles

1. **Greyscale-First**: Primary UI uses greyscale; color is reserved for semantic meaning only
2. **Clarity**: Content is paramount; chrome is minimal and recedes
3. **Deference**: Fluid motion and crisp typography serve the content
4. **Depth**: Translucent layers create visual hierarchy through glassmorphism
5. **Precision**: Pixel-perfect alignment; nothing is arbitrary

### 8.2 Color System

```typescript
// tailwind.config.js - Apple-inspired greyscale palette

const colors = {
  // Primary greyscale (main UI)
  grey: {
    50:  '#fafafa',   // Background (light mode)
    100: '#f5f5f5',   // Card backgrounds
    200: '#e5e5e5',   // Borders, dividers
    300: '#d4d4d4',   // Disabled text
    400: '#a3a3a3',   // Placeholder text
    500: '#737373',   // Secondary text
    600: '#525252',   // Primary text (light mode)
    700: '#404040',   // Headers
    800: '#262626',   // Background (dark mode)
    900: '#171717',   // Card backgrounds (dark mode)
    950: '#0a0a0a',   // True black
  },

  // Semantic colors (ONLY for status/meaning)
  semantic: {
    success: '#34C759',    // Apple green - Approved, Complete
    warning: '#FF9500',    // Apple orange - Pending, Attention
    error:   '#FF3B30',    // Apple red - Denied, Failed
    info:    '#007AFF',    // Apple blue - Links, Actions (sparingly)
  },

  // Glass effects
  glass: {
    light: 'rgba(255, 255, 255, 0.72)',
    dark:  'rgba(28, 28, 30, 0.72)',
    blur:  '20px',
  }
}
```

#### Color Usage Rules

| Element | Color | Notes |
|---------|-------|-------|
| Page background | `grey.50` / `grey.900` | Light/dark mode |
| Card background | `grey.100` / `grey.800` | Subtle elevation |
| Primary text | `grey.700` / `grey.200` | High contrast |
| Secondary text | `grey.500` / `grey.400` | Subdued |
| Borders | `grey.200` / `grey.700` | Minimal visibility |
| Approved status | `semantic.success` | Green badge only |
| Denied status | `semantic.error` | Red badge only |
| Pending status | `semantic.warning` | Orange badge only |
| Interactive elements | `grey.900` / `grey.50` | Near-black/white buttons |

**Rule**: If you're reaching for a color, ask "Does this convey status?" If no, use greyscale.

### 8.3 Typography

```css
/* Apple SF Pro-inspired typography stack */

:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;

  /* Type scale (Apple HIG-inspired) */
  --text-xs:    0.75rem;    /* 12px - Labels, badges */
  --text-sm:    0.875rem;   /* 14px - Secondary text */
  --text-base:  1rem;       /* 16px - Body text */
  --text-lg:    1.125rem;   /* 18px - Subheadings */
  --text-xl:    1.25rem;    /* 20px - Card titles */
  --text-2xl:   1.5rem;     /* 24px - Section headers */
  --text-3xl:   1.875rem;   /* 30px - Page titles */
  --text-4xl:   2.25rem;    /* 36px - Hero text */

  /* Font weights */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* Letter spacing */
  --tracking-tight:  -0.025em;  /* Headlines */
  --tracking-normal: 0;         /* Body */
  --tracking-wide:   0.025em;   /* Labels, badges */
}
```

#### Typography Hierarchy

| Element | Size | Weight | Color | Tracking |
|---------|------|--------|-------|----------|
| Page title | `text-3xl` | Semibold | `grey.900` | Tight |
| Section header | `text-2xl` | Semibold | `grey.800` | Tight |
| Card title | `text-xl` | Medium | `grey.700` | Normal |
| Body text | `text-base` | Normal | `grey.600` | Normal |
| Secondary text | `text-sm` | Normal | `grey.500` | Normal |
| Labels | `text-xs` | Medium | `grey.400` | Wide |
| Code/data | `text-sm` | Normal (mono) | `grey.600` | Normal |

### 8.4 Glassmorphism System

Navigation and overlay elements use glassmorphism for depth and sophistication.

```css
/* Glassmorphism base classes */

.glass-panel {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
}

.glass-panel-dark {
  background: rgba(28, 28, 30, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

/* Sidebar navigation */
.glass-sidebar {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: saturate(180%) blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

/* Floating action panels */
.glass-floating {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(40px);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.02),
    0 12px 24px rgba(0, 0, 0, 0.04),
    0 24px 48px rgba(0, 0, 0, 0.06);
  border-radius: 20px;
}
```

#### Where to Use Glassmorphism

| Component | Glass Treatment | Notes |
|-----------|-----------------|-------|
| Sidebar navigation | `glass-sidebar` | Always visible, high blur |
| Modal overlays | `glass-floating` | Prominent shadow |
| Tooltip popovers | `glass-panel` | Subtle |
| Action toolbar | `glass-panel` | Fixed position elements |
| **Content cards** | **NO** | Use solid `grey.100` background |
| **Tables** | **NO** | Readability priority |
| **Forms** | **NO** | Input clarity |

### 8.5 Component Specifications

#### Buttons

```tsx
// Apple-style button variants

// Primary action - solid dark
<Button variant="primary">
  Submit PA Request
</Button>
// → bg-grey-900 text-white hover:bg-grey-800 rounded-lg px-4 py-2

// Secondary action - outlined
<Button variant="secondary">
  Cancel
</Button>
// → bg-transparent border border-grey-300 text-grey-700 hover:bg-grey-100

// Ghost action - minimal
<Button variant="ghost">
  Learn more
</Button>
// → bg-transparent text-grey-600 hover:text-grey-900 hover:bg-grey-100

// Destructive - ONLY for delete/deny actions
<Button variant="destructive">
  Deny Request
</Button>
// → bg-semantic-error text-white (use sparingly)
```

#### Cards

```tsx
// Standard content card
<Card>
  <CardHeader>
    <CardTitle>Coverage Assessment</CardTitle>
    <CardDescription>Cigna Commercial PPO</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

// Card styles
// → bg-grey-100 dark:bg-grey-800
// → rounded-2xl
// → border border-grey-200 dark:border-grey-700
// → shadow-none (flat by default)
// → hover:shadow-sm (subtle lift on interactive cards)
```

#### Status Badges

```tsx
// Status indicators - ONLY place for semantic color
<Badge status="approved">Approved</Badge>  // → bg-green-100 text-green-800
<Badge status="denied">Denied</Badge>      // → bg-red-100 text-red-800
<Badge status="pending">Pending</Badge>    // → bg-orange-100 text-orange-800
<Badge status="neutral">Draft</Badge>      // → bg-grey-200 text-grey-600
```

#### Data Display

```tsx
// Metric cards (Apple Stocks app style)
<MetricCard
  label="Days to Therapy"
  value="10-14"
  trend="down"
  trendLabel="2 days faster than average"
/>

// → Large value in grey-900, semibold
// → Label in grey-500, small caps
// → Trend arrow in semantic color (green for positive)
```

### 8.6 Motion & Animation

```css
/* Apple-style easing curves */
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Durations */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}

/* Micro-interactions */
.button-press {
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.button-press:active {
  transform: scale(0.97);
}

/* Page transitions */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all var(--duration-normal) var(--ease-out-quint);
}

/* Card hover lift */
.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transition: all var(--duration-normal) var(--ease-out-expo);
}
```

### 8.7 Responsive Breakpoints

```typescript
// Tailwind breakpoints (Apple device-aligned)
const screens = {
  'sm':  '640px',   // iPhone landscape
  'md':  '768px',   // iPad portrait
  'lg':  '1024px',  // iPad landscape
  'xl':  '1280px',  // MacBook Air
  '2xl': '1536px',  // MacBook Pro / iMac
}
```

### 8.8 Accessibility

- **Contrast ratios**: All text meets WCAG 2.1 AA (4.5:1 minimum)
- **Focus states**: Visible focus rings on all interactive elements
- **Reduced motion**: Respects `prefers-reduced-motion` media query
- **Screen readers**: Semantic HTML, ARIA labels on icons
- **Keyboard navigation**: Full keyboard support, logical tab order

### 8.9 Example: Strategy Comparison Component

```tsx
// Apple-style strategy comparison (like comparing iPhone models)

<div className="grid grid-cols-3 gap-6">
  {strategies.map((strategy, i) => (
    <Card
      key={strategy.id}
      className={cn(
        "relative transition-all duration-250 ease-out-expo",
        strategy.isSelected && "ring-2 ring-grey-900 dark:ring-grey-100"
      )}
    >
      {strategy.isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-grey-900 text-white text-xs px-3 py-1">
            Recommended
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl font-medium text-grey-800">
          {strategy.name}
        </CardTitle>
        <CardDescription className="text-grey-500">
          {strategy.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key metric - large and prominent */}
        <div className="text-center py-4">
          <span className="text-4xl font-semibold text-grey-900">
            {strategy.score}
          </span>
          <span className="text-grey-400 text-lg">/10</span>
        </div>

        {/* Comparison metrics */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-grey-500">Days to Therapy</span>
            <span className="text-grey-800 font-medium">
              {strategy.daysToTherapy}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-grey-500">Approval Confidence</span>
            <span className="text-grey-800 font-medium">
              {strategy.approvalConfidence}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-grey-500">Rework Risk</span>
            <Badge status={strategy.reworkRisk}>
              {strategy.reworkRiskLabel}
            </Badge>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <Button
          variant={strategy.isSelected ? "primary" : "secondary"}
          className="w-full"
        >
          {strategy.isSelected ? "Selected" : "Select Strategy"}
        </Button>
      </CardFooter>
    </Card>
  ))}
</div>
```

---

## 9. Deployment Architecture

### 9.1 Application Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Local Development                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     FRONTEND (React + Tailwind)                      │  │
│   │   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │  │
│   │   │ Dashboard │  │   Case    │  │  Strategy │  │   Decision    │   │  │
│   │   │   View    │  │  Details  │  │ Comparison│  │    Trace      │   │  │
│   │   └───────────┘  └───────────┘  └───────────┘  └───────────────┘   │  │
│   │                  Apple-Inspired Glassmorphism UI                     │  │
│   └────────────────────────────────┬────────────────────────────────────┘  │
│                                    │ REST/WebSocket                        │
│                                    ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      BACKEND (Python FastAPI)                        │  │
│   │   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │  │
│   │   │    API    │  │  Case     │  │   LLM     │  │    Event      │   │  │
│   │   │  Routes   │  │ Service   │  │  Gateway  │  │   Streaming   │   │  │
│   │   └───────────┘  └───────────┘  └───────────┘  └───────────────┘   │  │
│   └────────────────────────────────┬────────────────────────────────────┘  │
│                                    │                                       │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         ▼                          ▼                          ▼           │
│   ┌───────────┐            ┌───────────────┐           ┌───────────┐     │
│   │  SQLite   │            │  LLM Gateway  │           │   Redis   │     │
│   │  (State)  │            │               │           │  (Cache)  │     │
│   └───────────┘            └───────┬───────┘           └───────────┘     │
│                                    │                                       │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         ▼                          ▼                          ▼           │
│   ┌───────────┐            ┌───────────┐             ┌───────────┐       │
│   │  Claude   │            │  Gemini   │             │  OpenAI   │       │
│   │  PA Skill │            │  3 Pro    │             │  GPT-5    │       │
│   │ (Policy)  │            │ (Primary) │             │ (Fallback)│       │
│   └───────────┘            └───────────┘             └───────────┘       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

# Development commands
cd frontend && npm run dev      # React dev server (port 3000)
cd backend && uvicorn main:app  # FastAPI server (port 8000)
```

### 9.2 Project Structure

```
/agentic_access_strategy/
├── SYSTEM_DESIGN.md
├── README.md
├── .env.example
├── docker-compose.yml
│
├── frontend/                          # React + Tailwind (Apple-style UI)
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   │
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── styles/
│   │   │   ├── globals.css           # Tailwind base + Apple design tokens
│   │   │   └── glassmorphism.css     # Glassmorphism effects
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   # Base UI components (Apple-style)
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── GlassPanel.tsx    # Glassmorphism navigation
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Progress.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx       # Glass navigation sidebar
│   │   │   │   ├── Header.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   │
│   │   │   └── domain/               # Domain-specific components
│   │   │       ├── CaseCard.tsx
│   │   │       ├── PolicyAnalysisView.tsx
│   │   │       ├── StrategyComparison.tsx
│   │   │       ├── DecisionTrace.tsx
│   │   │       ├── CounterfactualDisplay.tsx
│   │   │       └── CoverageAssessment.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── CaseDetail.tsx
│   │   │   ├── NewCase.tsx
│   │   │   └── Settings.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useCase.ts
│   │   │   ├── useWebSocket.ts       # Real-time updates
│   │   │   └── useApi.ts
│   │   │
│   │   ├── services/
│   │   │   └── api.ts                # FastAPI client
│   │   │
│   │   └── types/
│   │       ├── case.ts
│   │       ├── strategy.ts
│   │       └── api.ts
│   │
│   └── public/
│       └── assets/
│
├── backend/                           # Python FastAPI
│   ├── requirements.txt
│   ├── main.py                       # FastAPI entry point
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── cases.py              # Case CRUD endpoints
│   │   │   ├── strategies.py         # Strategy endpoints
│   │   │   ├── policies.py           # Policy analysis endpoints
│   │   │   └── websocket.py          # Real-time event streaming
│   │   │
│   │   ├── models/
│   │   │   ├── requests.py           # Pydantic request models
│   │   │   └── responses.py          # Pydantic response models
│   │   │
│   │   └── dependencies.py           # FastAPI dependencies
│   │
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   ├── case_orchestrator.py      # LangGraph state machine
│   │   ├── state.py                  # CaseState definitions
│   │   └── transitions.py            # Stage transition logic
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── intake_agent.py
│   │   ├── policy_analyzer.py
│   │   ├── strategy_generator.py
│   │   └── action_coordinator.py
│   │
│   ├── reasoning/
│   │   ├── __init__.py
│   │   ├── llm_gateway.py            # Multi-model routing (Gemini/GPT)
│   │   ├── claude_pa_client.py       # Claude PA Skill (policy reasoning)
│   │   ├── gemini_client.py          # Gemini client (primary)
│   │   ├── openai_client.py          # OpenAI client (fallback)
│   │   ├── policy_reasoner.py        # LLM-first coverage assessment
│   │   ├── strategy_scorer.py        # Deterministic scoring
│   │   ├── prompt_loader.py          # Prompt loading with placeholder substitution
│   │   └── rubric_loader.py          # Payer-specific decision rubrics
│   │
│   ├── policy_digitalization/         # Multi-pass policy extraction pipeline
│   │   ├── __init__.py
│   │   ├── pipeline.py               # Orchestrates extract → validate → evaluate
│   │   ├── extractor.py              # Pass 1: LLM extracts criteria from PDF
│   │   ├── validator.py              # Pass 2: LLM cross-validates extraction
│   │   ├── differ.py                 # Policy-vs-policy comparison
│   │   ├── impact_analyzer.py        # Patient impact analysis for policy changes
│   │   └── exceptions.py             # PolicyNotFoundError, ExtractionError, etc.
│   │
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── database.py               # SQLAlchemy setup
│   │   ├── case_repository.py
│   │   └── audit_logger.py
│   │
│   └── mock_services/
│       ├── __init__.py
│       ├── payer/
│       ├── provider/
│       └── scenarios/
│
├── prompts/                           # Shared prompt templates
│   ├── policy_analysis/
│   ├── strategy/
│   ├── appeals/
│   └── system/
│
├── data/                              # Synthetic data
│   ├── patients/
│   │   └── maria_r.json
│   ├── policies/
│   │   ├── cigna_infliximab.txt
│   │   └── uhc_infliximab.txt
│   └── strategies/
│       └── templates.json
│
└── tests/
    ├── frontend/                      # Jest + React Testing Library
    ├── backend/                       # Pytest
    │   ├── unit/
    │   ├── integration/
    │   └── scenarios/
    └── e2e/                           # Playwright
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
- [ ] Set up project structure (React frontend + FastAPI backend)
- [ ] Implement CaseState and state machine
- [ ] Create LLM Gateway with multi-model support
- [ ] Build basic React component shell with Tailwind

### Phase 2: Reasoning Engine
- [ ] Implement Claude PA Skill client for policy reasoning
- [ ] Implement Gemini/GPT clients for general tasks
- [ ] Build deterministic StrategyScorer
- [ ] Create synthetic patient data (Maria R.)
- [ ] Extract and cache payer policies

### Phase 3: Orchestration
- [ ] Implement LangGraph case orchestrator
- [ ] Build stage transitions
- [ ] Add mock payer services
- [ ] Implement action coordinator

### Phase 4: UI & Demo
- [ ] Build React components with Apple-inspired design
- [ ] Implement glassmorphism navigation
- [ ] Create decision trace visualization
- [ ] Add counterfactual display
- [ ] Polish demo flow

### Phase 5: Observability
- [ ] Implement audit logger
- [ ] Add structured logging
- [ ] Create metrics endpoints
- [ ] Build demo walkthrough script

---

## 11. Strategy Definitions

### 11.1 Strategy A: Sequential Submission (Primary First)

**Strategy ID**: `SEQUENTIAL_PRIMARY_FIRST`

**Description**: Submit PA to Cigna first, wait for determination, then submit to UHC with Cigna's approval documentation attached.

**Rationale**: Traditional coordination-of-benefits (COB) approach. UHC may require primary payer determination before processing secondary claims.

**Preconditions**:
- Primary payer (Cigna) coverage verified
- Secondary payer (UHC) has COB sequential requirement OR no urgency

**Actions**:
```
1. [Day 0]     Request missing TB/HepB from provider
2. [Day 0]     Prepare Cigna PA package
3. [Day 1-2]   Submit Cigna PA (with gap acknowledgment)
4. [Day 3-10]  Monitor Cigna status
5. [Day 10]    IF Cigna APPROVED → Prepare UHC package with Cigna EOB
6. [Day 11-12] Submit UHC PA
7. [Day 13-20] Monitor UHC status
8. [Day 20]    Final determination
```

**Scoring Factors**:
| Factor | Score | Notes |
|--------|-------|-------|
| Speed (days to therapy) | 3/10 | 15-20 business days typical |
| Approval Probability | 8/10 | UHC sees Cigna approval as strong signal |
| Rework Risk | 2/10 | Low - each step validates before next |
| Patient Burden | 5/10 | Moderate wait time |
| Provider Burden | 6/10 | Standard workflow |

**Total Score**: `(0.3 × 3) + (0.4 × 8) + (0.2 × 8) + (0.1 × 5)` = **6.2**

### 11.2 Strategy B: Parallel Submission (Both Simultaneously)

**Strategy ID**: `PARALLEL_SUBMISSION`

**Description**: Submit PA requests to both Cigna and UHC simultaneously with identical clinical documentation.

**Rationale**: Maximizes speed by running both processes in parallel.

**Preconditions**:
- Neither payer explicitly requires sequential COB
- Clinical documentation is complete enough for both submissions
- Provider can handle concurrent requests

**Actions**:
```
1. [Day 0]     Request missing TB/HepB from provider (URGENT)
2. [Day 0]     Prepare unified PA package (superset of both payer requirements)
3. [Day 1]     Submit Cigna PA
4. [Day 1]     Submit UHC PA (in parallel)
5. [Day 2-10]  Monitor BOTH payer statuses concurrently
6. [Day X]     First approval received → Notify stakeholders
7. [Day Y]     Second approval received → Schedule therapy
8. [Day 7-12]  Final determination (whichever is slower)
```

**Scoring Factors**:
| Factor | Score | Notes |
|--------|-------|-------|
| Speed (days to therapy) | 8/10 | 7-12 business days typical |
| Approval Probability | 6/10 | Each payer evaluates independently |
| Rework Risk | 5/10 | Medium - potential for conflicting requests |
| Patient Burden | 8/10 | Shortest wait |
| Provider Burden | 4/10 | Must handle two concurrent PAs |

**Total Score**: `(0.3 × 8) + (0.4 × 6) + (0.2 × 5) + (0.1 × 8)` = **6.6**

### 11.3 Strategy C: Optimized Submission (Stricter Payer First)

**Strategy ID**: `OPTIMIZED_STRICTER_FIRST`

**Description**: Analyze both policies, identify which payer has stricter criteria, submit to the stricter payer first.

**Rationale**: "Solve the harder problem first" - satisfying stricter requirements first streamlines the second submission.

**Preconditions**:
- Policy analysis completed for both payers
- Clear determination of which policy is stricter
- Documentation can meet stricter requirements

**Actions**:
```
1. [Day 0]     Analyze both policies (Claude PA Skill)
2. [Day 0]     Determine: UHC is stricter (more documentation burden)
3. [Day 0-1]   Prepare UHC-grade documentation (superset)
4. [Day 1]     Request ALL missing items from provider
5. [Day 2]     Submit UHC PA first
6. [Day 3-10]  Monitor UHC status
7. [Day 10]    IF UHC APPROVED → Submit Cigna with "meets or exceeds" package
8. [Day 11-14] Cigna fast-track (already have all docs)
9. [Day 14]    Final determination
```

**Scoring Factors**:
| Factor | Score | Notes |
|--------|-------|-------|
| Speed (days to therapy) | 6/10 | 10-14 business days typical |
| Approval Probability | 9/10 | Stricter bar cleared first |
| Rework Risk | 2/10 | Low - second submission is subset |
| Patient Burden | 6/10 | Moderate wait, but higher confidence |
| Provider Burden | 5/10 | One documentation push, used twice |

**Total Score**: `(0.3 × 6) + (0.4 × 9) + (0.2 × 8) + (0.1 × 6)` = **7.6** ← **HIGHEST**

### 11.4 Strategy Comparison Matrix

| Dimension | Sequential (A) | Parallel (B) | Optimized (C) |
|-----------|----------------|--------------|---------------|
| **Time to Therapy** | 15-20 days | 7-12 days | 10-14 days |
| **Approval Confidence** | High | Medium | Very High |
| **Rework Risk** | Low | Medium | Low |
| **Provider Effort** | Standard | High | Moderate |
| **Patient Anxiety** | High (long wait) | Low (fast) | Moderate |
| **Coordination Complexity** | Simple | Complex | Moderate |
| **Weighted Score** | 6.2 | 6.6 | **7.6** |

### 11.5 Weight Configuration (Tunable)

```python
# Default weights (sum = 1.0)
STRATEGY_WEIGHTS = {
    "speed": 0.30,           # Time to therapy
    "approval_prob": 0.40,   # Likelihood of approval
    "low_rework": 0.20,      # Inverse of rework risk
    "patient_burden": 0.10   # Patient experience
}

# High-urgency override (e.g., oncology)
URGENT_WEIGHTS = {
    "speed": 0.50,
    "approval_prob": 0.30,
    "low_rework": 0.10,
    "patient_burden": 0.10
}
```

---

## 12. Failure Scenario: Adaptive Reasoning

### 12.1 Scenario: Primary Payer Denial Due to Missing Documentation

**Trigger Point**: Day 5 of Strategy C execution

**Event**: UHC returns denial with reason code `MISSING_REQUIRED_DOCUMENTATION`

```json
{
  "case_id": "2024-MR-001",
  "payer": "UHC",
  "determination": "DENIED",
  "reason_code": "MISSING_REQUIRED_DOCUMENTATION",
  "reason_text": "TB screening results required per policy section 4.2.1",
  "appeal_deadline": "2024-02-15",
  "resubmission_allowed": true
}
```

### 12.2 Denial Classification Logic

```python
DENIAL_CATEGORIES = {
    "RECOVERABLE": [
        "MISSING_REQUIRED_DOCUMENTATION",
        "INCOMPLETE_FORM",
        "EXPIRED_DOCUMENTATION"
    ],
    "APPEALABLE": [
        "MEDICAL_NECESSITY_NOT_MET",
        "STEP_THERAPY_REQUIRED",
        "OFF_LABEL_USE"
    ],
    "TERMINAL": [
        "NOT_COVERED_BENEFIT",
        "PLAN_EXCLUSION",
        "MEMBER_NOT_ELIGIBLE"
    ]
}
```

### 12.3 Recovery Strategy Options

**[1] URGENT_DOCUMENT_CHASE** (Score: 7.2)
- Escalate to provider office manager
- Request expedited TB result upload
- Target: Obtain results within 48 hours
- Then: Resubmit to UHC

**[2] PARALLEL_RECOVERY** (Score: 6.8)
- Continue chasing TB documentation
- SIMULTANEOUSLY prepare appeal package
- Hedges against provider non-response

**[3] STRATEGY_PIVOT_TO_CIGNA_FIRST** (Score: 4.1)
- NOT RECOMMENDED: Same documentation gap exists

### 12.4 Adaptive Reasoning Decision Tree

```
                         [DENIAL RECEIVED]
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Classify Denial     │
                    │ Type                │
                    └─────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
    [RECOVERABLE]        [APPEALABLE]          [TERMINAL]
          │                    │                    │
          ▼                    ▼                    ▼
    ┌───────────┐        ┌───────────┐        ┌───────────┐
    │ Identify  │        │ Generate  │        │ Notify    │
    │ Missing   │        │ Appeal    │        │ Stake-    │
    │ Item      │        │ Strategy  │        │ holders   │
    └───────────┘        └───────────┘        └───────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌───────────┐        ┌───────────┐        ┌───────────┐
    │ Chase     │        │ Draft     │        │ Explore   │
    │ Document  │        │ Appeal    │        │ Alt       │
    │ from      │        │ with      │        │ Coverage  │
    │ Provider  │        │ Claude    │        │ Options   │
    └───────────┘        └───────────┘        └───────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    [Doc Received?]      [Appeal Filed]       [Case Closed
          │                    │               or PAP/Co-pay]
     Yes / No                  │
      │     │                  ▼
      ▼     ▼            [Await Decision]
 [Resubmit] [Escalate         │
             to Appeal]       ▼
                        [Approved/Denied]
```

### 12.5 Key Agentic Capabilities Demonstrated

| Capability | How It's Shown |
|------------|----------------|
| **Situational Awareness** | Recognizes denial as recoverable vs. terminal |
| **Root Cause Analysis** | Links denial to known intake gap |
| **Strategy Re-evaluation** | Scores 3 recovery paths, selects optimal |
| **Autonomous Action** | Triggers provider escalation without human prompt |
| **Parallel Execution** | Can run document chase + appeal prep simultaneously |
| **Human-in-Loop Escalation** | Notifies manager when automated recovery stalls |
| **Deadline Management** | Tracks resubmission and appeal windows |
| **Counterfactual Reasoning** | Shows what happens if provider responds vs. not |

---

## 13. Appendix: Architectural Decisions with Provenance

This section provides detailed rationale for every major architectural decision, ensuring traceability and defensibility.

### 13.1 LLM Model Selection Rationale

| Model | Task | Why This Model | Why Not Alternatives | Token Limits |
|-------|------|----------------|----------------------|--------------|
| **Claude Sonnet 4** | Policy Reasoning | Best-in-class for nuanced clinical/legal reasoning; excels at extracting structured criteria from complex policy documents; consistent with temperature=0 | GPT lacks medical domain depth; Gemini less consistent on criterion extraction | 8,192 output (sufficient for structured JSON) |
| **Gemini 3 Pro Preview** | Appeal Drafting, Summaries | Largest context window (65K tokens) handles full policy + patient history; fast generation for iterative drafting; cost-effective for high-volume tasks | Claude over-qualified for straightforward drafting; GPT smaller context | 65,536 output (accommodates long letters) |
| **GPT-5 Mini** | Fallback | Proven reliability; different failure modes than Gemini (uncorrelated errors increase resilience); good structured output | Primary would be redundant; smaller models lack quality | 16,384 output (adequate for fallback) |

**Temperature Settings Rationale**:
- **0.0 for Policy Reasoning**: Clinical decisions require determinism. Same patient + policy must yield identical assessment for audit trail integrity.
- **0.1 for Generation Tasks**: Slight variability produces more natural language while maintaining consistency. Appeals benefit from slight stylistic variation.

### 13.2 Framework & Infrastructure Decisions

| Decision | Choice | Detailed Rationale | Alternatives Considered |
|----------|--------|-------------------|------------------------|
| **Frontend** | React 18 + TypeScript | Type safety prevents runtime errors in complex state management; concurrent rendering enables smooth decision trace streaming; largest component ecosystem for enterprise SaaS | Vue (smaller ecosystem), Svelte (less enterprise adoption), Angular (heavier bundle) |
| **Styling** | Tailwind CSS | Utility-first enables pixel-perfect Apple-style customization; tree-shaking produces minimal bundle; co-located styles improve component maintainability | CSS Modules (less flexibility), Styled Components (runtime overhead), CSS-in-JS (harder Apple mimicry) |
| **Backend** | FastAPI (Python) | Native async for concurrent LLM calls; Pydantic validation matches LLM JSON schemas; auto-generated OpenAPI docs accelerate frontend development; Python ecosystem for ML/LLM libraries | Django (synchronous), Flask (manual validation), Node.js (loses Python LLM ecosystem) |
| **Orchestration** | LangGraph | First-class support for stateful agent graphs; built-in checkpointing enables case recovery; human-in-the-loop patterns; integrates with LangChain observability | Custom state machine (no checkpointing), Temporal (over-engineered for demo), Prefect (batch-oriented) |
| **State Storage** | SQLite (demo) → PostgreSQL (prod) | SQLite: Zero-config, portable, sufficient for single-user demo. PostgreSQL: ACID transactions for concurrent case updates; JSONB for flexible schema evolution | MongoDB (no transactions), Redis (volatility concerns for audit log) |
| **Real-time** | WebSocket (FastAPI) | Bidirectional communication for live decision trace streaming; lower latency than polling; native FastAPI support via `websockets` | SSE (unidirectional), Long polling (resource intensive), gRPC (overkill for demo) |

### 13.3 Design Decisions with Clinical Defensibility Impact

| Decision | Choice | Clinical Defensibility Impact |
|----------|--------|-------------------------------|
| **Deterministic Strategy Scoring** | Weighted algorithm (no LLM) | Same inputs → same outputs. Auditors can reproduce scoring. No "black box" defense needed. |
| **Immutable Audit Log** | Append-only with cryptographic signatures | Tamper-evident trail. Every decision traceable to inputs, model version, timestamp. |
| **Separation: Reasoning vs. Scoring** | Claude evaluates criteria, algorithm scores strategies | Claude provides per-criterion assessment (is_met, confidence, reasoning); deterministic algorithm provides quantitative strategy ranking. Combines LLM clinical judgment with reproducible scoring. |
| **LLM-First Policy Evaluation** | Claude evaluates all criteria by ID | Replaced brittle deterministic evaluator. Claude receives digitized policy structure with criterion_ids and returns structured assessments. Backend validates ID alignment. Conservative model: AI never recommends denial. |
| **External Prompts** | `.txt` files in `/prompts/` | Version-controlled prompt changes. Non-engineers can review/modify clinical reasoning instructions. Git history provides prompt provenance. |
| **Explicit Confidence Scores** | 0.0-1.0 on all LLM outputs | Enables threshold-based human escalation. Low-confidence cases automatically flagged for review. |

### 13.4 UI/UX Design Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| **Apple HIG-inspired** | Greyscale-first with semantic color | Conveys premium enterprise quality; reduces cognitive load; color reserved for actionable status (approved=green, denied=red) |
| **Glassmorphism** | Navigation elements only | Creates depth hierarchy without overwhelming content; modern aesthetic; Apple-validated pattern |
| **Inter font** | Primary typeface | Open-source SF Pro alternative; excellent readability at small sizes; professional appearance |
| **Card-based layout** | Content organization | Maps naturally to case/strategy/policy concepts; supports progressive disclosure; familiar enterprise pattern |

### 13.5 Summary Decision Matrix

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend Framework | React 18 + TypeScript | Type safety, concurrent rendering, ecosystem maturity |
| CSS Framework | Tailwind CSS | Utility-first, Apple-style customization, minimal bundle |
| Design System | Apple HIG-inspired | Premium aesthetic, greyscale-first reduces cognitive load |
| UI Effects | Glassmorphism (nav only) | Depth hierarchy without content distraction |
| Backend Framework | Python FastAPI | Async LLM calls, Pydantic validation, auto-docs |
| Orchestration | LangGraph | Stateful agents, checkpointing, human-in-loop |
| Policy Reasoning LLM | Claude Sonnet 4 | Best clinical reasoning, deterministic at temp=0 |
| General LLM (Primary) | Gemini 3 Pro Preview | 65K context, fast generation, cost-effective |
| General LLM (Fallback) | GPT-5 Mini | Uncorrelated failures, proven reliability |
| LLM Architecture | Multi-model routing | Task specialization + resilience + cost optimization |
| Strategy Scoring | Deterministic algorithm | Auditability: same inputs = same outputs |
| State Storage | SQLite (demo) / PostgreSQL (prod) | Portable demo, ACID transactions for production |
| Real-time Updates | WebSocket | Live decision trace streaming |
| Prompts | External .txt files | Version controlled, non-engineer editable |
| Mock Services | FastAPI endpoints | Realistic latency, scenario switching |

---

## 14. Counterfactual Display Example

```
┌─────────────────────────────────────────────────────────────────┐
│ STRATEGY COMPARISON - Maria R. (Case #2024-MR-001)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▶ SELECTED: Optimized (UHC First)                             │
│    ├─ Days to therapy: 10-14                                   │
│    ├─ Approval confidence: 92%                                 │
│    └─ Score: 7.6/10                                            │
│                                                                 │
│  ○ Alternative: Parallel Submission                             │
│    ├─ Days to therapy: 7-12 (faster)                           │
│    ├─ Approval confidence: 78% (lower)                         │
│    └─ Score: 6.6/10                                            │
│    ⚠ Risk: Conflicting info requests could delay both          │
│                                                                 │
│  ○ Alternative: Sequential (Cigna First)                        │
│    ├─ Days to therapy: 15-20 (slower)                          │
│    ├─ Approval confidence: 85%                                 │
│    └─ Score: 6.2/10                                            │
│    ⚠ Risk: Long wait with active fistula                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Demo Walkthrough: Agentic AI in Action

This section provides a concrete demonstration script showing "agentic moments" - the specific points where the system exhibits autonomous reasoning, planning, and adaptation beyond traditional automation.

### Demo Duration
**Total Time**: 8-10 minutes

### Demo Scenario
**Patient**: Maria R., 38F, Crohn's disease with perianal fistula
**Therapy**: Infliximab IV (medical benefit)
**Coverage**: Dual-payer (Cigna Primary + UHC Secondary)
**Intentional Gaps**: Missing TB screening, unclear prior therapy dates

---

### Step 1: Case Intake [30 seconds]

**What Happens**: System receives patient case and autonomously identifies documentation gaps.

**Agentic Moment**: The system doesn't just validate required fields—it *reasons* about what's missing based on policy requirements.

```
┌────────────────────────────────────────────────────────────────────┐
│ CASE INTAKE - Maria R.                                             │
├────────────────────────────────────────────────────────────────────┤
│ ✓ Patient demographics verified                                    │
│ ✓ Dual coverage confirmed: Cigna (primary) + UHC (secondary)       │
│ ✓ Therapy: Infliximab IV for Crohn's (perianal fistula)           │
│                                                                    │
│ ⚠ GAPS IDENTIFIED BY POLICY ANALYSIS:                             │
│   • TB screening (QuantiFERON-TB Gold) - Required by both payers  │
│   • Hepatitis B screening - Required by UHC policy Section 4.2    │
│   • Prior therapy failure dates - Unclear (needed for step therapy)│
│                                                                    │
│ 💡 System Action: Provider documentation request auto-generated    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "Notice the system didn't just check boxes—it analyzed both payer policies and identified gaps that would cause denials later. Traditional automation would have submitted incomplete and failed."

---

### Step 2: Policy Analysis [2 minutes]

**What Happens**: Claude PA Skill analyzes both payer policies in parallel, extracting coverage criteria and assessing patient against each.

**Agentic Moment**: The system interprets policy *language*, not just codes. It reasons about whether clinical evidence satisfies requirements.

```
┌────────────────────────────────────────────────────────────────────┐
│ POLICY ANALYSIS RESULTS                                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ CIGNA COMMERCIAL PPO                                               │
│ ├─ Criteria Met: 4/5                                               │
│ │   ✓ Diagnosis: Crohn's disease (confirmed)                       │
│ │   ✓ Severity: Moderate-severe (CRP 28, ESR elevated)            │
│ │   ✓ Prior therapy: 2 failed conventional treatments              │
│ │   ✓ Prescriber: GI specialist (qualified)                        │
│ │   ⚠ TB screening: MISSING                                        │
│ ├─ Confidence: 92%                                                 │
│ └─ Likely Outcome: APPROVED (pending TB)                           │
│                                                                    │
│ UHC COMMERCIAL                                                     │
│ ├─ Criteria Met: 4/6                                               │
│ │   ✓ Diagnosis: Crohn's disease (confirmed)                       │
│ │   ✓ Severity: Moderate-severe with fistula                      │
│ │   ⚠ Step therapy documentation: INCOMPLETE                       │
│ │   ✓ Site of care: Outpatient infusion (appropriate)             │
│ │   ⚠ TB screening: MISSING                                        │
│ │   ⚠ Hepatitis B: MISSING                                         │
│ ├─ Confidence: 88%                                                 │
│ └─ Likely Outcome: LIKELY APPROVED (pending documentation)         │
│                                                                    │
│ 🔍 INSIGHT: UHC has stricter requirements (6 criteria vs 5)        │
│    This will influence strategy selection...                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "Claude PA Skill read both policy documents and mapped patient evidence to coverage criteria. Notice the confidence scores—the system quantifies its uncertainty. It also identified that UHC is stricter, which will matter in a moment."

---

### Step 3: Strategy Generation [1 minute]

**What Happens**: System generates 3 distinct access strategies with trade-offs.

**Agentic Moment**: The system doesn't just pick one path—it reasons about multiple approaches and scores them on conflicting objectives.

```
┌────────────────────────────────────────────────────────────────────┐
│ STRATEGY GENERATION                                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Strategy A: SEQUENTIAL (Primary First)                             │
│ ├─ Submit Cigna → Wait → Submit UHC                                │
│ ├─ Speed: 3/10 | Approval: 8/10 | Rework Risk: 2/10               │
│ └─ Total Score: 6.2                                                │
│                                                                    │
│ Strategy B: PARALLEL SUBMISSION                                    │
│ ├─ Submit both payers simultaneously                               │
│ ├─ Speed: 8/10 | Approval: 6/10 | Rework Risk: 5/10               │
│ └─ Total Score: 6.6                                                │
│                                                                    │
│ Strategy C: OPTIMIZED (Stricter First)                            │
│ ├─ Submit UHC first (stricter), then Cigna                        │
│ ├─ Speed: 6/10 | Approval: 9/10 | Rework Risk: 2/10               │
│ └─ Total Score: 7.6 ★ HIGHEST                                      │
│                                                                    │
│ Scoring Weights Applied:                                           │
│   Speed (30%) + Approval Prob (40%) + Low Rework (20%) + Patient Burden (10%)
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "Three strategies with explicit trade-offs. Strategy B is fastest but has higher risk of conflicting requests. Strategy C is recommended because clearing the stricter payer first means Cigna approval is almost guaranteed. This is judgment, not rule-following."

---

### Step 4: Strategy Selection [1 minute]

**What Happens**: System selects optimal strategy with full rationale.

**Agentic Moment**: The system explains *why* it chose this strategy and shows alternatives it rejected.

```
┌────────────────────────────────────────────────────────────────────┐
│ STRATEGY SELECTION                                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ▶ SELECTED: Strategy C - Optimized (UHC First)                     │
│                                                                    │
│ RATIONALE:                                                         │
│ "UHC has stricter criteria (6 vs Cigna's 5). Meeting UHC's        │
│  requirements means Cigna approval is highly probable. This        │
│  'solve the harder problem first' approach maximizes overall       │
│  approval confidence (92%) with acceptable speed trade-off."       │
│                                                                    │
│ Decision Maker: SYSTEM (auto-select: score delta > 1.0)            │
│                                                                    │
│ [View Alternative Outcomes] [Override Selection] [Proceed ▶]       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "The system selected autonomously because the score difference was significant. But notice the human override button—the system knows when to ask for help. This is the human-in-the-loop principle in action."

---

### Step 5: Counterfactual Display [1 minute]

**What Happens**: User clicks "View Alternative Outcomes" to see what would have happened with different strategies.

**Agentic Moment**: The system shows the road not taken—critical for stakeholder trust and clinical defensibility.

```
┌────────────────────────────────────────────────────────────────────┐
│ COUNTERFACTUAL ANALYSIS - What If?                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ IF WE HAD CHOSEN: Parallel Submission (Strategy B)                 │
│ ├─ Expected outcome: Both submissions at Day 1                     │
│ ├─ Risk materialized: UHC requests TB, Cigna requests TB           │
│ │   → Duplicate provider requests create confusion                 │
│ │   → Potential 3-day delay while coordinating responses           │
│ ├─ Likely total time: 10-15 days (vs. 10-14 for Strategy C)       │
│ └─ Why we didn't choose: Higher rework risk not justified by       │
│    marginal speed improvement                                      │
│                                                                    │
│ IF WE HAD CHOSEN: Sequential (Strategy A)                          │
│ ├─ Expected outcome: Cigna submission Day 1, UHC Day 10+          │
│ ├─ Risk: Patient has active fistula and 2 ER visits in 45 days   │
│ │   → 15-20 day timeline creates clinical risk                     │
│ ├─ Likely total time: 15-20 days                                  │
│ └─ Why we didn't choose: Speed penalty too high for urgent case   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "This is what makes the system defensible. A medical director can ask 'why didn't you just submit to both at once?' and the system has an answer. It's not just executing—it's reasoning and documenting."

---

### Step 6: Failure Injection - Denial Handling [2 minutes]

**What Happens**: Fast-forward to Day 5. UHC denies due to missing TB screening.

**Agentic Moment**: The system doesn't stop—it classifies the denial, analyzes root cause, and generates recovery options.

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠️  DENIAL RECEIVED - Day 5                                         │
├────────────────────────────────────────────────────────────────────┤
│ Payer: UHC                                                         │
│ Reason: Missing TB screening documentation (Policy 4.2.1)          │
│ Appeal Deadline: 21 days                                           │
│                                                                    │
│ SYSTEM CLASSIFICATION: RECOVERABLE                                 │
│ └─ This is a documentation gap, NOT a clinical denial              │
│                                                                    │
│ ROOT CAUSE ANALYSIS:                                               │
│ ├─ TB screening identified as gap at intake (Day 0)               │
│ ├─ Provider request sent Day 0                                     │
│ └─ Provider has not responded (5 days elapsed)                     │
│                                                                    │
│ RECOVERY OPTIONS GENERATED:                                        │
│                                                                    │
│ [1] Urgent Document Chase (Score: 7.2)                            │
│     Escalate to provider, obtain TB, resubmit                      │
│                                                                    │
│ [2] Parallel Recovery (Score: 6.8)                                │
│     Chase TB + prepare appeal simultaneously                       │
│                                                                    │
│ [3] Pivot to Cigna First (Score: 4.1) ⚠ NOT RECOMMENDED            │
│     Same gap exists - doesn't address root cause                   │
│                                                                    │
│ ▶ SELECTED: Urgent Document Chase                                  │
│   Rationale: Single missing item with high fix probability         │
│                                                                    │
│ ACTIONS TRIGGERED:                                                 │
│ ✓ Fax sent to Dallas GI Associates (urgent)                       │
│ ✓ Patient SMS: "Please contact your doctor about TB test"         │
│ ✓ Case flagged for 24-hour follow-up                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "This is the 'aha moment.' Traditional automation would have sent an alert and waited. This system diagnosed the denial, linked it to a known gap, generated three recovery strategies, selected the best one, and executed recovery actions—all autonomously. It's judgment under uncertainty."

---

### Step 7: Resolution [1 minute]

**What Happens**: Provider responds, system resubmits, approval achieved.

**Agentic Moment**: Full audit trail shows the complete decision journey.

```
┌────────────────────────────────────────────────────────────────────┐
│ ✅ CASE RESOLVED - Maria R.                                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ TIMELINE:                                                          │
│ Day 0:  Case intake, gaps identified, strategy selected            │
│ Day 1:  UHC PA submitted                                           │
│ Day 5:  UHC denial (missing TB)                                    │
│ Day 5:  Recovery strategy selected, provider escalated             │
│ Day 6:  TB results received, UHC resubmitted                       │
│ Day 9:  UHC APPROVED                                               │
│ Day 10: Cigna PA submitted (with UHC approval)                     │
│ Day 14: Cigna APPROVED                                             │
│                                                                    │
│ OUTCOME: Both payers approved, therapy scheduled                   │
│ Total Time: 14 days (vs. 20+ without adaptive recovery)            │
│                                                                    │
│ DECISION TRACE: 23 logged decisions                                │
│ [View Full Audit Trail]                                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Talk Track**: "Final outcome: both payers approved in 14 days. But more importantly, every decision is logged with rationale. A compliance audit can trace exactly why each choice was made. That's clinical defensibility built in."

---

### Key Demo Takeaways

| Traditional Automation | What This Demo Shows |
|------------------------|---------------------|
| Would have submitted incomplete | System identified gaps proactively |
| Would have failed at denial | System classified denial and recovered |
| Would have needed human at every decision | System acted autonomously with override option |
| Would have no explanation | Every decision documented with rationale |
| Would follow one workflow | System evaluated 3 strategies and selected optimal |

### Demo Success Criteria

After this walkthrough, stakeholders should be able to answer:

1. **"Why is this better than traditional automation?"**
   → It reasons, plans, adapts, and explains—not just executes rules

2. **"How do we know it made the right decision?"**
   → Full decision trace with alternatives considered and rationale documented

3. **"What happens when things go wrong?"**
   → Autonomous recovery with root cause analysis and strategy re-evaluation

4. **"Can humans intervene?"**
   → Yes, override available at every decision point with full visibility
