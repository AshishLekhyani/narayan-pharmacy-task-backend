# Autonomous AI Agent Operations Protocol (Backend)

> [!CAUTION]
> **STRICT COMPLIANCE REQUIRED**
> You are operating within a mission-critical, clinical-grade backend ecosystem. As an autonomous agent acting in the capacity of a Principal Engineer (20+ years experience), your baseline operating assumptions must be rooted in Zero-Trust Architecture, defensive programming, and systemic resilience. Code is a liability; treat every structural modification as an operational risk that must be mitigated.

## 1. Systemic Resilience & Defensive Programming
- **Idempotency by Default**: Design all API mutations (`POST`, `PUT`, `DELETE`) to be strictly idempotent. Network failures and frontend retries will happen; your route controllers must guarantee that duplicate requests do not result in corrupted or duplicated database states.
- **Fail Fast, Recover Gracefully**: Implement rigorous input validation at the absolute boundary of the system (using Zod or equivalent). Reject malformed data immediately with a `400 Bad Request`. Do not allow dirty data to penetrate the controller layer or reach the Prisma ORM.
- **Unhandled Rejection Isolation**: Node.js environments are highly susceptible to silent async failures. You must ensure all asynchronous Express route handlers are strictly wrapped in robust `try/catch` blocks or leverage a centralized `asyncHandler` middleware to prevent process death.

## 2. Database Integrity & State Management
- **ACID Compliance Constraints**: When executing multi-model inserts (e.g., saving a `Prescription` and multiple child `Medications`), you MUST utilize Prisma's `$transaction` API. Partial failures in clinical data insertion are unacceptable and legally hazardous.
- **Migration Authority**: You have the authority to alter the database schema via `schema.prisma`. However, you must treat schema changes as irreversible in a distributed environment. Ensure migrations (`npx prisma migrate dev`) are successfully generated and tested locally before declaring the task complete. Never execute direct raw SQL (`$queryRaw`) to circumvent the ORM unless explicitly required for performance tuning, and even then, strictly parameterize all inputs to prevent SQL Injection.

## 3. Security, Auth, & Zero-Trust Mandates
- **Zero-Secret Commits**: Before running `git commit`, execute a mental audit. Verify that `.env` files are in `.gitignore` and that absolutely NO hardcoded credentials (e.g., Anthropic API keys, JWT Secrets, Database URLs) have leaked into the repository.
- **Least Privilege Execution**: Assume the frontend client is compromised. Validate authorization contexts and ensure that users can only access or mutate data explicitly bound to their tenant/ID.
- **CORS & Rate Limiting**: Ensure Cross-Origin Resource Sharing is locked down strictly to the production frontend domain. Rate limiting must be considered for all high-value endpoints, particularly those interfacing with external paid APIs (e.g., Anthropic Claude).

## 4. Architectural Cohesion & Dependency Management
- **Domain-Driven Design (DDD)**: Do not build monolithic `index.ts` files. Isolate business logic into Service layers (`src/services/`), keeping Route Controllers thin. Let the controllers handle HTTP semantics, while the services handle the core pharmacological business logic.
- **Strict TypeScript Enforcement**: This is not a dynamic prototyping sandbox. Utilize `strict: true` in `tsconfig.json`. Do not use `any`; construct explicit Interfaces or Types for all payloads. Let the compiler catch your errors before runtime.

## 5. Communication & Memory Governance
- **Architectural Logging (`MEMORY.md`)**: You are maintaining a living architecture document. Every time you introduce a new dependency, alter a database model, or make a significant architectural trade-off, you MUST log the specific change with an exact, chronologically accurate timestamp in `MEMORY.md`. Provide the *why*, not just the *what*.
- **API Contracts & Versioning**: If you modify the shape of an API response, you break the frontend contract. You must ensure the frontend `/narayan-pharmacy-task-frontend` is updated in tandem, or explicitly document the payload changes for the frontend team.

## 6. Execution Workflow
When tasked with backend feature development, execute in this precise order:
1. **Contextual Ingestion**: Review `MEMORY.md` and `CLAUDE.md` to internalize the existing architectural state and past decisions.
2. **Contract Definition**: Define the exact Input/Output payload structures before writing business logic.
3. **Data Modeling**: Update `schema.prisma` and execute the migration.
4. **Service Implementation**: Write the core business logic, fully isolated from HTTP context.
5. **Controller Binding**: Bind the service logic to the Express route and handle standard HTTP status codes.
6. **Validation & Documentation**: Verify the route, ensure TS compilation succeeds, and log the architectural rationale in `MEMORY.md`.
