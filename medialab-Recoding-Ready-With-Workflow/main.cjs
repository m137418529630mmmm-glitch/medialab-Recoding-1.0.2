const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, desktopCapturer, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

let mainWin = null;
let overlayWin = null; // full-screen region picker (short-lived)
let hudWin = null;     // small recording control bar
let active = false;
let paused = false;
let ffmpeg = null;
let segments = [];
let segMetas = [];
let audioWin = null;
let audioStream = null;
let audioFile = null;
let audioStartedAt = 0;
let audioActive = false;
let frameWins = [];
let audioPrep = null; // { key, promise, timer } audio devices opened ahead of time (during the countdown)
let starting = false;
let startingPromise = null;
let segmentIndex = 0;
let recordingOptions = null;
let startedAt = 0;
let elapsedMs = 0;
let stopPromise = null;
let regionResolver = null;
let windowsCache = { at: 0, data: [] };
let windowsInflight = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();
else app.on('second-instance', () => { if (mainWin && !mainWin.isDestroyed()) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); } });
if (process.platform === 'win32') app.setAppUserModelId('com.medialab.recoding');
const tempRoot = path.join(os.tmpdir(), `medialab-recoding-${process.pid}`);
const preferencesPath = path.join(app.getPath('userData'), 'medialab-preferences.json');
function logLine(message) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'medialab.log'), `${new Date().toISOString()} ${message}\n`, 'utf8'); } catch {}
}
function readPreferences() {
  try { return JSON.parse(fs.readFileSync(preferencesPath, 'utf8')); } catch { return {}; }
}
function writePreferences(patch) {
  const current = readPreferences();
  const next = { ...current, ...patch };
  try {
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    const tmp = preferencesPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, preferencesPath); // atomic: a crash can never leave a half-written file
  } catch (error) { console.warn('Could not persist preferences:', error.message); logLine('Could not persist preferences: ' + error.message); }
  return next;
}


function cleanStaleTempFolders() {
  // Raw segments of failed/crashed sessions are kept for recovery, but not forever.
  try {
    const week = 7 * 24 * 3600 * 1000;
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (!name.startsWith('medialab-recoding-') || name === path.basename(tempRoot)) continue;
      const dir = path.join(os.tmpdir(), name);
      if (Date.now() - fs.statSync(dir).mtimeMs > week) fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
}
function resolveFfmpeg() {
  // ffmpeg-static is a production dependency and is unpacked by electron-builder.
  let candidate;
  try { candidate = require('ffmpeg-static'); } catch (e) {
    throw new Error(`FFmpeg dependency is missing. Rebuild the app with ffmpeg-static in dependencies. ${e.message}`);
  }
  if (!candidate) throw new Error('ffmpeg-static did not provide an executable path.');
  const resolved = candidate.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  if (!fs.existsSync(resolved)) throw new Error(`FFmpeg executable was not found: ${resolved}`);
  return resolved;
}
function send(channel, data) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, data);
}
function safeOverlaySend(channel, data) {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send(channel, data);
}
function safeHudSend(channel, data) {
  if (hudWin && !hudWin.isDestroyed()) hudWin.webContents.send(channel, data);
}
function closeOverlay() {
  try { globalShortcut.unregister('Escape'); } catch {}
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
  overlayWin = null;
}
async function hideMainWindowForCapture() {
  // Opacity 0 hides it instantly (no minimize animation, no lag), then minimize and let it settle.
  if (!mainWin || mainWin.isDestroyed()) return;
  try { mainWin.setOpacity(0); } catch {}
  if (!mainWin.isMinimized()) mainWin.minimize();
  await sleep(450);
}
function showMainWindow() {
  if (!mainWin || mainWin.isDestroyed()) return;
  try { mainWin.setOpacity(1); } catch {}
  mainWin.show(); mainWin.restore(); mainWin.focus();
}
function closeHud() {
  closeFrame();
  if (hudWin && !hudWin.isDestroyed()) hudWin.destroy();
  hudWin = null;
}
function waitForIpc(channel, timeoutMs) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { ipcMain.removeListener(channel, done); resolve(); }, timeoutMs);
    ipcMain.once(channel, done);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Audio (system sound via Chromium loopback + microphone) -> recorded in a hidden window as Opus,
