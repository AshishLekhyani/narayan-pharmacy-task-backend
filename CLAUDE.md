# Narayan Pharmacy - Backend Architecture & Developer Guide

## System Overview
The Narayan Pharmacy Backend is a high-availability, clinical-grade API built to support electronic prescription entry, persistent medical record storage, and AI-driven pharmacokinetic interaction analysis.

### Core Technology Stack
- **Runtime Framework**: Node.js with Express.js
- **Language**: TypeScript (Strict Mode Enforced)
- **Database Engine**: PostgreSQL (Neon Serverless)
- **ORM & Migrations**: Prisma ORM
- **AI/LLM Provider**: Anthropic Claude 3 SDK

---

## Architectural Guidelines

### 1. Security & Data Privacy
- **Strict Environment Isolation**: Absolutely no hardcoding of API keys or Database URLs in the source code. All sensitive variables must be routed through `process.env`.
- **CORS Policies**: Cross-Origin Resource Sharing must be explicitly restricted to the Next.js frontend domain during production.
- **Data Validation**: Never trust client inputs. Validate all incoming payload structures (e.g., using Zod or manual type-checking) before executing Prisma queries or Claude API calls.

### 2. Database & Models (Prisma)
- **Migrations First**: Do not execute raw SQL. All structural database changes must be executed through `schema.prisma` and deployed via `npx prisma migrate dev`.
- **Relational Integrity**: Enforce foreign key constraints between `PrescriptionRecord` and `PrescriptionItem`. Use Cascade deletes where appropriate.

### 3. API Route Structure
- **Modularity**: Isolate routes into a `src/routes/` directory. Do not clutter the primary `index.ts` or `server.ts` entry point.
- **Standardized Responses**: Use predictable JSON structures for all endpoints:
  - Success: `{ status: "success", data: { ... } }`
  - Error: `{ status: "error", message: "..." }`
- **Graceful Error Handling**: Catch all asynchronous errors to prevent server crashing. Utilize a centralized error-handling middleware.

---

## AI Integration Protocol (Claude 3)
When modifying the `/api/analyze` route that interfaces with Anthropic:
- **System Prompts**: The prompt engineered for Claude must strictly instruct it to act as a clinical pharmacologist. It must output parsable JSON containing severity, primary warnings, and specific clinical impacts.
- **Resilience**: Implement timeout boundaries and fallback error messages if the AI provider experiences latency.

## Developer Workflow
1. Pull latest database state: `npx prisma db pull` (if connecting to existing) or `npx prisma migrate dev` (for local changes).
2. Generate Prisma Client: `npx prisma generate`
3. Run Development Server: `npm run dev` (utilizing `ts-node` or `ts-node-dev`).
