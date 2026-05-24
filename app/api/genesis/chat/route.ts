import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

type ChatMessage = { role: "user" | "assistant"; content: string };
type OllamaChunk = {
  message?: { content?: string; thinking?: string };
  error?: string;
};

const SYSTEM_PROMPT = `You are SWAGGBOT, a helpful, intelligent and modern personal AI assistant.
Answer directly and naturally. Be practical and concise unless more detail is requested.
For development questions provide accurate, useful code and steps.
Your replies may be spoken aloud, so avoid unnecessary filler.`;

function validateMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const safe: ChatMessage[] = [];
  for (const item of input.slice(-30)) {
    if (!item || typeof item !== "object") return null;
    const message = item as Record<string, unknown>;

    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      return null;
    }

    safe.push({
      role: message.role,
      content: message.content.trim().slice(0, 12000),
    });
  }

  return safe;
}

export async function POST(request: NextRequest) {
  let payload: { messages?: unknown; trainingContext?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const messages = validateMessages(payload.messages);
  if (!messages) {
    return NextResponse.json({ error: "Valid chat messages are required." }, { status: 400 });
  }

  const trainingContext =
    typeof payload.trainingContext === "string"
      ? payload.trainingContext.trim().slice(0, 16000)
      : "";

  const trainedSystemPrompt = trainingContext
    ? `${SYSTEM_PROMPT}

The user has saved the following local knowledge and instructions. Use it when relevant, but do not invent facts beyond it:
---
${trainingContext}
---`
    : SYSTEM_PROMPT;

  let upstream: Response;

  try {
    upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: request.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "system", content: trainedSystemPrompt }, ...messages],
        stream: true,
        think: false,
        keep_alive: "30m",
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_ctx: 8192,
        },
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Cannot reach Ollama. ${error instanceof Error ? error.message : ""}`,
      },
      { status: 503 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Ollama request failed. ${details}` },
      { status: 502 },
    );
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              const chunk = JSON.parse(buffer) as OllamaChunk;
              if (chunk.error) throw new Error(chunk.error);
              if (chunk.message?.content) {
                controller.enqueue(encoder.encode(chunk.message.content));
              }
            }
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const chunk = JSON.parse(line) as OllamaChunk;
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.message?.content) {
              controller.enqueue(encoder.encode(chunk.message.content));
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-GenesisAI-Model": OLLAMA_MODEL,
    },
  });
}
