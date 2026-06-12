# Narayan Pharmacy — Backend

Express + TypeScript API for prescription persistence, paginated history, and Claude-powered drug-interaction analysis. Uses **Prisma 7** with **Neon PostgreSQL**.

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+, Express 5, TypeScript |
| Database | PostgreSQL (Neon) via Prisma + `@prisma/adapter-pg` |
| AI | Anthropic Claude SDK (`@anthropic-ai/sdk`) |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit |

## Features

- **Prescription CRUD** — transactional save of `PrescriptionRecord` + `PrescriptionItem` rows
- **Paginated history** — server-side search, filters, and global stats
- **AI analysis** — pharmacy-specific DDI prompt for Narayan Pharmacy (India context)
- **DB cache** — SHA-256 keyed `AnalysisCache` avoids duplicate Claude calls for identical drug combos
- **Input hardening** — Zod validation, payload size limits, field length caps
- **Safe errors** — no stack traces in production; Anthropic errors mapped to user-facing messages

## Prerequisites

- Node.js 20+
- Neon PostgreSQL database ([neon.tech](https://neon.tech))
- Anthropic API key (required for 2+ drug analysis; optional for local history-only testing)

## Local development

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL (and ANTHROPIC_API_KEY when ready)

npm install
npm run db:generate
npm run db:migrate    # or npm run db:push if migrations are out of sync
npm run dev           # http://localhost:5000
```

### Database drift recovery

If Neon has stale tables (`History`, `Prescription`) or Prisma reports P2021 errors:

```bash
npm run db:push
npm run db:migrate
npm run db:generate
```

### Failed migration P3018 (index already exists)

If `prisma migrate deploy` fails with `relation "..._idx" already exists`, indexes were likely created by an earlier `db push`. Mark the migration as applied (indexes already present):

```bash
npx prisma migrate resolve --applied "20260612120000_history_indexes"
npx prisma migrate status   # should show all migrations applied
```

Then redeploy on Render.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL URL (`sslmode=verify-full` recommended) |
| `ANTHROPIC_API_KEY` | For AI | Claude API key — analyze returns `503` if unset |
| `FRONTEND_URL` | Yes (prod) | Browser origin for CORS (e.g. `http://localhost:3000`) |
| `PORT` | No | Default `5000` |
| `NODE_ENV` | Prod | Set to `production` when deployed |
| `ANTHROPIC_MODEL` | No | Default `claude-sonnet-4-6`; try `claude-3-5-sonnet-20241022` if unavailable |

`src/lib/database.ts` normalizes legacy `sslmode=require` / `prefer` to `verify-full` automatically.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with `ts-node` |
| `npm run build` | `prisma generate` + TypeScript compile → `dist/` |
| `npm start` | Run `dist/index.js` (`prestart` runs `prisma migrate deploy`) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema without migration (recovery) |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run verify:secrets` | Scan source for hardcoded keys/URLs |

## API reference

### `GET /health`

Liveness + database connectivity.

```json
{
  "status": "success",
  "message": "Narayan Pharmacy API is operational.",
  "database": "connected",
  "aiConfigured": true
}
```

### `GET /api/history`

Paginated prescription list.

| Query param | Default | Description |
|-------------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `10` | Page size (max 50) |
| `search` | — | Patient name or medication (case-insensitive) |
| `filter` | `all` | `all` \| `high` \| `flagged` \| `safe` |

Response includes `data[]`, `meta` (pagination), and global `stats`.

### `POST /api/prescriptions/analyze-and-save`

Analyze medications and persist the prescription in one step (primary entry flow).

```json
{
  "patientName": "Jane Doe",
  "date": "2026-06-12",
  "medications": [
    { "name": "Warfarin", "dosage": "5mg", "frequency": "OD (Once Daily)" }
  ]
}
```

Returns `{ status: "success", data: { analysis, record } }`.

### `POST /api/history` (deprecated)

Returns **410 Gone**. Use `POST /api/prescriptions/analyze-and-save` instead.

Legacy example (no longer accepted):

```json
{
  "patientName": "Jane Doe",
  "date": "2026-06-12",
  "medications": [
    { "name": "Warfarin", "dosage": "5mg", "frequency": "OD (Once Daily)" }
  ],
  "aiAnalysis": {
    "severity": "Verified Safe",
    "severityLevel": "low",
    "primaryWarning": "...",
    "recommendation": "...",
    "clinicalImpact": ["..."],
    "processedBy": "Claude API — Narayan Pharmacy DDI Engine"
  }
}
```

Also accepts legacy `prescriptions` key (same shape as `medications`).

### `POST /api/analyze`

Drug-interaction check via Claude. **Requires ≥ 2 medications.**

- Returns `400` for fewer than 2 drugs (no API call)
- Returns `503` if `ANTHROPIC_API_KEY` is unset
- Returns `200` with whitelisted clinical fields + `cachedResult: true` on cache hit

Rate limit: 10 requests/minute per IP (plus global 100/15min).

## Database schema

| Model | Purpose |
|-------|---------|
| `PrescriptionRecord` | Parent encounter (patient, date, AI analysis columns) |
| `PrescriptionItem` | Child medication rows |
| `AnalysisCache` | Cached Claude results keyed by sorted drug fingerprint |

Migrations live in `prisma/migrations/`.

## Project structure

```
src/
├── index.ts              # Express app, middleware, routes
├── routes/
│   ├── analyze.ts        # Claude + cache
│   └── history.ts        # GET/POST history
└── lib/
    ├── database.ts       # Prisma + pg pool
    ├── analysis-response.ts  # Zod parse + public DTO whitelist
    └── history-query.ts  # Search/filter/pagination builder
prisma/
├── schema.prisma
└── migrations/
```

## Production deployment

Deploy as a standalone Node service (Render, Railway, Fly.io, etc.).

```bash
npm run build
npm start
```

> **Render note:** If `NODE_ENV=production` is set during the build phase, npm skips `devDependencies`. This repo keeps `typescript`, `prisma`, and `@types/*` in `dependencies` so production builds succeed. Alternatively, set `NPM_CONFIG_PRODUCTION=false` for the build step on Render.

- `postinstall` runs `prisma generate`
- `prestart` runs `prisma migrate deploy`

### Required production env

1. `DATABASE_URL`
2. `ANTHROPIC_API_KEY`
3. `FRONTEND_URL` — must match the deployed frontend origin
4. `NODE_ENV=production`

Pair with the frontend: set the frontend's `BACKEND_INTERNAL_URL` to this service's public URL.

### Pre-launch checklist

- [ ] `GET /health` → `database: connected`, `aiConfigured: true`
- [ ] `GET /api/history` returns data
- [ ] `POST /api/analyze` with 2 drugs returns clinical JSON
- [ ] `npm run verify:secrets` passes

## Security

- `.env` is gitignored; never commit secrets.
- CORS locked to `FRONTEND_URL`.
- Helmet HTTP headers, 1 MB JSON body limit, rate limiting.
- Analyze responses whitelisted via `toPublicAnalysisResponse()` — no raw Claude JSON leakage.
- Run `npm run verify:secrets` before pushing.

## Related docs

- [`AGENTS.md`](./AGENTS.md) — AI agent operational rules
- [`MEMORY.md`](./MEMORY.md) — chronological development log
