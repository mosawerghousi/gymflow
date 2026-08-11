import { NextResponse } from "next/server";
import { z } from "zod";

import { isDomainError, type DomainErrorCode } from "@/domain/errors";

/**
 * The whole HTTP surface of a route handler.
 *
 * Handlers stay thin (spec §4): parse with a Zod DTO, call the use case, and
 * let this module turn the result — or the domain error — into a response.
 */

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DEMO_RESTRICTED: 403,
};

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 });
}

/** Maps any thrown value to the right status code and a safe message. */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (isDomainError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: STATUS_BY_CODE[error.code] },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "The request could not be validated.",
          details: { issues: error.flatten().fieldErrors },
        },
      },
      { status: 400 },
    );
  }

  console.error("[gymflow] unhandled route error", error);

  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/** Wraps a handler so every domain error becomes the right HTTP response. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Parses `URLSearchParams` with a Zod schema, dropping empty values. */
export function parseQuery<Schema extends z.ZodTypeAny>(
  request: Request,
  schema: Schema,
): z.infer<Schema> {
  const params = new URL(request.url).searchParams;
  const raw: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    if (value !== "") raw[key] = value;
  }

  return schema.parse(raw);
}

export async function parseBody<Schema extends z.ZodTypeAny>(
  request: Request,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const json = await request.json().catch(() => {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: "The request body must be valid JSON.",
      },
    ]);
  });

  return schema.parse(json);
}

export function fileResponse(
  content: string,
  filename: string,
  contentType: string,
): NextResponse {
  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
