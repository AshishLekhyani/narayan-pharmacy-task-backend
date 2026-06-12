import { Prisma } from "@prisma/client";

export function mapPrismaError(error: unknown): { status: number; message: string } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return { status: 409, message: "A record with this data already exists." };
      case "P2025":
        return { status: 404, message: "The requested record was not found." };
      case "P2003":
        return { status: 400, message: "Invalid reference in the request payload." };
      default:
        return { status: 500, message: "A database error occurred. Please try again." };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, message: "The database is temporarily unavailable." };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: "Invalid data sent to the database layer." };
  }

  return null;
}
