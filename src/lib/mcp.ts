import { createHash } from "node:crypto";
import { cacheLife } from "next/cache";

const MCP_URL = "https://questathon.aihackerscollective.com/api/public/mcp";
const MIN_CALL_INTERVAL_MS = 60_000;
const READ_CACHE_MS = 60_000;

type CachedResult = { value: unknown; storedAt: number };
type MCPState = {
  lastCallAt: number;
  cache: Map<string, CachedResult>;
  inFlight: Map<string, Promise<unknown>>;
};

const globalMcp = globalThis as typeof globalThis & { __flytbaseMcpState?: MCPState };
const mcpState = globalMcp.__flytbaseMcpState ??= {
  lastCallAt: 0,
  cache: new Map<string, CachedResult>(),
  inFlight: new Map<string, Promise<unknown>>(),
};

export class MCPRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`MCP allows one call per minute. Try again in ${retryAfterSeconds} seconds.`);
    this.name = "MCPRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function cacheKey(name: string, args: Record<string, unknown>, token: string) {
  const tokenFingerprint = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `${tokenFingerprint}:${name}:${JSON.stringify(args)}`;
}

async function fetchTool(name: string, args: Record<string, unknown>, token: string) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    cache: "no-store",
  });

  let data: { error?: { message?: string; data?: { retry_after_seconds?: number } }; result?: { isError?: boolean; content?: { text?: string }[] }; retry_after_seconds?: number };
  try {
    data = await res.json();
  } catch {
    throw new Error(`MCP returned an unreadable response (${res.status}).`);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 60;
    throw new MCPRateLimitError(retryAfter);
  }
  if (!res.ok || data.error || data.result?.isError) {
    const message = data.error?.message ?? data.result?.content?.[0]?.text ?? `MCP request failed (${res.status})`;
    const retryAfter = Number(data.error?.data?.retry_after_seconds ?? data.retry_after_seconds);
    if (/too many requests|one call a minute/i.test(message)) {
      throw new MCPRateLimitError(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
    }
    throw new Error(message);
  }

  const responseText = data.result?.content?.[0]?.text;
  if (!responseText) throw new Error("MCP response did not include a result.");
  return JSON.parse(responseText) as unknown;
}

async function fetchCachedRead(name: string, args: Record<string, unknown>, token: string) {
  "use cache: remote";
  // Share recent reads across server instances while expiring before the next scheduled refresh.
  cacheLife({ stale: 60, revalidate: 60, expire: 60 });
  return fetchTool(name, args, token);
}

export async function callTool(name: string, args: Record<string, unknown> = {}) {
  const token = process.env.AQ_TOKEN;
  if (!token) throw new Error("AQ_TOKEN not set");

  const key = cacheKey(name, args, token);
  const readOnly = name !== "write_note";
  const cached = mcpState.cache.get(key);
  const active = mcpState.inFlight.get(key);

  if (active) return active;
  if (readOnly && cached && Date.now() - cached.storedAt < READ_CACHE_MS) return cached.value;

  const elapsed = Date.now() - mcpState.lastCallAt;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    const retryAfter = Math.max(1, Math.ceil((MIN_CALL_INTERVAL_MS - elapsed) / 1000));
    throw new MCPRateLimitError(retryAfter);
  }

  mcpState.lastCallAt = Date.now();
  const request = (async () => {
    const value = readOnly
      ? await fetchCachedRead(name, args, token)
      : await fetchTool(name, args, token);
    if (readOnly) mcpState.cache.set(key, { value, storedAt: Date.now() });
    return value;
  })();

  mcpState.inFlight.set(key, request);
  try {
    return await request;
  } finally {
    mcpState.inFlight.delete(key);
  }
}

export async function getAccounts() {
  return callTool("get_my_accounts");
}

export async function getNewAccount(account: string) {
  return callTool("get_new_account", { account });
}

export async function getWhoAmI() {
  return callTool("whoami");
}

export async function getSignals() {
  return callTool("get_signals");
}

export async function getFile(id: string) {
  return callTool("get_file", { id });
}

export async function writeNote(text: string, account?: string, kind?: string, title?: string) {
  const args: Record<string, unknown> = { text };
  if (account) args.account = account;
  if (kind) args.kind = kind;
  if (title) args.title = title;
  return callTool("write_note", args);
}

export async function getNotes() {
  return callTool("list_notes");
}

export async function getPaperwork(account: string) {
  return callTool("get_all_paperwork", { account });
}

export async function getFeatureRequests() {
  return callTool("get_feature_requests");
}

export async function getReleaseNotes() {
  return callTool("get_release_notes");
}

export async function getFlytbaseTeam() {
  return callTool("get_flytbase_team");
}
