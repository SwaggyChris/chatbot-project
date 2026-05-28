# SWAGGBOT — Local AI Workspace Website

SWAGGBOT is a multi-page Next.js application with a landing page, an AI chatbot workspace, a separate Sesame-powered TTS Studio, and an About page.

## Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Landing Page | Branded entry page with navigation and product overview. |
| `/chat` | AI Chatbot | The existing SWAGGBOT chatbot workspace and local-model workflow. |
| `/tts-studio` | TTS Studio | Generates speech locally through the Sesame CSM-1B server. |
| `/about` | About SWAGGBOT | Platform description, structure and direction. |

## Voice architecture

Kokoro and Chatterbox are not included. TTS Studio no longer uses browser `speechSynthesis` voices; it sends text to the local `csm-voice-server`, which generates WAV audio with `sesame/csm-1b` on your NVIDIA GPU.

CSM is installed into its own Python 3.10 virtual environment, separate from both Next.js and global Python installations.

## Quick start on Windows

### First-time CSM setup

```powershell
cd "C:\Users\lianc\Desktop\chatbot project"
.\install-csm-voice.bat
```

Before generating audio, accept access to the Sesame model on Hugging Face and authenticate when the installer prompts you. Full details are in `CSM_SETUP_WINDOWS.md`.

### Run the CSM voice server

```powershell
.\start-csm-voice.bat
```

### Run the website

Open another PowerShell terminal:

```powershell
cd "C:\Users\lianc\Desktop\chatbot project"
npm install
npm run dev
```

Then open the local address printed by Next.js, normally `http://localhost:3000`.

## Main files

```text
components/SiteHeader.tsx
components/LandingPage.tsx
components/TtsStudio.tsx
components/AboutSwaggbot.tsx
app/chat/page.tsx
app/tts-studio/page.tsx
app/about/page.tsx
csm-voice-server/server.py
csm-voice-server/requirements.txt
install-csm-voice.bat
start-csm-voice.bat
remove-csm-voice.bat
CSM_SETUP_WINDOWS.md
```

The existing `components/GenesisWorkspace.tsx` continues to power the AI Chatbot page.
