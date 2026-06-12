import type { Response } from "express";
import type { ZodError } from "zod";

export type ApiErrorBody = { status: "error"; message: string };
export type ApiSuccessBody<T> = { status: "success"; data: T };

export function firstZodIssueMessage(error: ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ status: "error", message } satisfies ApiErrorBody);
}

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ status: "success", data } satisfies ApiSuccessBody<T>);
}