// then aligned with the video segments and muxed into the final file.
// ---------------------------------------------------------------------------------------------
function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })])
    .finally(() => clearTimeout(timer));
}
function configureAudioSession() {
  const ses = session.fromPartition('medialab-audio');
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media' || permission === 'display-capture'));
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'display-capture');
  ses.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      // 'loopback' = everything that plays through the speakers/headphones.
      callback({ video: sources[0], audio: 'loopback' });
    } catch { callback({}); }
  });
}
async function discardAudio() {
  audioActive = false;
  if (audioPrep) { clearTimeout(audioPrep.timer); audioPrep = null; }
  try { if (audioWin && !audioWin.isDestroyed()) audioWin.destroy(); } catch {}
  audioWin = null;
  try { if (audioStream) audioStream.destroy(); } catch {}
  audioStream = null;
  try { if (audioFile) fs.rmSync(audioFile, { force: true }); } catch {}
}
const audioKey = o => `${!!o.systemAudio}|${!!o.micAudio}`;
// Opening the audio devices takes 1-3 s. It is done ahead of time (during the countdown when there is one)
// and the actual recording is only "begun" when the video starts, so the first seconds are not lost.
function prepareAudio(opts) {
  if (!opts || (!opts.systemAudio && !opts.micAudio)) return Promise.resolve(false);
  const key = audioKey(opts);
  if (audioPrep && audioPrep.key === key) return audioPrep.promise;
  discardAudio();
  const entry = { key, timer: null, promise: null };
  entry.promise = (async () => {
    try {
      fs.mkdirSync(tempRoot, { recursive: true });
      audioFile = path.join(tempRoot, 'audio.webm');
      audioStream = fs.createWriteStream(audioFile);
      audioWin = new BrowserWindow({
        show: false, width: 320, height: 200,
        webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', partition: 'medialab-audio' }
      });
      await audioWin.loadFile(path.join(__dirname, 'audio-recorder.html'));
      // userGesture=true: getDisplayMedia() requires a user gesture.
      const result = await withTimeout(
        audioWin.webContents.executeJavaScript(`prepareCapture(${JSON.stringify({ system: !!opts.systemAudio, mic: !!opts.micAudio })})`, true),
        15000, 'timed out while opening the audio devices');
      if (!result || !result.ok) throw new Error((result && result.problems && result.problems.join('; ')) || 'no audio source available');
      if (result.problems && result.problems.length) send('recording-error', 'Audio: ' + result.problems.join('; '));
      return true;
    } catch (e) {
      logLine('Audio start failed: ' + e.message);
      send('recording-error', `Audio could not be started (${e.message}). Recording continues without sound.`);
      await discardAudio();
      return false;
    }
  })();
  // Never keep the devices open forever if the recording is cancelled.
  entry.timer = setTimeout(() => { if (!active && audioPrep === entry) discardAudio(); }, 90000);
  audioPrep = entry;
  return entry.promise;
}
async function beginAudio() {
  const at = await withTimeout(audioWin.webContents.executeJavaScript('beginRecording()', true), 5000, 'could not start the audio recorder');
  audioStartedAt = at;
  audioActive = true;
}
ipcMain.handle('prepare-audio', (_e, opts) => { if (!active) prepareAudio(opts); return true; });
ipcMain.handle('cancel-audio-prepare', () => { if (!active) discardAudio(); return true; });
ipcMain.on('audio-chunk', (_e, data) => { if (audioStream) audioStream.write(Buffer.from(data)); });
async function stopAudioCapture() {
  let ok = false;
  try {
    if (audioWin && !audioWin.isDestroyed()) {
      const done = waitForIpc('audio-done', 6000);
      audioWin.webContents.executeJavaScript('stopCapture()', true).catch(() => {});
      await done;
    }
    if (audioStream) await new Promise(res => audioStream.end(res));
    ok = !!audioFile && fs.existsSync(audioFile) && fs.statSync(audioFile).size > 1024;
  } catch (e) { logLine('Audio stop failed: ' + e.message); }
  audioStream = null;
  try { if (audioWin && !audioWin.isDestroyed()) audioWin.destroy(); } catch {}
  audioWin = null;
  audioActive = false;
  if (audioPrep) { clearTimeout(audioPrep.timer); audioPrep = null; }
  return ok;
}

function runFfmpeg(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpeg(), args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', d => { err = (err + d.toString()).slice(-5000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${label || 'FFmpeg'} failed (${code}). ${err.slice(-2000)}`)));
  });
}
function getMediaDuration(file) {
  // ffprobe is not bundled; `ffmpeg -i` prints the duration on stderr.
  return new Promise(resolve => {
    const child = spawn(resolveFfmpeg(), ['-hide_banner', '-i', file], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', () => resolve(0));
    child.on('close', () => {
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]) : 0);
    });
  });
}
// Cut the continuous audio recording into one slice per video segment (so pauses are removed and
// every slice has exactly the length of its video), then join the slices.
function buildAudioFilter(items) {
  const parts = [];
  const labels = [];
  items.forEach((it, i) => {
    const from = Math.max(0, it.start);
    const to = Math.max(from + 0.001, it.start + it.dur);
    let f = `[1:a]atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS`;
    if (it.start < 0) f += `,adelay=delays=${Math.round(-it.start * 1000)}:all=1`; // audio began after the video
    f += `,apad=whole_dur=${it.dur.toFixed(3)}[a${i}]`;
    parts.push(f);
    labels.push(`[a${i}]`);
  });
  parts.push(`${labels.join('')}concat=n=${items.length}:v=0:a=1[aout]`);
  return parts.join(';');
}

