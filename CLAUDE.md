# Narayan Pharmacy - Backend Architecture & Developer Guide

## System Overview
Clinical-grade Express API for prescription storage and AI-driven drug interaction analysis.

### Core Technology Stack
- **Runtime**: Node.js + Express 5
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (Neon) via Prisma ORM
- **AI**: Anthropic Claude SDK (`POST /api/analyze`)

### Data Models
| Model | Role |
|-------|------|
| `PrescriptionRecord` | Parent encounter (patient, date, AI audit fields) |
| `PrescriptionItem` | Child medication rows (name, dosage, frequency) |
| `AnalysisCache` | SHA-256 keyed cache of Claude analyze results |

## Architectural Guidelines

### Security
- All secrets in `.env` (never committed)
- CORS restricted to `FRONTEND_URL`
- Global + AI-specific rate limiting
- Zod validation on every mutating route
- 1 MB JSON payload cap

### Database
- Use `prisma.$transaction` for record + item creation
- Run `npm run db:migrate` on deploy; `npm run db:push` for drift recovery
- Connection URL should use `sslmode=verify-full`

### API Routes
- `GET /health` — liveness
- `GET /api/history` — list records (DTO with `medications[]` + `analysis`)
- `POST /api/history` — create record + items
- `POST /api/analyze` — Claude DDI check with DB cache

## Developer Workflow
```bash
cp .env.example .env    # configure DATABASE_URL + ANTHROPIC_API_KEY
npm install
npm run db:generate
npm run db:migrate      # or db:push if tables missing
npm run dev             # http://localhost:5000
```

> [!NOTE]
> **AI Agent Instructions**: Read `AGENTS.md` for operational rules and `MEMORY.md` for history. Update `MEMORY.md` after every meaningful change.
