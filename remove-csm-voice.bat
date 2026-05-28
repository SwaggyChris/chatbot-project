@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo This removes the local Sesame CSM Python environment from SWAGGBOT.
echo It does not remove the website or your Hugging Face cache.
choice /M "Remove csm-voice-server\venv"
if errorlevel 2 exit /b 0
rmdir /s /q "%~dp0csm-voice-server\venv"
echo Removed the local CSM environment.
echo To remove downloaded model files separately, use: hf cache rm model/sesame/csm-1b --yes
pause
