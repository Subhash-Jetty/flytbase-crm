import { NextRequest, NextResponse } from "next/server";
import { writeNote, getNotes } from "@/lib/mcp";

export async function GET() {
  try {
    const notes = await getNotes();
    return NextResponse.json(notes, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, account, kind, title } = body;
    const result = await writeNote(text, account, kind, title);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write note" },
      { status: 500 }
    );
  }
}
