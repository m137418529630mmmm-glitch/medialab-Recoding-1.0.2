# Fixes in this build

## main.cjs
- App now quits when the main window closes (hidden overlay window kept it alive).
- Stop/Pause can no longer leave the recorder stuck in "recording" state; raw segments are kept if finalizing fails.
- No more false "FFmpeg stopped unexpectedly" errors during Pause/Stop.
- Region selection: timeout/cancel always hides the overlay (no more screen-blocking overlay) and no leaked listeners.
- `.mov` now really saves as `.mov`.
- 4K/1080p/720p keep aspect ratio (bars instead of stretching; portrait aware).
- Window list: UTF-8 (Arabic titles), cached, skipped while recording; own window excluded.
- FFmpeg launched DPI-aware; region/fullscreen use physical pixels; Full Screen = primary display only.
- Date-based names when sequential numbering is off (`recording_YYYY-MM-DD[_2]`).
- Real global shortcuts: Ctrl+Shift+R (start/stop), Ctrl+Shift+P (pause/resume).
- Single-instance lock, AppUserModelId, next-index check covers mp4/mkv/mov.

## Renderer
- Sequential numbering no longer skips numbers (double increment removed).
- Stop during countdown = cancel (no fake recording); no fake size/snapshot data.
- Auto-stop no longer runs side effects inside a state updater; toast timers no longer overlap.
- Window picker polls only in "App Window" mode, never silently changes the selected window.
- Audio toggles disabled ("Coming soon") and forced off until audio is implemented.
- Fullscreen label shows the real screen size; HUD pause label resets; header aligned with content width.
- Fonts bundled with @fontsource (works offline).

## Build / config
- Single GitHub workflow (duplicate removed), `--publish never`, `typecheck` script, @types packages, author/description.
- README updated (installer, shortcuts, limitations).

# Round 2

- **Region picker**: the app minimizes, the screen is frozen as a screenshot and you drag on that image. Videos (YouTube etc.) can no longer go black behind a transparent full-screen window. Works with the left OR right mouse button, no text selection, Esc (global) and a Cancel button. Falls back to a transparent picker if the screen capture fails.
- **Recording bar**: now a small draggable window (no full-screen overlay during recording). Hide = compact timer pill, click Show to expand. Excluded from the recording when Windows supports it.
- **Recording file size (optional)**: default stays `ultrafast` (lowest CPU). Add `"encoderPreset": "veryfast"` to `medialab-preferences.json` in the app data folder for ~3-4x smaller recordings at the same quality (more CPU).
- **Save folder**: a remembered folder is never replaced because it is temporarily unavailable; half-typed paths are not stored; leaving the path box creates/remembers the folder. Decisions are logged to `medialab.log` in the app data folder.
- **Window**: smaller default size (600x740), narrower content, header aligned.

# Round 3

- **Installer / install size**: unused Chromium locales removed after packing (`scripts/after-pack.cjs`, keeps en-US + ar); bundled fonts limited to the Arabic + Latin subsets. Most of the remaining size is the Electron runtime and FFmpeg.
- Closing the window during a recording now asks to Stop & Save (previously the raw segments were left in the temp folder).
- Leftover temp folders from failed sessions are deleted after 7 days.

# Round 4

- **Name**: visible name is now "medialab Recording" (window, installer, shortcut, workflow). Internal ids (package name, appId) are unchanged on purpose, so saved settings and upgrades keep working. Uninstall the old "medialab Recoding" first.
- **Audio**: system sound (everything playing through the speakers/headphones) and microphone. Recorded in a hidden window as Opus, aligned to each video segment (pauses are cut out), merged into the final file as AAC 192k. Video is still stream-copied (fast Stop & Save). If audio fails the video is still saved and a message explains why. Alignment values are written to `medialab.log`.
- **Black frame**: in region mode, four thin solid-black windows are drawn just outside the recorded area (never inside it), click-through and excluded from capture.
- **Size**: the GitHub build now prints the installed size and the 15 biggest files, so the real contributors can be targeted. Tauri/other-framework port: not done (it would change features and cannot be built/tested here).
