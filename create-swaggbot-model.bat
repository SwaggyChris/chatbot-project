@echo off
cd /d "%~dp0"
echo Creating customised SWAGGBOT Ollama model...
ollama create swaggbot -f Modelfile
echo.
echo Set OLLAMA_MODEL=swaggbot in .env.local to use the customised model.
pause
