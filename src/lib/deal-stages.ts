import type { Account } from "./types";

export function normalizeDealStage(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

export function isOutOfReach(stage: string): boolean {
  return normalizeDealStage(stage) === "out_of_reach";
}

export function isAgreed(stage: string): boolean {
  return normalizeDealStage(stage) === "agreed";
}

export function normalizeAccountStages(account: Account): Account {
  return {
    ...account,
    opportunities: account.opportunities.map((opportunity) => ({
      ...opportunity,
      stage: normalizeDealStage(opportunity.stage),
    })),
  };
}
