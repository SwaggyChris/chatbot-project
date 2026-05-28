@echo off
setlocal EnableExtensions
title SWAGGBOT - Sesame CSM-1B Voice Server
cd /d "%~dp0"
set "VOICE_DIR=%CD%\csm-voice-server"
set "VENV_PY=%VOICE_DIR%\venv\Scripts\python.exe"

if not exist "%VENV_PY%" (
  echo.
  echo Sesame CSM-1B is not installed yet.
  echo Run install-csm-voice.bat first.
  echo.
  pause
  exit /b 1
)

"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,10) else 1)" >nul 2>&1
if errorlevel 1 (
  echo.
  echo The CSM virtual environment is not using Python 3.10.
  echo Delete csm-voice-server\venv, then run install-csm-voice.bat again.
  echo.
  pause
  exit /b 1
)

"%VENV_PY%" -c "import torch, fastapi, transformers; raise SystemExit(0 if torch.cuda.is_available() else 1)" >nul 2>&1
if errorlevel 1 (
  echo.
  echo CSM dependencies are missing or CUDA is not available in this environment.
  echo Run install-csm-voice.bat again and confirm CUDA detection succeeds.
  echo.
  pause
  exit /b 1
)

set NO_TORCH_COMPILE=1
echo.
echo Starting SWAGGBOT Sesame CSM-1B voice server...
echo URL: http://127.0.0.1:7861
echo Model loads on the first Generate Voice request.
echo Press CTRL+C to stop the server.
echo.
cd /d "%VOICE_DIR%"
"%VENV_PY%" -m uvicorn server:app --host 127.0.0.1 --port 7861
pause
