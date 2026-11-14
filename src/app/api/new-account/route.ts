import { NextRequest, NextResponse } from "next/server";
import { getNewAccount } from "@/lib/mcp";
import accountsSeed from "@/lib/seed/accounts_data.json";
import type { Account } from "@/lib/types";
import { normalizeAccountStages } from "@/lib/deal-stages";

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Account>;
  return typeof candidate.name === "string"
    && typeof candidate.official_story === "string"
    && Array.isArray(candidate.stakeholders)
    && Array.isArray(candidate.facts)
    && Array.isArray(candidate.opportunities)
    && Array.isArray(candidate.offers)
    && Array.isArray(candidate.deadlines);
}

function unwrapAccount(value: unknown): Account | null {
  if (isAccount(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as { account?: unknown; accounts?: unknown; data?: unknown };
  if (isAccount(record.account)) return record.account;
  if (Array.isArray(record.accounts)) return record.accounts.find(isAccount) ?? null;
  if (record.data !== undefined) return unwrapAccount(record.data);
  return null;
}

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("account")?.trim() || "Kestrel Estates";
  const fallback = accountsSeed.accounts.find((account) =>
    account.id.toLowerCase() === identifier.toLowerCase() || account.name.toLowerCase() === identifier.toLowerCase()
  ) as Account | undefined;

  try {
    const raw = await getNewAccount(identifier);
    const account = unwrapAccount(raw);
    if (!account) throw new Error("MCP returned a new-account response in an unexpected shape.");
    const normalized = normalizeAccountStages({ ...account, id: fallback?.id || account.id || identifier });
    return NextResponse.json({ account: normalized, timestamp: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (!fallback) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "New account data unavailable.",
        stale: true,
      }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    return NextResponse.json({
      account: fallback,
      stale: true,
      warning: error instanceof Error ? error.message : "Live new-account data unavailable; showing the released-account brief.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
