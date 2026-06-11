# AI Instructions & Style Guide for Narayan Pharmacy Backend

## Tech Stack
- **Framework:** Express.js (Node.js)
- **Database:** PostgreSQL
- **Migrations/Models:** Prisma ORM (Recommended) or Sequelize (TBD)
- **AI Integration:** Anthropic Claude 3 SDK

## Architecture Rules
1. **Never Hardcode Secrets**: `ANTHROPIC_API_KEY` and Database URLs must live in `.env` and be accessed via `process.env`.
2. **RESTful APIs**: Build clean, resource-oriented endpoints.
3. **Structured Logging**: Log request errors clearly.
4. **Error Handling**: Graceful fallback and specific status codes (400, 401, 500).

## AI Agent Protocol
- Keep `MEMORY.md` updated with every architectural decision or route addition.
- Refer to the frontend repository guidelines if unsure about data shapes.
