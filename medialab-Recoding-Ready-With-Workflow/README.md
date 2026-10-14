# medialab Recoding

Electron + React + Vite desktop screen recorder for Windows. The renderer is built into `dist/`; Electron main-process recording uses `ffmpeg-static` and Windows `gdigrab`.

## Development
- `npm install`
- `npm run dev` (renderer only)
- `npm run build`
- `npm run dist` (Windows x64 portable executable; run on Windows)

Screen capture depends on the Windows desktop/GDI capture APIs. The current capture engine records video; system/microphone audio mixing is not yet wired into the FFmpeg command. Verify the output and overlay-exclusion behavior on the target Windows machine before production distribution.


## Recording stability update

This build uses graceful FFmpeg shutdown (`q`) and temporary Matroska segments before finalizing MP4, which prevents incomplete MP4 indexes in normal stop/pause flows. FFmpeg is a production dependency and is unpacked by electron-builder. The default capture settings are 30 FPS, native resolution, and balanced quality to reduce CPU/GPU load. The window list is populated from visible Windows top-level windows rather than mock entries.

Note: The capture backend is FFmpeg `gdigrab`. Windows content-protection flags are best-effort and do not guarantee exclusion from every GDI-based capture path. Verify the HUD/frame is absent in the final video on the target Windows version. Audio capture is not implemented in the current FFmpeg pipeline.
