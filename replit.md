# Agentic Access Strategy Platform

## Overview
An autonomous prior authorization workflow orchestration platform. Uses AI agents (Claude, Gemini, Azure OpenAI) to analyze medical policies, generate strategies, and coordinate actions for prior authorization cases.

## Architecture
- **Backend**: Python FastAPI application (port 8000 in dev)
- **Frontend**: React + TypeScript + Vite (port 5000 in dev)
- **Database**: PostgreSQL (via Replit built-in DB, using asyncpg + SQLAlchemy async)

## Project Structure
```
backend/          - FastAPI backend
  agents/         - AI agent implementations
  api/routes/     - API route handlers
  config/         - Settings and logging config
  mcp/            - MCP tool integrations
  mock_services/  - Demo scenario data
  models/         - Pydantic data models
  orchestrator/   - Case workflow orchestration
  policy_digitalization/ - Policy processing pipeline
  reasoning/      - LLM client integrations
  storage/        - Database models and repositories
frontend/         - React frontend
  src/components/ - UI components
  src/hooks/      - React Query hooks
  src/lib/        - Utilities, constants, animations
  src/pages/      - Page components
  src/services/   - API and WebSocket clients
  src/types/      - TypeScript type definitions
policies/         - PDF policy documents
prompts/          - LLM prompt templates
data/             - Local data directory
```

## Key Configuration
- API keys (Anthropic, Gemini, Azure OpenAI) are optional - app runs in degraded mode without them
- CORS is configured to allow all origins
- Frontend proxies `/api` and `/ws` requests to backend in development
- Backend converts DATABASE_URL to asyncpg format automatically
- Vite dev server binds to 0.0.0.0:5000 with all hosts allowed

## Running
Single workflow runs both backend and frontend:
- Backend: `python -m uvicorn backend.main:app --host localhost --port 8000`
- Frontend: `npm run dev` (Vite on port 5000)

## Deployment
- Build: `cd frontend && npm run build`
- Run: Backend serves static frontend files from `frontend/dist/` when available
