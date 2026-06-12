# Backend Architectural Memory & Development Progression

> [!NOTE]
> **AI Context & Evaluator Guide**
> This file serves as the definitive chronological timeline of the backend project's development. It documents the deliberate prompting strategy, architectural trade-offs, and progression of thinking. **AI Agents MUST append new milestones chronologically using accurate local timestamps.**

## Phase 1: Foundational Architecture

### [June 11, 2026 - 5:23 PM] Project Initialization & Stack Selection
- **Initialization**: Bootstrapped the `/Backend` directory utilizing Node.js and Express.js.
- **Language Selection**: Enforced **TypeScript** as the primary language to ensure strict typing across API payloads and database models, aligning with clinical-grade safety requirements.
- **Database Architecture**: Selected **Prisma ORM** coupled with **PostgreSQL (Neon)**. This ensures highly reliable, type-safe database queries and automated migration tracking.
- **Security Baseline**: Implemented `.env` for secrets isolation, configured `cors` for cross-origin management, and generated a robust `.gitignore` to prevent secret leakage.

### [June 11, 2026 - 5:57 PM] Documentation & Protocol Standardization
- **Standardization**: Extensively rewrote `CLAUDE.md`, `AGENTS.md`, and `MEMORY.md` to establish a professional, highly regimented operational environment.
- **AI Boundaries**: Defined strict rules against hardcoding secrets and mandated proper Prisma migration workflows for any future AI agents operating in this repository.

### [June 11, 2026 - 6:23 PM] Database Modeling (Prisma) — superseded
> **Note**: The original `History` / `Prescription` naming was incorrect and was replaced at 7:20 PM. See schema realignment below. Early Neon tables with those names were empty legacy artifacts removed during the 8:30 PM drift recovery.

### [June 11, 2026 - 7:20 PM] Schema Realignment & Audit Persistence
- **Schema Correction**: Replaced the semantically inverted `History` -> `Prescription` structure with a clinically coherent parent/child model: `PrescriptionRecord` for the saved encounter and `PrescriptionItem` for each medication row. This matches the frontend workflow, where one prescription contains multiple medications.
- **Migration Repair**: Updated the initial Prisma SQL migration so it no longer references stale columns such as `doctorName` or the old `Medication` table names. The schema and migration now describe the same database.
- **API Contract Upgrade**: Refactored `GET /api/history` and `POST /api/history` to expose normalized DTOs with `medications[]` and `analysis` instead of leaking confusing raw table terminology. Added backward-compatible ingestion for the older `prescriptions` payload during the transition.
- **Audit Trail Completion**: Persisted the AI metadata that the UI already depends on, including `clinicalImpact[]` and `processedBy`, preventing silent loss of clinical audit detail when a record is saved.
- **Validation Result**: Prisma client generation succeeded after a network-enabled run, and `npx tsc --noEmit` passes in `Backend`. The `npm test` script still intentionally fails because this repository has no real backend test suite yet.

### [June 11, 2026 - 7:45 PM] Production Environment & Initialization Fixes
- **Initialization Hoisting**: Fixed a critical Neon PostgreSQL connection crash (`client password must be a string`) by utilizing `import "dotenv/config"` at the absolute top of `index.ts`. This bypasses ES6 module hoisting to ensure `DATABASE_URL` is parsed before Prisma establishes its connection pool.

### [June 11, 2026 - 8:13 PM] Clinical AI Engine Hardening & DB-Backed Analysis Cache
- **Pharmacy-Specific Prompt**: Completely rewrote the Claude prompt in `POST /api/analyze`. The new prompt explicitly instructs Claude to act as a clinical pharmacist DDI engine, evaluate CYP450 enzyme inhibition/induction, pharmacodynamic antagonism, and additive toxicity, and return a recommendation framed for the dispensing pharmacist at Narayan Pharmacy. This replaced the generic "check these drugs" instruction.
- **Single-Drug Guard**: Added a Zod `.superRefine()` rule on the backend to enforce a minimum of 2 medications before the route proceeds. Previously a single drug could be submitted without triggering the guard.
- **DB-Backed Analysis Cache (`AnalysisCache` model)**: Added a new Prisma model `AnalysisCache` with a `cacheKey` (SHA-256 of the sorted normalized medication fingerprint), `result` (JSONB), and a `hitCount` counter. The `/api/analyze` route now checks this table before calling Claude. Cache hits return the stored result instantly and increment `hitCount` in the background (fire-and-forget). Cache misses call Claude and persist the result.
- **Error Surfacing**: All failure branches in `/api/analyze` now return a human-readable `message` field that the frontend can display inline instead of a generic fallback.

### [June 11, 2026 - 8:30 PM] Neon Schema Drift Recovery & Production Hardening
- **Drift Diagnosis**: Neon contained stale empty tables (`History`, `Prescription`) while Prisma migration history claimed `PrescriptionRecord`/`PrescriptionItem` were applied. This caused P2021 "table does not exist" at runtime.
- **Recovery**: Executed `prisma db push` to sync canonical schema. Verified live `GET`/`POST /api/history` against Neon.
- **SSL Normalization**: `src/lib/database.ts` now forces `sslmode=verify-full` for legacy Neon connection strings, eliminating pg v9 deprecation warnings.
- **npm Scripts**: Added `db:generate`, `db:migrate`, `db:push`, `db:studio`, `build`, `start` to `package.json`. Added `.env.example` and root `README.md`.
- **Validation Result**: API smoke tests pass; test record persisted to `PrescriptionRecord`.