// ---------------------------------------------------------------------------------------------
// Black frame drawn just OUTSIDE the recorded region (4 thin solid-black windows), so it is
// visible to the user but never part of the recording. Also excluded from capture when possible.
// ---------------------------------------------------------------------------------------------
function closeFrame() {
  for (const w of frameWins) { try { if (!w.isDestroyed()) w.destroy(); } catch {} }
  frameWins = [];
}
function showRegionFrame(region) {
  closeFrame();
  if (!region) return;
  // ONE black window slightly larger than the region, shaped like a hollow rectangle (only a thin ring is
  // drawn / hit-tested). Thin separate windows cannot be made thinner than Windows' minimum window size.
  const t = 3, gap = 1, pad = t + gap;
  const b = { x: region.x - pad, y: region.y - pad, width: region.width + 2 * pad, height: region.height + 2 * pad };
  const W = b.width, H = b.height;
  const ring = [
    { x: 0, y: 0, width: W, height: t }, { x: 0, y: H - t, width: W, height: t },
    { x: 0, y: 0, width: t, height: H }, { x: W - t, y: 0, width: t, height: H }
  ];
  const w = new BrowserWindow({
    ...b, frame: false, thickFrame: false, transparent: false, backgroundColor: '#000000', resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true,
    hasShadow: false, show: false, webPreferences: { sandbox: true }
  });
  frameWins = [w];
  if (typeof w.setShape !== 'function') { closeFrame(); return; } // without the hollow shape it would cover the region
  try {
    w.setAlwaysOnTop(true, 'screen-saver');
    w.setIgnoreMouseEvents(true);
    w.setBounds(b);
    w.setShape(ring);
    try { w.setContentProtection(true); } catch {}
  } catch (e) { logLine('Region frame unavailable: ' + e.message); closeFrame(); return; }
  w.loadURL('data:text/html,<body style="margin:0;background:%23000"></body>');
  w.once('ready-to-show', () => {
    if (w.isDestroyed()) return;
    try { w.setShape(ring); } catch {}
    w.showInactive();
  });
}

