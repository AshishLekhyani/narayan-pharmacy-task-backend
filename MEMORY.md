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

### [June 11, 2026 - 6:23 PM] Database Modeling (Prisma)
### Backend Overview
- **Database Framework:** Prisma ORM connected to Neon PostgreSQL.
- **Data Architecture:** 
  - `History`: Represents the pharmacy transaction (formerly Prescription). Contains `patientName`, `date`, and AI analysis metadata.
  - `Prescription`: Represents the specific drugs entered in a History record (formerly Medication). Contains `name`, `dosage`, `frequency`, and links to a `History` via `historyId`.
- **Security:** Strict `zod` validation blocks invalid payloads before DB queries. Rate limiting applied globally.
- **REST APIs:**
  - `POST /api/analyze`: Validates inputs with Claude 3.5 Sonnet.
  - `GET /api/history`: Retrieves chronologically sorted pharmacy records.
  - `POST /api/history`: ACID-compliant creation of a History record along with nested Prescriptions. simultaneously. Added a GET route to hydrate the frontend History page.

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