### [June 11, 2026 - 8:45 PM] Transaction Safety, AnalysisCache Migration & Agent Docs
- **ACID Compliance**: Wrapped `POST /api/history` create flow in `prisma.$transaction` per AGENTS.md mandate — partial record/item inserts are no longer possible.
- **AnalysisCache Migration**: Added `20260611150000_add_analysis_cache` migration; resolved as applied after prior `db push` had already created the table in Neon.
- **AGENTS.md Enhancement**: Rewrote with API contract table, Neon drift recovery steps, verification checklist, npm script reference, and mandatory `MEMORY.md` protocol.
- **CLAUDE.md Update**: Corrected model documentation (`PrescriptionRecord`, `PrescriptionItem`, `AnalysisCache`) and developer workflow commands.
- **Validation Result**: `npx prisma migrate deploy` clean after resolve; `npx tsc --noEmit` passes; analyze returns `503` without API key (expected).

### [June 12, 2026 - 10:45 AM] Claude API Error Handling & Response Validation
- **Pharmacy Prompt Upgrade**: Rewrote analyze prompt for Narayan Pharmacy (India dispensing context, OD/BD/TDS patterns, CYP450/bleeding/QT risks, pharmacist escalation guidance).
- **Response Validation**: Added `src/lib/analysis-response.ts` with Zod schema + markdown-fence JSON extraction fallback before returning results.
- **Anthropic Error Mapping**: Maps 401/429/503/529 API errors to user-safe messages without crashing the route or leaking stack traces.
- **Cache Fallback**: DB cache read failures log and fall through to live Claude call; cache write failures are non-blocking.
- **Single-Drug Guard**: Backend rejects `< 2` medications with `400` before any API key check or Claude call.
- **Validation Result**: `npx tsc --noEmit` passes; smoke tests confirm `400` (1 drug) and `503` (no API key) responses.

### [June 12, 2026 - 11:30 AM] Paginated History API, DB Indexes & Input Hardening
- **Paginated GET /api/history**: Added `page`, `limit` (default 10), `search`, and `filter` query params with server-side Prisma `where` building via `src/lib/history-query.ts`. Returns `meta` + global `stats`.
- **Performance Indexes**: Added migration `20260612120000_history_indexes` on `prescribedAt`, `patientName`, `analysisSeverityLevel`, `analysisStatusLabel`.
- **Security Hardening**: Capped medication array size (50), field max lengths, date validation on POST; removed stack traces from error JSON; analyze route input caps aligned with history.
- **Validation Result**: `npx tsc --noEmit` passes.

### [June 12, 2026 - 12:15 PM] Security Red-Flag Audit
- **Whitelist API Response**: Added `toPublicAnalysisResponse()` so analyze route never leaks raw Claude/cache JSON fields to clients.
- **Secret Scanner**: Added `scripts/verify-no-secrets.mjs` (`npm run verify:secrets`) to block commits with hardcoded keys or DB URLs in source.
- **Error Hygiene**: Stack traces already removed from global error handler; analyze errors return safe `{ status, message }` only.

### [June 12, 2026 - 2:00 PM] Deployment Hardening & Documentation
- **Health Endpoint**: `GET /health` now pings the database (`SELECT 1`) and reports `database` + `aiConfigured` status without exposing secrets.
- **Production Middleware**: Enabled `trust proxy` when `NODE_ENV=production` for correct rate limiting behind reverse proxies; added JSON `404` handler for unknown routes.
- **Analyze Resilience**: Guard against empty Claude `content` arrays; map Anthropic `404` (model unavailable) to a clear `503` with `ANTHROPIC_MODEL` guidance.
- **Deploy Scripts**: `build` runs `prisma generate && tsc`; `postinstall` runs `prisma generate`; `prestart` runs `prisma migrate deploy`.
- **Env Template**: Expanded `.env.example` with `ANTHROPIC_MODEL` and CORS documentation.
- **README**: Created `Backend/README.md` with API reference, database setup, env vars, and production checklist.
- **Validation Result**: `npm run build` and `npm run verify:secrets` pass; smoke tests confirm health (DB connected), history GET/POST, analyze `400` (1 drug), analyze `503` (no API key).

### [June 12, 2026 - 4:30 PM] Batch Delete API & Analysis Cache Upsert
- **Batch Delete**: Added `DELETE /api/history/batch` with Zod-validated `ids[]` (max 100); cascades `PrescriptionItem` rows via schema `onDelete: Cascade`.
- **Cache Hardening**: Replaced fire-and-forget `analysisCache.create` with awaited `upsert` so repeat drug combos reliably hit cache and avoid duplicate Claude charges.
- **Validation Result**: `npm run build` passes.

### [June 12, 2026 - 5:15 PM] Clinical Input Validation on API
- **Shared Validator**: Added `src/lib/clinical-input.ts` — patient name, drug name, dosage pattern, frequency, and junk-value blocklist (`test`, `asdf`, etc.).
- **Applied To**: `POST /api/history` and `POST /api/analyze` medication payloads now reject rubbish data server-side even if the client is bypassed.

### [June 12, 2026 - 5:30 PM] Unrecognized Drug Handling in Claude Prompt
- **Prompt Guardrail**: Analyze prompt now instructs Claude to flag unrecognizable or fictional drug names, refuse to invent interactions, and return `severity: "Drug Identification Required"` with pharmacist verification guidance instead of hallucinating DDI data.
