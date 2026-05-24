import { NextRequest, NextResponse } from "next/server";
import { researchWeb } from "../../../../../lib/web-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let payload: { query?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof payload.query !== "string" || !payload.query.trim()) {
    return NextResponse.json({ error: "A search query is required." }, { status: 400 });
  }

  try {
    const research = await researchWeb(payload.query.trim());
    return NextResponse.json(research);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cannot search the web through local SearXNG.",
      },
      { status: 503 },
    );
  }
}
