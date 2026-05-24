@echo off
cd /d "%~dp0"
docker compose -f web-search\docker-compose.yml down
echo SWAGGBOT local web search has stopped.
pause
