# medialab Recoding

Electron + React + Vite desktop screen recorder for Windows. The renderer is built into `dist/`; Electron main-process recording uses `ffmpeg-static` and Windows `gdigrab`.

## Development
- `npm install`
- `npm run dev` (renderer only)
- `npm run build`
- `npm run dist` (Windows x64 portable executable; run on Windows)

Screen capture depends on the Windows desktop/GDI capture APIs. The current capture engine records video; system/microphone audio mixing is not yet wired into the FFmpeg command. Verify the output and overlay-exclusion behavior on the target Windows machine before production distribution.
