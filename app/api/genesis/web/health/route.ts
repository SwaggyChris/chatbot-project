import { NextResponse } from "next/server";
import { checkSearxng } from "../../../../../lib/web-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkSearxng();
  return NextResponse.json(status);
}
