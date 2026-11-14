import { NextRequest, NextResponse } from "next/server";
import { writeNote, MCPRateLimitError } from "@/lib/mcp";

const allowedKinds = new Set(["next_step", "risk", "note"]);

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin note writes are not accepted." }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return NextResponse.json({ error: "Note request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const fields = body as { text?: unknown; account?: unknown; kind?: unknown; title?: unknown };
  const text = typeof fields.text === "string" ? fields.text.trim() : "";
  const account = fields.account;
  const kind = fields.kind;
  const title = fields.title;

  if (!text || text.length > 2_000) {
    return NextResponse.json({ error: "Note text must be between 1 and 2,000 characters." }, { status: 400 });
  }
  if (account !== undefined && (typeof account !== "string" || !/^[A-Za-z0-9 _-]{1,80}$/.test(account))) {
    return NextResponse.json({ error: "Account must be a short account name or ID." }, { status: 400 });
  }
  if (kind !== undefined && (typeof kind !== "string" || !allowedKinds.has(kind))) {
    return NextResponse.json({ error: "Note kind must be next_step, risk, or note." }, { status: 400 });
  }
  if (title !== undefined && (typeof title !== "string" || title.trim().length > 120)) {
    return NextResponse.json({ error: "Title must be 120 characters or fewer." }, { status: 400 });
  }

  try {
    const result = await writeNote(text, account as string | undefined, kind as string | undefined, (title as string | undefined)?.trim());
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to write note",
        retryAfterSeconds: error instanceof MCPRateLimitError ? error.retryAfterSeconds : undefined,
      },
      { status: error instanceof MCPRateLimitError ? 429 : 502 }
    );
  }
}
