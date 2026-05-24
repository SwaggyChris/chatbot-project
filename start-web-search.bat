@echo off
cd /d "%~dp0"
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found.
  echo Install Docker Desktop, open it, then run this file again.
  pause
  exit /b 1
)
echo Starting local open-source SearXNG internet search for SWAGGBOT...
docker compose -f web-search\docker-compose.yml up -d
echo.
echo SearXNG should be available at http://127.0.0.1:8080
echo Restart SWAGGBOT with npm run dev after starting search.
pause
