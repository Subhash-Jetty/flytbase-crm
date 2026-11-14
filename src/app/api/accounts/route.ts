import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mcp";
import accountsSeed from "@/lib/seed/accounts_data.json";
import type { Account, ExportData } from "@/lib/types";
import { normalizeAccountStages } from "@/lib/deal-stages";

const releasedAccountId = "C";

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<Account>;
  return typeof account.id === "string"
    && typeof account.name === "string"
    && typeof account.official_story === "string"
    && Array.isArray(account.stakeholders)
    && Array.isArray(account.facts)
    && Array.isArray(account.opportunities)
    && Array.isArray(account.offers)
    && Array.isArray(account.deadlines);
}

function isExportData(value: unknown): value is ExportData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ExportData>;
  return typeof data.format === "string"
    && typeof data.exported_at === "string"
    && Array.isArray(data.accounts)
    && data.accounts.every(isAccount)
    && Array.isArray(data.files);
}

export async function GET() {
  try {
    const raw = await getAccounts();
    if (!isExportData(raw)) {
      throw new Error("MCP account response did not match the expected account export.");
    }
    const live = raw;

    const knownReleasedAccount = accountsSeed.accounts.find((account) => account.id === releasedAccountId) as Account | undefined;
    const liveAccounts = live.accounts.map((account) => {
      const normalized = normalizeAccountStages(account);
      return knownReleasedAccount && normalized.name.toLowerCase() === knownReleasedAccount.name.toLowerCase()
        ? { ...normalized, id: releasedAccountId }
        : normalized;
    });
    const liveIds = new Set(liveAccounts.map((account) => account.id));
    const fallbackAccounts = knownReleasedAccount && !liveIds.has(knownReleasedAccount.id) ? [knownReleasedAccount] : [];
    const accounts: ExportData = { ...live, accounts: [...liveAccounts, ...fallbackAccounts] };

    return NextResponse.json({
      accounts,
      fallbackAccountIds: fallbackAccounts.map((account) => account.id),
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({
      accounts: accountsSeed,
      fallbackAccountIds: accountsSeed.accounts.map((account) => account.id),
      timestamp: accountsSeed.exported_at,
      stale: true,
      warning: error instanceof Error ? error.message : "Live data unavailable; showing the latest saved export.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
