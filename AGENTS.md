# AI Agent Guidelines (Backend)

1. **Safety & Security First**
   - NEVER expose `.env` variables or API Keys in commits.
   - Sanitize all database inputs to prevent SQL Injection.
   
2. **Standardized Communication**
   - Maintain a clear, concise log of all API Routes created in `MEMORY.md`.
   - Any changes to database schemas must be properly migrated and documented.
   
3. **Execution Context**
   - You are operating inside the `/Backend` directory of the Narayan Pharmacy project.
   - Default to TypeScript if building new models or APIs unless otherwise requested.
   - Refer to `/narayan-pharmacy-task-frontend` if you need to inspect the data shapes expected by the client.
