@echo off
cd /d "%~dp0"
if not exist ".env.local" copy /Y ".env.local.example" ".env.local" >nul
start "" "http://localhost:3000"
call npm run dev
