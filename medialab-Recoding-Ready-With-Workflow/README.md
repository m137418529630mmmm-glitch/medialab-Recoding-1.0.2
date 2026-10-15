# medialab Recoding

Electron + React + Vite desktop screen recorder for Windows. The renderer is built into `dist/`; the Electron main process records with `ffmpeg-static` and Windows `gdigrab`.

## Development
- `npm install`
- `npm run dev` (renderer only, browser preview)
- `npm run typecheck`
- `npm run build`
- `npm run dist` (Windows x64 NSIS installer in `release/`; run on Windows or via the GitHub Actions workflow)

## How recording works
- Graceful FFmpeg shutdown (`q`) into temporary Matroska segments, then a stream-copy remux to `mp4` / `mkv` / `mov` on Stop & Save (Pause/Resume = a new segment, joined at the end).
- Defaults: 30 FPS, native resolution, balanced quality, x264 `ultrafast` preset (lowest CPU; set `encoderPreset` to `veryfast` for ~3-4x smaller recordings). Fixed resolutions (4K/1080p/720p) keep the source aspect ratio and add black bars instead of stretching (portrait sources get a portrait canvas).
- "Full Screen" records the primary display only. FFmpeg is launched DPI-aware so 125%/150% scaling maps correctly to physical pixels.
- If finalizing fails, the raw segments are kept (the error message shows the folder) so the recording can be recovered.
- Global shortcuts: `Ctrl+Shift+R` start/stop (starts without countdown), `Ctrl+Shift+P` pause/resume.
- File names: sequential (`prefix + N`) or date-based (`recording_YYYY-MM-DD[_2].ext`) when sequential numbering is off.

## Known limitations
- Audio capture (system/microphone) is not implemented yet; the toggles are disabled ("Coming soon"). Click highlighting and snapshots are not implemented either.
- `gdigrab` cannot capture some hardware-accelerated windows (they may record black) in "App Window" mode.
- Windows content-protection flags (used to hide the HUD/frame from the recording) are best-effort. Verify on the target Windows version that the HUD/frame is absent in the final video.
- `ffmpeg-static` ships a GPL build of FFmpeg; check the license obligations before distributing the installer.
