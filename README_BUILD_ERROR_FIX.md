# SWAGGBOT — Rich Response Build Error Fix

## Cause

The `SYSTEM_PROMPT` in:

```text
app/api/genesis/chat/route.ts
```

is a JavaScript template string surrounded by backticks. The previous version placed literal triple-backtick Markdown syntax inside that same string:

```text
for example ```typescript
```

That ended the JavaScript string early and caused the build error:

```text
Expected a semicolon
```

## Fixed file

Replace only:

```text
app/api/genesis/chat/route.ts
```

No package change is required for this fix.

## Restart

```powershell
Ctrl + C
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

The rich Markdown, code-box and KaTeX rendering features remain included.
