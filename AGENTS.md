# Autonomous AI Agent Operations Protocol (Backend)

> [!CAUTION]
> **STRICT COMPLIANCE REQUIRED**
> You are operating within a mission-critical, clinical-grade backend ecosystem. Treat every structural modification as an operational risk. **Always read this file and `MEMORY.md` before coding. Always update `MEMORY.md` after meaningful changes.**

## 1. Systemic Resilience & Defensive Programming
- **Idempotency awareness**: Frontend retries may occur; design mutations to tolerate duplicate submissions where feasible.
- **Fail fast**: Validate all payloads with Zod at the route boundary. Return `400` for malformed input.
- **Async isolation**: Every async route handler must use `try/catch` or centralized error middleware — never allow unhandled rejections.

## 2. Database Integrity & State Management
- **ACID transactions**: Multi-model writes (`PrescriptionRecord` + `PrescriptionItem`) **must** use `prisma.$transaction`.
- **Canonical naming**: Parent = `PrescriptionRecord`, child = `PrescriptionItem`. Never reintroduce `History` / `Prescription` table names.
- **Analysis cache**: `AnalysisCache` stores SHA-256 keyed Claude results to avoid duplicate paid API calls.
- **Migration authority**: Schema changes go through `schema.prisma` + `prisma/migrations/`. Never hand-edit production Neon without a migration record.

### Neon Drift Recovery
If Prisma reports migrations applied but Neon shows wrong/missing tables (e.g. old `History` table):
```bash
npm run db:push      # sync schema immediately
npm run db:migrate   # apply pending migrations
npm run db:generate  # refresh client
```

### Connection String
- Use `sslmode=verify-full` in `DATABASE_URL` (see `.env.example`).
- `src/lib/database.ts` normalizes legacy `require`/`prefer` modes automatically.

## 3. Security & Zero-Trust
- **Zero-secret commits**: `.env` is gitignored. Never commit `DATABASE_URL`, `ANTHROPIC_API_KEY`, or JWT secrets.
- **CORS**: Locked to `FRONTEND_URL` (default `http://localhost:3000`).
- **Rate limiting**: Global (100/15min) + AI endpoint (10/min).
- **Payload cap**: `express.json({ limit: "1mb" })`.
- **Error responses**: No stack traces in production (`NODE_ENV=production`).
- **Assume compromised client**: Validate everything server-side; no trust in frontend-only guards.

## 4. API Contract

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET | `/api/history` | List up to 100 `PrescriptionRecord` rows with nested `medications[]` + `analysis` DTO |
| POST | `/api/history` | Create record + items (accepts `medications` or legacy `prescriptions`) |
| POST | `/api/analyze` | Claude DDI check (min 2 drugs); DB cache lookup first |

### Response shapes
- Success: `{ status: "success", data: ... }`
- Error: `{ status: "error", message: "...", details?: ... }`

### Analyze behavior
- Returns `503` when `ANTHROPIC_API_KEY` is unset (expected in local dev until key is added).
- Returns `400` when fewer than 2 medications submitted — **no Claude call is made**.
- DB cache (`AnalysisCache`) keyed by SHA-256 of sorted medication fingerprint; cache read failure falls back to live API.
- Cache hit adds `cachedResult: true` to response JSON (frontend shows "Retrieved from cache", not raw JSON).
- Anthropic SDK errors (401/429/503/529) mapped to safe `{ status: "error", message }` responses.
- Parsed Claude output validated with Zod before returning to frontend.

## 5. Architectural Layout
```
Backend/
├── prisma/schema.prisma       # PrescriptionRecord, PrescriptionItem, AnalysisCache
├── prisma/migrations/         # Versioned SQL
├── src/index.ts               # Express bootstrap, security middleware
├── src/lib/database.ts        # Prisma + pg pool (SSL-normalized)
└── src/routes/
    ├── history.ts             # CRUD for prescription records
    └── analyze.ts             # Claude + AnalysisCache
```

Routes stay thin; extract to `src/services/` only when logic grows beyond ~80 lines.

## 6. Execution Workflow
1. Read `MEMORY.md` and this file.
2. Define input/output contract before coding.
3. Update `schema.prisma` + migration if schema changes.
4. Run `npm run db:generate` after schema changes.
5. Implement route with Zod validation + transaction where needed.
6. Verify with `npx tsc --noEmit` and live curl tests.
7. Append milestone to `MEMORY.md` with timestamp and verification results.

## 7. Verification Checklist (before declaring done)
- [ ] `npx tsc --noEmit` passes in `Backend/`
- [ ] `GET /health` returns 200
- [ ] `GET /api/history` returns `{ status: "success", data: [] }` (no P2021 table errors)
- [ ] `POST /api/history` creates record + items atomically
- [ ] `POST /api/analyze` returns `503` without API key (not 500)
- [ ] `POST /api/analyze` returns `400` with 1 drug
- [ ] `MEMORY.md` updated with timestamp
- [ ] No secrets in diff

## 8. npm Scripts Reference
| Script | Command |
|--------|---------|
| `npm run dev` | Start Express on port 5000 |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:push` | `prisma db push` (drift recovery) |
| `npm run db:studio` | Prisma Studio GUI |
