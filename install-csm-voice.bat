@echo off
setlocal EnableExtensions EnableDelayedExpansion
title SWAGGBOT - Install Sesame CSM-1B Voice Server
cd /d "%~dp0"

set "VOICE_DIR=%CD%\csm-voice-server"
set "VENV_PY=%VOICE_DIR%\venv\Scripts\python.exe"
set "PYTORCH_INDEX=https://download.pytorch.org/whl/cu126"

echo.
echo ============================================================
echo   SWAGGBOT - Sesame CSM-1B TTS Studio Installer
echo ============================================================
echo.
echo This installer keeps Sesame inside its own Python 3.10 venv.
echo It will not install CSM packages into your global Python 3.13.
echo.

py -3.10 --version >nul 2>&1
if errorlevel 1 (
  echo Python 3.10 is not installed on this PC.
  echo.
  where winget >nul 2>&1
  if errorlevel 1 (
    echo Install Python 3.10 manually, then run this installer again.
    echo Official download: https://www.python.org/downloads/windows/
    pause
    exit /b 1
  )
  choice /M "Install Python 3.10 now using winget"
  if errorlevel 2 (
    echo Installation cancelled. Install Python 3.10 and run this file again.
    pause
    exit /b 1
  )
  winget install -e --id Python.Python.3.10
  if errorlevel 1 (
    echo.
    echo Python installation did not complete successfully.
    pause
    exit /b 1
  )
  echo.
  echo Python 3.10 was installed. Close this window and run
  echo install-csm-voice.bat again so the Python launcher refreshes.
  pause
  exit /b 0
)

for /f "delims=" %%V in ('py -3.10 --version 2^>^&1') do set "PY_VERSION=%%V"
echo Detected: !PY_VERSION!
echo.

if not exist "%VOICE_DIR%\server.py" (
  echo ERROR: csm-voice-server\server.py is missing from this project.
  pause
  exit /b 1
)

if exist "%VOICE_DIR%\venv" (
  echo A voice-server virtual environment already exists.
  choice /M "Rebuild it cleanly with Python 3.10"
  if errorlevel 2 goto :install_packages
  rmdir /s /q "%VOICE_DIR%\venv"
)

if not exist "%VENV_PY%" (
  echo Creating dedicated Python 3.10 environment...
  py -3.10 -m venv "%VOICE_DIR%\venv"
  if errorlevel 1 goto :failed
)

:install_packages
if not exist "%VENV_PY%" (
  echo ERROR: The Python 3.10 virtual environment could not be found.
  goto :failed
)

"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,10) else 1)"
if errorlevel 1 (
  echo ERROR: Existing venv does not use Python 3.10.
  echo Delete csm-voice-server\venv and run this installer again.
  goto :failed
)

echo.
echo Updating pip inside the CSM virtual environment...
"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 goto :failed

echo.
echo Installing CUDA 12.6 PyTorch for your NVIDIA GPU...
"%VENV_PY%" -m pip install torch torchvision torchaudio --index-url "%PYTORCH_INDEX%"
if errorlevel 1 goto :failed

echo.
echo Installing SWAGGBOT CSM server packages...
"%VENV_PY%" -m pip install -r "%VOICE_DIR%\requirements.txt"
if errorlevel 1 goto :failed

echo.
echo Verifying CUDA/PyTorch detection...
"%VENV_PY%" -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not detected'); raise SystemExit(0 if torch.cuda.is_available() else 1)"
if errorlevel 1 (
  echo.
  echo CUDA was not detected by PyTorch. The voice server was installed,
  echo but CSM cannot run on your GPU until this is corrected.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Installation complete.
echo ============================================================
echo.
echo Before generating audio, approve model access in your browser:
echo   https://huggingface.co/sesame/csm-1b
 echo.
echo Then sign in to Hugging Face from this environment.
choice /M "Sign in to Hugging Face now"
if errorlevel 2 goto :done
call "%VOICE_DIR%\venv\Scripts\activate.bat"
hf auth login

:done
echo.
echo Next step: run start-csm-voice.bat from this project folder.
echo The model downloads and loads when you generate audio for the first time.
pause
exit /b 0

:failed
echo.
echo Installation stopped because a command failed.
echo Nothing was installed into global Python 3.13; retry after resolving the error.
pause
exit /b 1
