# SWAGGBOT — Local Web Research + Conversational Upgrade

## What this adds

SWAGGBOT now has a **Web** button with three modes:

```text
Off   = fully local chat; no internet research
Auto  = uses live internet research only for clearly current/web requests
On    = uses internet research for every message
```

The conversation is still written by your local `qwen3:8b` model through Ollama. The new internet tool is a local open-source **SearXNG** service. SearXNG searches the public web; the SWAGGBOT backend safely extracts useful public-page text and gives that content to Qwen3 so it can respond conversationally with sources.

## Files included

```text
components/GenesisWorkspace.tsx
app/globals.css
app/api/genesis/chat/route.ts
app/api/genesis/web/health/route.ts
app/api/genesis/web/search/route.ts
lib/web-research.ts
.env.local.example
web-search/docker-compose.yml
web-search/settings.yml
start-web-search.bat
stop-web-search.bat
```

## Requirements for Web mode

You need Docker Desktop running on Windows because SearXNG runs locally in a container.

### Start local web search

Double-click:

```text
start-web-search.bat
```

Or run in PowerShell:

```powershell
docker compose -f web-search\docker-compose.yml up -d
```

SearXNG will run locally at:

```text
http://127.0.0.1:8080
```

### Add these lines to `.env.local`

Keep your existing Ollama entries and add:

```env
SEARXNG_URL=http://127.0.0.1:8080
WEB_SEARCH_MAX_RESULTS=5
WEB_SCRAPE_PAGES=3
```

### Start SWAGGBOT

```powershell
npm run dev
```

## How to test

Set **Web** to **On** or leave it on **Auto**, then ask:

```text
Search the latest Next.js version and explain the main changes.
```

A live web-backed answer should include inline reference markers such as `[1]` and a Sources section.

## Privacy and safety design

- With Web set to Off, the chatbot continues using local Ollama only.
- With Web Auto or On, the query and requests for public webpages pass through your self-hosted SearXNG service and the source websites being read.
- The scraper blocks localhost/private-network webpage URLs to prevent the assistant from reading local network services through web results.
- Web page content is treated as reference material, not instructions.

## Note

SearXNG is the open-source internet-search/scraping layer; `qwen3:8b` remains the local conversational AI model that writes the final response.
