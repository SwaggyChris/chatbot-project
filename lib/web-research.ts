import "server-only";

import dns from "node:dns/promises";
import { isIP } from "node:net";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://127.0.0.1:8080";
const MAX_RESULTS = Math.max(1, Math.min(Number(process.env.WEB_SEARCH_MAX_RESULTS ?? "5"), 8));
const SCRAPE_PAGES = Math.max(0, Math.min(Number(process.env.WEB_SCRAPE_PAGES ?? "3"), 4));
const WEB_CONTEXT_LIMIT = 14000;

export type WebMode = "off" | "auto" | "on";

export type WebSource = {
  title: string;
  url: string;
  snippet: string;
  extractedText?: string;
  engine?: string;
};

export type WebResearch = {
  query: string;
  provider: "SearXNG";
  sources: WebSource[];
};

type SearxResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  engine?: unknown;
};

type SearxResponse = {
  results?: SearxResult[];
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function readableTextFromHtml(html: string) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");

  const article =
    cleaned.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    cleaned.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    cleaned.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ??
    cleaned;

  return compact(decodeHtmlEntities(article.replace(/<[^>]+>/g, " "))).slice(0, 4500);
}

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;

  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return false;
}

async function publicHttpUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only public HTTP pages can be read.");
  }

  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) {
    throw new Error("Private local URLs cannot be scraped.");
  }

  const resolved = await dns.lookup(url.hostname, { all: true });
  if (!resolved.length || resolved.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Private network URLs cannot be scraped.");
  }

  return url;
}

async function extractPublicPage(url: string) {
  const safeUrl = await publicHttpUrl(url);
  const response = await fetch(safeUrl, {
    method: "GET",
    headers: {
      "User-Agent": "SWAGGBOT/1.0 local research assistant",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) return "";
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return "";

  const html = (await response.text()).slice(0, 950_000);
  return contentType.includes("text/plain") ? compact(html).slice(0, 4500) : readableTextFromHtml(html);
}

export function shouldSearchWeb(question: string, mode: WebMode) {
  if (mode === "on") return true;
  if (mode === "off") return false;

  return /\b(search|search for|look up|browse|web|internet|online|latest|today|current|recent|news|release|version|price|patch|update|website|source|verify|who is currently|what happened)\b/i.test(
    question,
  ) || /https?:\/\//i.test(question);
}

export async function researchWeb(query: string): Promise<WebResearch> {
  const endpoint = new URL("/search", SEARXNG_URL);
  endpoint.searchParams.set("q", query.slice(0, 450));
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("language", "auto");
  endpoint.searchParams.set("categories", "general");
  endpoint.searchParams.set("safesearch", "1");

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`SearXNG returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as SearxResponse;
  const searchResults = (payload.results ?? [])
    .filter((result) => typeof result.title === "string" && typeof result.url === "string")
    .slice(0, MAX_RESULTS)
    .map((result) => ({
      title: compact(String(result.title)),
      url: String(result.url),
      snippet: compact(String(result.content ?? "")).slice(0, 700),
      engine: typeof result.engine === "string" ? result.engine : undefined,
    }));

  const expanded = await Promise.all(
    searchResults.map(async (source, index) => {
      if (index >= SCRAPE_PAGES) return source;
      try {
        const extractedText = await extractPublicPage(source.url);
        return extractedText ? { ...source, extractedText } : source;
      } catch {
        return source;
      }
    }),
  );

  return {
    query,
    provider: "SearXNG",
    sources: expanded,
  };
}

export function webContextForModel(research: WebResearch) {
  const content = research.sources
    .map((source, index) => {
      const extract = source.extractedText || source.snippet || "No text extract available.";
      return `[${index + 1}] ${source.title}
URL: ${source.url}
CONTENT: ${extract}`;
    })
    .join("\n\n");

  return content.slice(0, WEB_CONTEXT_LIMIT);
}

export async function checkSearxng() {
  try {
    const url = new URL("/", SEARXNG_URL);
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return { online: response.ok, url: SEARXNG_URL };
  } catch {
    return { online: false, url: SEARXNG_URL };
  }
}
