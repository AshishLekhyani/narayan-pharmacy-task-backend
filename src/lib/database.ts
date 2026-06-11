import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

function normalizeDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  // Explicit verify-full avoids pg v9 deprecation warnings for require/prefer aliases.
  if (!sslMode || sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const normalizedDatabaseUrl = normalizeDatabaseUrl(databaseUrl);
const pool = new Pool({ connectionString: normalizedDatabaseUrl });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