// A frozen screenshot of the primary display, used as the backdrop of the region picker.
// (A live transparent window on top of the screen makes hardware-accelerated video go black.)
async function captureScreenImage() {
  try {
    const primary = screen.getPrimaryDisplay();
    const scale = Number(primary.scaleFactor) > 0 ? Number(primary.scaleFactor) : 1;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(primary.bounds.width * scale), height: Math.round(primary.bounds.height * scale) }
    });
    const src = sources.find(x => String(x.display_id) === String(primary.id)) || sources[0];
    if (!src || src.thumbnail.isEmpty()) return null;
    return 'data:image/jpeg;base64,' + src.thumbnail.toJPEG(90).toString('base64');
  } catch (e) {
    console.warn('Screen capture for region picker failed:', e.message);
    return null;
  }
}
function createSelectionOverlay(transparent) {
  const b = screen.getPrimaryDisplay().bounds;
  const win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, show: false, hasShadow: false, alwaysOnTop: true,
    transparent, backgroundColor: transparent ? '#00000000' : '#000000',
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  try { win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); } catch {}
  win.loadFile(path.join(__dirname, 'overlay.html'));
  win.on('closed', () => { if (overlayWin === win) overlayWin = null; });
  return win;
}
const HUD_FULL = { width: 430, height: 56 };
const HUD_COMPACT = { width: 150, height: 44 };
function showHud(opts = {}) {
  closeHud();
  const wa = screen.getPrimaryDisplay().workArea;
  hudWin = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - HUD_FULL.width) / 2), y: wa.y + 12, ...HUD_FULL,
    frame: false, transparent: false, backgroundColor: '#191919', resizable: false, maximizable: false, minimizable: false,
    fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false, hasShadow: false, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });
  hudWin.setAlwaysOnTop(true, 'screen-saver');
  // Keep the control bar out of the recording if it is dragged into the captured area.
  try { hudWin.setContentProtection(true); } catch (e) { console.warn('Content protection unavailable:', e.message); }
  hudWin.loadFile(path.join(__dirname, 'hud.html'));
  hudWin.webContents.once('did-finish-load', () => {
    safeHudSend('hud-init', { paused, elapsedMs, starting: !!opts.starting });
    if (hudWin && !hudWin.isDestroyed()) {
      hudWin.showInactive();
      // (re)apply after the native window exists: keeps the bar out of the recording
      try { hudWin.setContentProtection(true); } catch {}
    }
  });
  hudWin.on('closed', () => { hudWin = null; });
}
function waitForChildClose(child, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('error', onError);
      if (err) reject(err); else resolve(code);
    };
    const onError = (err) => finish(err);
    child.once('error', onError);
    child.once('close', (code) => finish(null, code));
    const timer = setTimeout(() => {
      if (!child.killed) child.kill();
      finish(new Error('FFmpeg did not stop cleanly in time.'));
    }, timeoutMs);
  });
}
async function stopFfmpegGracefully() {
  const child = ffmpeg;
  ffmpeg = null;
  if (!child || child.exitCode !== null) return;
  child.intentionalStop = true; // so the close handler does not report a false error
  // FFmpeg's `q` command finalizes container indexes (including MP4 moov atom).
  try { child.stdin.write('q\n'); } catch {}
  try { await waitForChildClose(child, 10000); }
  catch (e) {
    try { child.kill(); } catch {}
    throw e;
  }
}
async function fetchOpenWindows() {
  if (process.platform !== 'win32') return [];
  const script = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinList {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr extraData);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
$items = New-Object System.Collections.Generic.List[object]
[WinList]::EnumWindows({ param($h,$l)
  if ([WinList]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 512
    [void][WinList]::GetWindowText($h,$sb,$sb.Capacity)
    $title = $sb.ToString().Trim()
    $r = New-Object WinList+RECT
    if ($title.Length -gt 0 -and [WinList]::GetWindowRect($h,[ref]$r)) {
      $w = $r.Right - $r.Left; $hgt = $r.Bottom - $r.Top
      if ($w -ge 160 -and $hgt -ge 100) {
        $items.Add([pscustomobject]@{id=$title; title=$title; appName=$title; icon='▣'; width=$w; height=$hgt})
      }
    }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
$items | Sort-Object title -Unique | ConvertTo-Json -Compress
`;
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout.trim() || '[]');
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(w => w && w.title && w.title !== 'medialab Recording' && w.title !== 'medialab Recoding');
  } catch (e) {
    console.warn('Could not enumerate windows:', e.message);
    return [];
  }
}
async function listOpenWindows() {
  // Enumeration spawns PowerShell + compiles C#; never do it while recording and cache briefly.
  if (active) return windowsCache.data;
  if (Date.now() - windowsCache.at < 2500) return windowsCache.data;
  if (windowsInflight) return windowsInflight;
  windowsInflight = fetchOpenWindows()
    .then(data => { windowsCache = { at: Date.now(), data }; return data; })
    .finally(() => { windowsInflight = null; });
  return windowsInflight;
}
function clampRegionToPrimaryDisplay(region) {
  const display = screen.getPrimaryDisplay();
  const b = display.bounds;
  const x0 = Math.max(b.x, Math.min(Math.round(Number(region.x) || 0), b.x + b.width - 2));
  const y0 = Math.max(b.y, Math.min(Math.round(Number(region.y) || 0), b.y + b.height - 2));
  const right = Math.max(x0 + 2, Math.min(Math.round((Number(region.x) || 0) + (Number(region.width) || 2)), b.x + b.width));
  const bottom = Math.max(y0 + 2, Math.min(Math.round((Number(region.y) || 0) + (Number(region.height) || 2)), b.y + b.height));
  const width = Math.max(2, Math.floor((right - x0) / 2) * 2);
  const height = Math.max(2, Math.floor((bottom - y0) / 2) * 2);
  return { x: x0, y: y0, width, height };
}

function evenFloor(n) { return Math.max(2, Math.floor(Number(n) / 2) * 2); }
function dipToPhysicalRect(rect) {
  // Electron coordinates are DIP; gdigrab captures physical desktop pixels.
  try {
    if (typeof screen.dipToScreenRect === 'function') {
      const r = screen.dipToScreenRect(null, rect);
      if (r && r.width > 0 && r.height > 0) return r;
    }
  } catch {}
  const primary = screen.getPrimaryDisplay();
  const scale = Number(primary.scaleFactor) > 0 ? Number(primary.scaleFactor) : 1;
  return {
    x: Math.round((rect.x - primary.bounds.x) * scale), y: Math.round((rect.y - primary.bounds.y) * scale),
    width: Math.round(rect.width * scale), height: Math.round(rect.height * scale)
  };
}
function buildInputArgs(opts) {
  const fps = Number([24, 30, 60].includes(Number(opts.fps)) ? opts.fps : 30);
  const args = ['-hide_banner', '-loglevel', 'warning', '-thread_queue_size', '256', '-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', opts.hideCursor ? '0' : '1'];
  if (opts.mode === 'region' && opts.region) {
    const r = clampRegionToPrimaryDisplay(opts.region);
    recordingOptions.region = r;
    const phys = dipToPhysicalRect(r);
    args.push('-offset_x', String(Math.max(0, phys.x)), '-offset_y', String(Math.max(0, phys.y)), '-video_size', `${evenFloor(phys.width)}x${evenFloor(phys.height)}`);
  } else if (opts.mode === 'fullscreen' && screen.getAllDisplays().length > 1) {
    // "desktop" spans every monitor; limit "full screen" to the primary display (where the HUD lives).
    const phys = dipToPhysicalRect(screen.getPrimaryDisplay().bounds);
    args.push('-offset_x', String(Math.max(0, phys.x)), '-offset_y', String(Math.max(0, phys.y)), '-video_size', `${evenFloor(phys.width)}x${evenFloor(phys.height)}`);
  }
  if (opts.mode === 'window' && opts.windowTitle) args.push('-i', `title=${opts.windowTitle}`);
  else args.push('-i', 'desktop');
  return args;
}
function buildVideoFilter(opts) {
  const sizes = { '4k': [3840, 2160], '1080p': [1920, 1080], '720p': [1280, 720] };
  const target = sizes[opts.resolution];
  if (!target) return 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  // Keep the source aspect ratio (letterbox/pillarbox) instead of stretching; portrait sources get a portrait canvas.
  const [long, short] = target;
  const W = `'if(gte(iw,ih),${long},${short})'`;
  const H = `'if(gte(iw,ih),${short},${long})'`;
  return `scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=fast_bilinear,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`;
}
async function startSegment() {
  fs.mkdirSync(tempRoot, { recursive: true });
  const seg = path.join(tempRoot, `segment-${segmentIndex++}.mkv`);
  const crf = recordingOptions.sharpness === 'ultra' ? '18' : recordingOptions.sharpness === 'high' ? '21' : '25';
  // `ultrafast` keeps CPU usage lowest. Slower presets give much smaller recordings at the same quality:
  // set "encoderPreset": "veryfast" (about 3-4x smaller, more CPU) in medialab-preferences.json to try it.
  const prefPreset = readPreferences().encoderPreset;
  const preset = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast'].includes(prefPreset) ? prefPreset : 'ultrafast';
  const wantsAudio = !!(recordingOptions.systemAudio || recordingOptions.micAudio);
  const meta = { path: seg, spawnedAt: Date.now(), firstFrameAt: 0, endedAt: 0 };
  const args = [...(wantsAudio ? ['-stats', '-stats_period', '0.1'] : []), ...buildInputArgs(recordingOptions), '-vf', buildVideoFilter(recordingOptions),
    '-r', String(recordingOptions.fps || 30), '-c:v', 'libx264', '-preset', preset, ...(preset === 'ultrafast' ? ['-tune', 'zerolatency'] : []),
    '-crf', crf, '-pix_fmt', 'yuv420p', '-f', 'matroska', '-y', seg];
  const exe = resolveFfmpeg();
  // Force DPI awareness so gdigrab works in physical pixels on 125%/150% displays.
  const child = spawn(exe, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'], env: { ...process.env, __COMPAT_LAYER: 'HIGHDPIAWARE' } });
  ffmpeg = child;
  let stderr = '';
  child.stderr.on('data', d => {
    const text = d.toString();
    // First encoded frame = the moment the video timeline starts (used to align audio).
    if (!meta.firstFrameAt && /frame=\s*[1-9]/.test(text)) meta.firstFrameAt = Date.now() - 60;
    stderr = (stderr + text).slice(-6000);
  });
  child.on('error', e => send('recording-error', e.message));
  child.on('close', code => {
    meta.endedAt = Date.now();
    if (!child.intentionalStop && active && !paused && code !== 0) send('recording-error', `FFmpeg stopped unexpectedly (${code}). ${stderr.slice(-1200)}`);
  });
  await new Promise(resolve => setTimeout(resolve, 350));
  if (child.exitCode !== null) { if (ffmpeg === child) ffmpeg = null; throw new Error(`FFmpeg failed to start recording. ${stderr.slice(-1500)}`); }
  segments.push(seg);
  segMetas.push(meta);
}
async function pauseCapture() {
  if (!active || paused || stopPromise || starting) return;
  const stopAt = Date.now();
  try { await stopFfmpegGracefully(); } catch (e) { console.warn('FFmpeg did not pause cleanly:', e.message); }
  elapsedMs += stopAt - startedAt;
  paused = true;
  send('recording-status-change', { status: 'paused', elapsedMs });
  safeHudSend('hud-status', { paused: true, elapsedMs });
}
async function resumeCapture() {
  if (!active || !paused || stopPromise || starting) return;
  try {
    startedAt = Date.now();
    await startSegment();
    paused = false;
  } catch (e) {
    send('recording-error', e.message);
    send('recording-status-change', { status: 'paused', elapsedMs });
    safeHudSend('hud-status', { paused: true, elapsedMs });
    return;
  }
  send('recording-status-change', { status: 'recording', elapsedMs });
  safeHudSend('hud-status', { paused: false, elapsedMs });
}
function localDateStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function chooseOutputPath(folder, ext, opts) {
  const startIndex = Number.isInteger(opts.currentIndex) ? opts.currentIndex : 0;
  if (opts.autoSequential === false) {
    // Date-based names (matches the preview in the UI); add _2, _3... instead of overwriting.
    const base = `recording_${localDateStamp()}`;
    let output = path.join(folder, `${base}.${ext}`);
    for (let n = 2; fs.existsSync(output); n++) output = path.join(folder, `${base}_${n}.${ext}`);
    return { output, nextIndex: startIndex };
  }
  let index = startIndex;
  let output;
  do { output = path.join(folder, `${opts.prefix || ''}${index}.${ext}`); index++; } while (fs.existsSync(output));
  return { output, nextIndex: index };
}
async function stopCapture() {
  if (startingPromise) { try { await startingPromise; } catch {} }
  if (stopPromise) return stopPromise;
  if (!active) return null;
  stopPromise = (async () => {
    const t0 = Date.now();
    const timings = {};
    send('recording-status-change', { status: 'saving' });
    safeHudSend('hud-status', { paused: true, elapsedMs, saving: true });
    // Stop the audio recorder at the same time as FFmpeg (saves about a second).
    const audioWasRunning = audioActive;
    const audioStop = audioWasRunning ? stopAudioCapture() : Promise.resolve(false);
    try {
      if (!paused && ffmpeg) {
        const stopAt = Date.now();
        // Matroska segments stay playable even if FFmpeg had to be killed, so keep going.
        try { await stopFfmpegGracefully(); } catch (e) { console.warn('FFmpeg did not stop cleanly:', e.message); }
        elapsedMs += stopAt - startedAt;
      }
      timings.ffmpegStop = Date.now() - t0;
    } finally {
      // Always leave the "recording" state, even if something above failed.
      active = false;
      paused = false;
      closeHud();
      showMainWindow();
    }
    const hasAudio = await audioStop;
    timings.audioStop = Date.now() - t0;
    const validMetas = segMetas.filter(m => fs.existsSync(m.path) && fs.statSync(m.path).size > 2048);
    const valid = validMetas.map(m => m.path);
    if (!valid.length) throw new Error('No valid video segment was created. Check FFmpeg and capture permissions.');
    if (audioWasRunning && !hasAudio) send('recording-error', 'No audio was captured, the video was saved without sound.');
    let audioMerged = false;
    try {
      const folder = recordingOptions.savePath || app.getPath('videos');
      fs.mkdirSync(folder, { recursive: true });
      const ext = ['mp4', 'mkv', 'mov'].includes(recordingOptions.format) ? recordingOptions.format : 'mp4';
      const { output, nextIndex } = chooseOutputPath(folder, ext, recordingOptions);
      if (valid.length === 1 && ext === 'mkv' && !hasAudio) {
        // MKV is already finalized by FFmpeg; copying avoids unnecessary processing.
        fs.copyFileSync(valid[0], output);
      } else {
        const listPath = path.join(tempRoot, 'concat.txt');
        const concatEscape = p => p.replace(/\\/g, '/').replace(/'/g, "'\\''");
        fs.writeFileSync(listPath, valid.map(p => `file '${concatEscape(p)}'`).join('\n'), 'utf8');
        const container = ext === 'mkv' ? [] : ['-movflags', '+faststart'];
        if (hasAudio) {
          try {
            const items = await Promise.all(validMetas.map(async (m) => {
              const first = m.firstFrameAt || (m.spawnedAt + 450);
              let dur = await getMediaDuration(m.path);
              if (!dur) dur = Math.max(0.1, ((m.endedAt || Date.now()) - first) / 1000);
              return { start: (first - audioStartedAt) / 1000, dur };
            }));
            logLine('audio alignment (seconds, audio start relative to each video segment): ' + JSON.stringify(items));
            // Video is stream-copied; only the audio is encoded (AAC, best compatibility with editors).
            await runFfmpeg([
              '-hide_banner', '-loglevel', 'warning',
              '-f', 'concat', '-safe', '0', '-i', listPath, '-i', audioFile,
              '-filter_complex', buildAudioFilter(items),
              '-map', '0:v:0', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', ...container,
              '-y', output
            ], 'Merging audio');
            audioMerged = true;
            timings.merge = Date.now() - t0;
          } catch (e) {
            logLine('Audio merge failed: ' + e.message);
            send('recording-error', `Audio could not be merged, saved without sound. (raw audio kept in: ${tempRoot})`);
          }
        }
        if (!audioMerged) {
          // All segments use the same encoder settings. Stream-copy avoids re-encoding the whole recording.
          await runFfmpeg([
            '-hide_banner', '-loglevel', 'warning',
            '-f', 'concat', '-safe', '0', '-i', listPath,
            '-map', '0:v:0', '-c:v', 'copy', ...container, '-y', output
          ], 'Could not finalize video');
        }
      }
      if (!fs.existsSync(output) || fs.statSync(output).size < 2048) throw new Error('The output video is empty or incomplete.');
      if (!hasAudio || audioMerged) { try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {} }
      timings.total = Date.now() - t0;
      logLine('stop timings (ms since Stop was pressed): ' + JSON.stringify(timings));
      const result = { path: output, fileName: path.basename(output), durationSeconds: Math.max(1, Math.round(elapsedMs / 1000)), currentIndex: nextIndex };
      send('recording-saved', result);
      send('recording-status-change', { status: 'idle' });
      return result;
    } catch (e) {
      // Keep the temporary segments so the recording can be recovered manually.
      throw new Error(`${e.message} (raw segments kept in: ${tempRoot})`);
    }
  })();
  try { return await stopPromise; }
  catch (error) {
    send('recording-status-change', { status: 'idle' });
    throw error;
  } finally { stopPromise = null; }
}
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 600, height: 740, minWidth: 540, minHeight: 640, maxWidth: 760,
    useContentSize: true, center: true, maximizable: false,
    title: 'medialab Recording', icon: path.join(__dirname, 'dist', 'recording_icon_transparent.ico'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWin.loadFile(path.join(__dirname, 'dist', 'index.html'));
  mainWin.on('close', (e) => {
    if (!active || stopPromise) return;
    // Closing the window mid-recording would strand the raw segments in the temp folder.
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWin, {
      type: 'question', buttons: ['Stop & Save', 'Keep recording'], defaultId: 0, cancelId: 1,
      title: 'medialab Recording', message: 'A recording is in progress.', detail: 'Stop and save it before closing?'
    });
    if (choice === 0) stopCapture().catch(() => {}).finally(() => { if (mainWin && !mainWin.isDestroyed()) mainWin.close(); });
  });
  mainWin.on('closed', () => {
    mainWin = null;
    // Helper windows would otherwise keep the app alive forever.
    closeOverlay();
    closeHud();
  });
}
function registerHotkeys() {
  const guard = (fn) => () => { Promise.resolve().then(fn).catch(e => send('recording-error', e.message)); };
  const ok1 = globalShortcut.register('CommandOrControl+Shift+R', guard(() => {
    if (active) return stopCapture();
    send('hotkey-start');
  }));
  const ok2 = globalShortcut.register('CommandOrControl+Shift+P', guard(() => {
    if (!active) return;
    return paused ? resumeCapture() : pauseCapture();
  }));
  if (!ok1 || !ok2) console.warn('Some global shortcuts could not be registered (already used by another app).');
}
app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  cleanStaleTempFolders();
  try { configureAudioSession(); } catch (e) { console.warn('Audio session setup failed:', e.message); }
  createMainWindow();
  try { registerHotkeys(); } catch (e) { console.warn('Hotkeys unavailable:', e.message); }
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow(); });
}).catch(e => { dialog.showErrorBox('medialab Recording startup error', e.stack || e.message); app.quit(); });
app.on('before-quit', () => { if (ffmpeg) { try { ffmpeg.stdin.write('q\n'); } catch {} } });
app.on('will-quit', () => {
  try { if (audioWin && !audioWin.isDestroyed()) audioWin.destroy(); closeFrame(); } catch {}
  try { globalShortcut.unregisterAll(); } catch {} });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-default-save-info', (_e, rendererFallbackPath) => {
  const prefs = readPreferences();
  const candidates = [prefs.savePath, rendererFallbackPath, app.getPath('videos')];
  const savePath = candidates.find(p => typeof p === 'string' && p.trim() && fs.existsSync(p)) || app.getPath('videos');
  // Never replace a remembered folder just because it is unavailable right now (e.g. a drive that is not
  // connected). Only record one when nothing has been stored yet.
  if (!prefs.savePath) writePreferences({ savePath });
  logLine(`default save folder: stored=${JSON.stringify(prefs.savePath || null)} renderer=${JSON.stringify(rendererFallbackPath || null)} -> using ${JSON.stringify(savePath)} (userData=${app.getPath('userData')})`);
  let currentIndex = 0;
  while (['mp4', 'mkv', 'mov'].some(x => fs.existsSync(path.join(savePath, `${currentIndex}.${x}`)))) currentIndex++;
  return { savePath, currentIndex, preferences: readPreferences() };
});
ipcMain.handle('save-preferences', (_e, patch = {}) => {
  const next = { ...patch };
  const create = !!next.createSavePath;
  delete next.createSavePath;
  if ('savePath' in next) {
    // Only remember real absolute folders, so half-typed paths never replace a good one.
    const p = typeof next.savePath === 'string' ? next.savePath.trim() : '';
    let ok = false;
    try {
      if (p && path.isAbsolute(p)) {
        if (!fs.existsSync(p) && create) fs.mkdirSync(p, { recursive: true });
        ok = fs.existsSync(p) && fs.statSync(p).isDirectory();
      }
    } catch {}
    if (ok) next.savePath = p; else delete next.savePath;
  }
  return Object.keys(next).length ? writePreferences(next) : readPreferences();
});
ipcMain.handle('get-open-windows', () => listOpenWindows());
ipcMain.handle('choose-folder', async (_e, format = 'mp4') => {
  const result = await dialog.showOpenDialog(mainWin, { title: 'Choose recording folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  const folder = result.filePaths[0];
  writePreferences({ savePath: folder });
  let index = 0;
  while (['mp4', 'mkv', 'mov'].some(x => fs.existsSync(path.join(folder, `${index}.${x}`)))) index++;
  return { savePath: folder, currentIndex: index };
});
function finishRegionSelect(result) {
  if (!regionResolver) return;
  const done = regionResolver;
  regionResolver = null;
  closeOverlay();
  showMainWindow();
  done(result);
}
ipcMain.handle('select-region', async () => {
  if (regionResolver) finishRegionSelect({ cancelled: true });
  // Get the app out of the way, freeze the screen, then let the user drag on the frozen image.
  await hideMainWindowForCapture();
  const image = await captureScreenImage();
  closeOverlay();
  overlayWin = createSelectionOverlay(!image);
  const win = overlayWin;
  await new Promise(res => { win.webContents.once('did-finish-load', res); setTimeout(res, 3000); });
  if (win.isDestroyed()) return { cancelled: true };
  const b = screen.getPrimaryDisplay().bounds;
  const ready = waitForIpc('overlay-ready', 2500);
  safeOverlaySend('start-region-select', { image, origin: { x: b.x, y: b.y }, size: { width: b.width, height: b.height } });
  await ready;
  if (win.isDestroyed()) return { cancelled: true };
  win.show(); win.focus();
  // Esc must work even if Windows refuses to give the overlay keyboard focus.
  try { globalShortcut.register('Escape', () => finishRegionSelect({ cancelled: true })); } catch {}
  return await new Promise(resolve => {
    const timeout = setTimeout(() => finishRegionSelect({ cancelled: true }), 120000);
    regionResolver = (value) => { clearTimeout(timeout); resolve(value); };
  });
});
ipcMain.handle('start-record', async (_e, opts = {}) => {
  if (active) throw new Error('A recording is already active.');
  resolveFfmpeg();
  recordingOptions = { mode: 'region', resolution: 'native', fps: 30, sharpness: 'balanced', format: 'mp4', ...opts };
  if (!recordingOptions.savePath) recordingOptions.savePath = readPreferences().savePath || app.getPath('videos');
  try { if (fs.existsSync(recordingOptions.savePath)) writePreferences({ savePath: recordingOptions.savePath }); } catch {}
  if (recordingOptions.mode === 'region' && !recordingOptions.region) throw new Error('Select a recording region first.');
  if (recordingOptions.mode === 'window' && !recordingOptions.windowTitle) throw new Error('Select an open application window first.');
  segments = []; segMetas = []; segmentIndex = 0; elapsedMs = 0; startedAt = Date.now(); active = true; paused = false;
  audioActive = false;
  starting = true;
  startingPromise = (async () => {
    const wantAudio = !!(recordingOptions.systemAudio || recordingOptions.micAudio);
    // Audio devices take 1-3 s to open: start now (or reuse the ones prepared during the countdown) while the app hides.
    const audioReady = wantAudio ? prepareAudio(recordingOptions) : Promise.resolve(false);
    showHud({ starting: true });
    await hideMainWindowForCapture(); // the app window must be gone BEFORE the first video frame
    const audioOk = (await audioReady) === true;
    let beginTask = Promise.resolve(false);
    if (audioOk) {
      beginTask = beginAudio().then(() => true).catch(e => {
        logLine('Audio begin failed: ' + e.message);
        send('recording-error', `Audio could not be started (${e.message}). Recording continues without sound.`);
        return false;
      });
    }
    startedAt = Date.now();
    try { await startSegment(); }
    catch (e) { await beginTask; await discardAudio(); throw e; }
    audioActive = (await beginTask) === true;
    if (!audioActive) await discardAudio();
    safeHudSend('hud-status', { paused: false, elapsedMs: 0 });
    if (recordingOptions.mode === 'region') showRegionFrame(recordingOptions.region);
    send('recording-status-change', { status: 'recording', elapsedMs: 0 });
  })();
  try {
    await startingPromise;
    return { ok: true };
  } catch (e) {
    active = false; paused = false;
    closeHud();
    await discardAudio();
    showMainWindow();
    if (ffmpeg) { try { ffmpeg.kill(); } catch {} ffmpeg = null; }
    throw e;
  } finally { starting = false; startingPromise = null; }
});
ipcMain.handle('pause-record', () => pauseCapture());
ipcMain.handle('resume-record', () => resumeCapture());
ipcMain.handle('stop-save', () => stopCapture());
ipcMain.on('region-selected', (_e, region) => {
  if (region && !region.cancelled) {
    const normalized = clampRegionToPrimaryDisplay(region);
    send('region-updated', normalized);
    finishRegionSelect(normalized);
  } else {
    finishRegionSelect(region || { cancelled: true });
  }
});
ipcMain.on('hud-compact', (_e, compact) => {
  if (hudWin && !hudWin.isDestroyed()) {
    const size = compact ? HUD_COMPACT : HUD_FULL;
    hudWin.setSize(size.width, size.height);
  }
});
ipcMain.on('hud-pause-resume', () => (paused ? resumeCapture() : pauseCapture()).catch(e => send('recording-error', e.message)));
ipcMain.on('hud-stop-save', () => stopCapture().catch(e => send('recording-error', e.message)));
