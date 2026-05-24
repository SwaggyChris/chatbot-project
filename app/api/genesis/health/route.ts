import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);

    const data = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };

    const availableModels = (data.models ?? [])
      .map((model) => model.name ?? model.model ?? "")
      .filter(Boolean);

    const target = OLLAMA_MODEL.split(":")[0];
    const installed = availableModels.some(
      (model) => model === OLLAMA_MODEL || model.split(":")[0] === target,
    );

    return NextResponse.json({
      online: true,
      installed,
      model: OLLAMA_MODEL,
      availableModels,
    });
  } catch (error) {
    return NextResponse.json(
      {
        online: false,
        installed: false,
        model: OLLAMA_MODEL,
        error: error instanceof Error ? error.message : "Ollama is unavailable.",
      },
      { status: 503 },
    );
  }
}
