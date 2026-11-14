import { NextResponse } from "next/server";
import { getSignals } from "@/lib/mcp";

export async function GET() {
  try {
    const signals = await getSignals();
    return NextResponse.json(signals, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
