# Demo Flow / Script

## 1. Prerequisites

1. **Start backend:** `source venv/bin/activate && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`
2. **Start frontend:** `cd frontend && npm run dev` (serves on `:3000`, proxies `/api` to backend)
3. **Verify health:** `curl http://localhost:8000/health` -- all components should report status
4. **Set scenario** (optional): `curl -X POST http://localhost:8000/api/v1/scenarios/happy_path`

Default scenario is `happy_path`. Switch before creating a case to demo other workflows.

---

## 2. Happy Path Walkthrough (Primary Demo)

**Setup:** Scenario = `happy_path` (default)

### Step 1: Dashboard
- Open `http://localhost:3000`
- User sees the PA Specialist Workspace with case queue (Needs Attention / In Progress / Completed)
- Right sidebar shows performance stats and AI activity feed
- Click **"New Case"**

### Step 2: Create Case
- Select **Maria Rodriguez** (38F, Crohn's with fistula, Infliximab, Cigna + UHC)
- Click **"Start Case"**
- Backend creates case via `POST /api/v1/cases`, navigates to CaseDetail

### Step 3: Review (Wizard Step 1)
- Patient data displayed: demographics, clinical profile, diagnosis codes, medications
- Supporting documents listed (5 PDFs for Maria)
- MCP validations run automatically during intake (NPI, ICD-10, CMS)
- Click **"Begin AI Analysis"** to advance

### Step 4: AI Analysis (Wizard Step 2)
- Backend calls `POST /api/v1/cases/{id}/run-stage/policy_analysis`
- Claude analyzes coverage against Cigna and UHC policies
- Toggle between payer tabs to see per-payer coverage assessment
- PolicyValidationCard shows criteria met/not met
- PayerComparisonCard shows side-by-side summary
- Click **"Continue to Decision"**

### Step 5: Human Decision Gate (Wizard Step 3)
- AI recommendation displayed with coverage status and confidence
- Documentation gaps listed (if any)
- **Four action buttons:** Approve, Override, Reject, Escalate
- For happy path: click **"Approve"**
- Backend calls `POST /api/v1/cases/{id}/confirm-decision` with `action: "approve"`
- Orchestrator resumes via `resume_after_human_decision()`

### Step 6: Strategy (Wizard Step 4)
- Click **"Generate Submission Plan"**
- Backend generates and scores strategies deterministically
- Strategy card shows: Sequential Primary-First, approval score, estimated days, risks
- Strategic Intelligence panel available (historical pattern analysis)
- Select strategy, click **"Approve & Continue"**

### Step 7: Submit & Monitor (Wizard Step 5)
- Auto-submits PA to Cigna (primary) first
- Payer status cards update: Cigna SUBMITTED -> APPROVED
- UHC auto-submitted next: SUBMITTED -> APPROVED
- Both payers show APPROVED status
- Click **"Mark as Complete"**

### Step 8: Completion
- "Workflow Complete" summary with final payer status grid
- **Audit Trail** button (eye icon) opens full decision history with timestamps

---

## 3. Scenario Variations

Switch scenario before creating a new case: `POST /api/v1/scenarios/{scenario_id}`

### Missing Documentation (`missing_docs`)
- Same flow through Step 5
- At monitoring: UHC returns `PENDING_INFO` (requests TB screening)
- System detects documentation gap, notifies user
- **Demo highlight:** Gap detection and adaptive document handling

### Primary Denial (`primary_deny`)
- Same flow through Step 5
- At monitoring: Cigna returns `DENIED` (step therapy not met)
- Orchestrator triggers RECOVERY stage automatically
- Recovery agent classifies denial, generates appeal strategy via Claude
- Action coordinator submits appeal to Cigna
- **Demo highlight:** Automatic denial detection, appeal generation, recovery workflow

### Recovery Success (`recovery_success`)
- Same as primary denial, but on second status check Cigna returns `APPEAL_APPROVED`
- Full cycle: submission -> denial -> appeal -> approval
- **Demo highlight:** End-to-end appeal workflow with P2P recovery option

### Secondary Denial / Biosimilar Redirect (`secondary_deny`)
- Cigna approves, UHC denies with biosimilar redirect
- Recovery initiates formulary exception handling
- **Demo highlight:** Biosimilar substitution logic, clinical justification

### Dual Approval (`dual_approval`)
- Cigna: slow approval, UHC: fast approval
- Strategy scoring demonstrates timing-aware sequencing
- **Demo highlight:** How deterministic scoring adapts to payer response patterns

---

## 4. Key Demo Talking Points

| Stage | What to Highlight |
|-------|------------------|
| **Policy Analysis** | Claude reasons across both payer policies simultaneously -- not checklist matching |
| **Human Decision Gate** | AI never auto-denies; conservative model escalates borderline cases to human |
| **Strategy Scoring** | Deterministic, auditable formula -- same inputs always produce same outputs |
| **Recovery** | System autonomously detects denial, classifies reason, selects optimal recovery path |
| **Audit Trail** | Every decision cryptographically chained -- tamper-evident compliance record |
| **MCP Integration** | Live validation of NPI, ICD-10, and CMS coverage during intake |

---

## 5. Additional Demo Paths

- **Policy Library:** Navigate to Policies page to browse digitized payer criteria (Cigna has full digitized JSON; UHC available as raw text)
- **Strategic Intelligence:** From CaseDetail Step 4, the intelligence panel shows historical pattern analysis (on-demand via `GET /api/v1/cases/{id}/strategic-intelligence`)
- **Activity Feed:** Dashboard right sidebar shows real-time AI agent actions sourced from the audit trail
- **Scenario Switching:** `GET /api/v1/scenarios` lists all available scenarios with current selection
