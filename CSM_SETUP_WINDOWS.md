# SWAGGBOT Sesame CSM-1B Setup on Windows

TTS Studio now connects to a local API powered by `sesame/csm-1b`; it no longer uses browser voices.

## Hardware target

This project is configured for an NVIDIA GPU. An RTX 3060 with 12 GB VRAM can run CSM-1B using CUDA FP16 inference. Close Ollama, games, or other GPU-heavy apps before voice generation when GPU memory is limited.

## Before installing

1. Sign in to Hugging Face.
2. Open `https://huggingface.co/sesame/csm-1b`.
3. Accept the model access conditions.
4. Create a Hugging Face token with **Read** access.

Sesame CSM is supported natively in Transformers from version `4.52.1`. The model is a base speech generator and does not include a fixed named voice.

## Recommended: automatic Windows setup

From the SWAGGBOT project folder, double-click:

```text
install-csm-voice.bat
```

Or run it from PowerShell:

```powershell
cd "C:\Users\lianc\Desktop\chatbot project"
.\install-csm-voice.bat
```

The installer will:

- Detect whether Python 3.10 is installed.
- Offer to install Python 3.10 through `winget` when missing.
- Create `csm-voice-server\venv` using Python 3.10 only.
- Install CUDA 12.6 PyTorch into that environment.
- Install the CSM server dependencies.
- Verify that PyTorch detects your NVIDIA GPU.
- Offer to sign in to Hugging Face.

It will not install CSM packages into global Python 3.13.

If Python 3.10 is installed during the first run, close the installer and run it again after installation so the Windows Python launcher refreshes.

## Start CSM voice generation

After installation, open PowerShell terminal 1:

```powershell
cd "C:\Users\lianc\Desktop\chatbot project"
.\start-csm-voice.bat
```

Keep this terminal open. The server runs at `http://127.0.0.1:7861` and the model downloads/loads on the first generated voice request.

Open PowerShell terminal 2:

```powershell
cd "C:\Users\lianc\Desktop\chatbot project"
npm install
npm run dev
```

Open the SWAGGBOT TTS Studio page and click **Generate Voice**.

## Manual setup fallback

Only use these commands when the automatic installer fails:

```powershell
cd "C:\Users\lianc\Desktop\chatbot project\csm-voice-server"
py -3.10 -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
python -m pip install -r requirements.txt
python -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
hf auth login
```

## Remove CSM later

Run:

```powershell
.\remove-csm-voice.bat
```

This removes the local Python environment only. It does not remove SWAGGBOT or the Hugging Face download cache.

## Troubleshooting

### TTS Studio shows CSM server offline

Run `install-csm-voice.bat` first, then keep `start-csm-voice.bat` open while SWAGGBOT is running.

### Python 3.10 is missing

The installer can install it with `winget`. To do it manually:

```powershell
winget install -e --id Python.Python.3.10
```

Then close PowerShell, reopen it, and run `install-csm-voice.bat` again.

### Hugging Face access error

Accept access conditions for `sesame/csm-1b`, then run `hf auth login` again from the CSM environment.

### GPU out of memory

Close Ollama and other GPU-heavy applications, shorten the script, and retry.

### Frontend is running on another local port

The local CSM server accepts SWAGGBOT running on any `localhost` or `127.0.0.1` development port.
