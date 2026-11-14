import { NextResponse } from "next/server";
import { getSignals } from "@/lib/mcp";
import signalsSeed from "@/lib/seed/signals_data.json";

export async function GET() {
  try {
    const signals = await getSignals();
    return NextResponse.json(signals, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json({
      ...signalsSeed,
      stale: true,
      warning: error instanceof Error ? error.message : "Live signals unavailable; showing the latest saved export.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
