const MCP_URL = "https://questathon.aihackerscollective.com/api/public/mcp";

export async function callTool(name: string, args: Record<string, unknown> = {}) {
  const token = process.env.AQ_TOKEN;
  if (!token) throw new Error("AQ_TOKEN not set");

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
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

  const data = await res.json();
  if (data.error || data.result?.isError) {
    throw new Error(data.error?.message ?? data.result?.content?.[0]?.text ?? "MCP error");
  }
  return JSON.parse(data.result.content[0].text);
}

export async function getAccounts() {
  return callTool("get_my_accounts");
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
