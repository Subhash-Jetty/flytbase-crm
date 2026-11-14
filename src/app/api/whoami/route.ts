import { NextResponse } from "next/server";
import { getWhoAmI } from "@/lib/mcp";

export async function GET() {
  try {
    const state = await getWhoAmI();
    return NextResponse.json({ state, timestamp: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      state: null,
      stale: true,
      warning: error instanceof Error ? error.message : "Could not check current MCP releases.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
