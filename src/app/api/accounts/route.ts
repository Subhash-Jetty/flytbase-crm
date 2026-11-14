import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mcp";

export async function GET() {
  try {
    const accounts = await getAccounts();
    return NextResponse.json({ accounts, timestamp: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch data" },
      { status: 500 }
    );
  }
}
