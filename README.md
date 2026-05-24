# SWAGGBOT — Gold Logo + Chat-Bar Media Upload Upgrade

## What this update changes

- Uses your uploaded gold emblem as the SWAGGBOT logo.
- Displays the logo in the compact sidebar rail.
- Displays a larger gold logo above the SWAGGBOT welcome wordmark.
- Converts the `+` button in the chat composer into a working media upload button.
- Media uploaded through the chat bar is saved into the existing Library using IndexedDB.

## Replace / add these files

Copy these files into your existing project folder:

```text
components/GenesisWorkspace.tsx
app/globals.css
public/swaggbot-logo.png
```

The `public` folder may not exist yet. Create it at the root of `chatbot project` if necessary.

Final path for the logo must be:

```text
C:\Users\lianc\Desktop\chatbot project\public\swaggbot-logo.png
```

## Install

1. Stop the server:

```powershell
Ctrl + C
```

2. Copy the three files into your existing project and replace existing matching files.

3. Restart:

```powershell
npm run dev
```

4. Hard refresh:

```text
Ctrl + Shift + R
```

## Upload media from the chat bar

Press the `+` button inside the composer. Select images, video, or audio. The uploaded items are stored locally and appear under **Library** in the expanded sidebar.

This upload stores media in your Library; it does not yet send media to the local AI model for visual/audio analysis.
