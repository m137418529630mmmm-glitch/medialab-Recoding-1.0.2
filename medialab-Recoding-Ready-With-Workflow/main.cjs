const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

let mainWin = null;
let overlayWin = null;
let active = false;
let paused = false;
let ffmpeg = null;
let segments = [];
let segmentIndex = 0;
let recordingOptions = null;
let startedAt = 0;
let elapsedMs = 0;
let stopPromise = null;
const tempRoot = path.join(os.tmpdir(), `medialab-recoding-${process.pid}`);
const preferencesPath = path.join(app.getPath('userData'), 'medialab-preferences.json');
function readPreferences() {
  try { return JSON.parse(fs.readFileSync(preferencesPath, 'utf8')); } catch { return {}; }
}
function writePreferences(patch) {
  const current = readPreferences();
  const next = { ...current, ...patch };
  try {
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    fs.writeFileSync(preferencesPath, JSON.stringify(next, null, 2), 'utf8');
  } catch (error) { console.warn('Could not persist preferences:', error.message); }
  return next;
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
function ensureOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;
  const display = screen.getPrimaryDisplay();
  overlayWin = new BrowserWindow({
    x: display.bounds.x, y: display.bounds.y,
    width: display.bounds.width, height: display.bounds.height,
    transparent: true, frame: false, resizable: false, movable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, hasShadow: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  try { overlayWin.setContentProtection(true); } catch (e) { console.warn('Content protection unavailable:', e.message); }
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWin.on('closed', () => { overlayWin = null; });
  return overlayWin;
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
  // FFmpeg's `q` command finalizes container indexes (including MP4 moov atom).
  try { child.stdin.write('q\n'); } catch {}
  try { await waitForChildClose(child, 10000); }
  catch (e) {
    try { child.kill(); } catch {}
    throw e;
  }
}
async function listOpenWindows() {
  if (process.platform !== 'win32') return [];
  const script = String.raw`
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
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(w => w && w.title);
  } catch (e) {
    console.warn('Could not enumerate windows:', e.message);
    return [];
  }
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

function buildInputArgs(opts) {
  const fps = Number([24, 30, 60].includes(Number(opts.fps)) ? opts.fps : 30);
  const args = ['-hide_banner', '-loglevel', 'warning', '-thread_queue_size', '256', '-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', opts.hideCursor ? '0' : '1'];
  if (opts.mode === 'region' && opts.region) {
    const r = clampRegionToPrimaryDisplay(opts.region);
    recordingOptions.region = r;
    const display = screen.getPrimaryDisplay().bounds;
    // gdigrab offsets are relative to the desktop capture origin.
    const x = Math.max(0, r.x - display.x);
    const y = Math.max(0, r.y - display.y);
    args.push('-offset_x', String(x), '-offset_y', String(y), '-video_size', `${r.width}x${r.height}`);
  }
  if (opts.mode === 'window' && opts.windowTitle) args.push('-i', `title=${opts.windowTitle}`);
  else args.push('-i', 'desktop');
  return args;
}
function buildVideoFilter(opts) {
  const scales = {
    '4k': 'scale=3840:2160:flags=fast_bilinear',
    '1080p': 'scale=1920:1080:flags=fast_bilinear',
    '720p': 'scale=1280:720:flags=fast_bilinear',
    native: 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
  };
  // Keep capture responsive: Lanczos + unsharp is intentionally avoided for real-time recording.
  return scales[opts.resolution || 'native'] || scales.native;
}
async function startSegment() {
  fs.mkdirSync(tempRoot, { recursive: true });
  const seg = path.join(tempRoot, `segment-${segmentIndex++}.mkv`);
  const crf = recordingOptions.sharpness === 'ultra' ? '18' : recordingOptions.sharpness === 'high' ? '21' : '25';
  const args = [...buildInputArgs(recordingOptions), '-vf', buildVideoFilter(recordingOptions),
    '-r', String(recordingOptions.fps || 30), '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-crf', crf, '-pix_fmt', 'yuv420p', '-f', 'matroska', '-y', seg];
  const exe = resolveFfmpeg();
  const child = spawn(exe, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  ffmpeg = child;
  let stderr = '';
  child.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-6000); });
  child.on('error', e => send('recording-error', e.message));
  child.on('close', code => {
    if (active && !paused && code !== 0) send('recording-error', `FFmpeg stopped unexpectedly (${code}). ${stderr.slice(-1200)}`);
  });
  await new Promise(resolve => setTimeout(resolve, 350));
  if (child.exitCode !== null) throw new Error(`FFmpeg failed to start recording. ${stderr.slice(-1500)}`);
  segments.push(seg);
}
async function pauseCapture() {
  if (!active || paused) return;
  await stopFfmpegGracefully();
  elapsedMs += Date.now() - startedAt;
  paused = true;
  send('recording-status-change', { status: 'paused' });
  safeOverlaySend('hud-status', { paused: true, elapsedMs });
}
async function resumeCapture() {
  if (!active || !paused) return;
  paused = false;
  startedAt = Date.now();
  await startSegment();
  send('recording-status-change', { status: 'recording' });
  safeOverlaySend('hud-status', { paused: false, elapsedMs });
}
async function stopCapture() {
  if (stopPromise) return stopPromise;
  stopPromise = (async () => {
    if (!active) return null;
    if (!paused && ffmpeg) {
      await stopFfmpegGracefully();
      elapsedMs += Date.now() - startedAt;
    }
    active = false;
    paused = false;
    if (overlayWin) { safeOverlaySend('hide-hud'); overlayWin.hide(); }
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.show();
      mainWin.restore();
      mainWin.focus();
    }
    const valid = segments.filter(p => fs.existsSync(p) && fs.statSync(p).size > 2048);
    if (!valid.length) throw new Error('No valid video segment was created. Check FFmpeg and capture permissions.');
    const folder = recordingOptions.savePath || app.getPath('videos');
    fs.mkdirSync(folder, { recursive: true });
    const ext = recordingOptions.format === 'mkv' ? 'mkv' : 'mp4';
    let index = Number.isInteger(recordingOptions.currentIndex) ? recordingOptions.currentIndex : 0;
    let output;
    do { output = path.join(folder, `${recordingOptions.prefix || ''}${index}.${ext}`); index++; } while (fs.existsSync(output));
    const exe = resolveFfmpeg();
    if (valid.length === 1 && ext === 'mkv') {
      // MKV is already finalized by FFmpeg; copying avoids unnecessary processing.
      fs.copyFileSync(valid[0], output);
    } else {
      const listPath = path.join(tempRoot, 'concat.txt');
      const concatEscape = p => p.replace(/\\/g, '/').replace(/'/g, "'\\''");
      fs.writeFileSync(listPath, valid.map(p => `file '${concatEscape(p)}'`).join('\n'), 'utf8');

      // All segments use the same encoder settings. Stream-copy avoids re-encoding
      // the entire recording on Stop & Save and therefore reduces finalization time.
      const args = [
        '-hide_banner', '-loglevel', 'warning',
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-map', '0:v:0', '-c:v', 'copy', '-movflags', '+faststart', '-y', output
      ];
      await new Promise((resolve, reject) => {
        const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr.on('data', d => { err = (err + d.toString()).slice(-5000); });
        child.on('error', reject);
        child.on('close', code => code === 0
          ? resolve()
          : reject(new Error(`Could not finalize video (${code}). ${err.slice(-2000)}`)));
      });
    }
    if (!fs.existsSync(output) || fs.statSync(output).size < 2048) throw new Error('The output video is empty or incomplete.');
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
    const result = { path: output, fileName: path.basename(output), durationSeconds: Math.max(1, Math.round(elapsedMs / 1000)), currentIndex: index };
    send('recording-saved', result); send('recording-status-change', { status: 'idle' });
    return result;
  })();
  try { return await stopPromise; }
  catch (error) {
    send('recording-status-change', { status: 'idle' });
    throw error;
  } finally { stopPromise = null; }
}
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 780, height: 620, minWidth: 720, minHeight: 560,
    useContentSize: true, center: true, maximizable: false,
    title: 'medialab Recoding', icon: path.join(__dirname, 'dist', 'recording_icon_transparent.ico'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWin.loadFile(path.join(__dirname, 'dist', 'index.html'));
  mainWin.on('closed', () => { mainWin = null; });
}
app.whenReady().then(() => {
  try { ensureOverlay(); } catch (e) { console.error(e); }
  createMainWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow(); });
}).catch(e => { dialog.showErrorBox('medialab Recoding startup error', e.stack || e.message); app.quit(); });
app.on('before-quit', () => { if (ffmpeg) { try { ffmpeg.stdin.write('q\n'); } catch {} } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-default-save-info', () => {
  const prefs = readPreferences();
  const savePath = prefs.savePath && fs.existsSync(prefs.savePath) ? prefs.savePath : app.getPath('videos');
  let currentIndex = 0;
  while (fs.existsSync(path.join(savePath, `${currentIndex}.mp4`))) currentIndex++;
  return { savePath, currentIndex, preferences: prefs };
});
ipcMain.handle('save-preferences', (_e, patch = {}) => writePreferences(patch));
ipcMain.handle('get-open-windows', () => listOpenWindows());
ipcMain.handle('choose-folder', async (_e, format = 'mp4') => {
  const result = await dialog.showOpenDialog(mainWin, { title: 'Choose recording folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  const folder = result.filePaths[0];
  writePreferences({ savePath: folder });
  let index = 0;
  while (fs.existsSync(path.join(folder, `${index}.${format}`))) index++;
  return { savePath: folder, currentIndex: index };
});
ipcMain.handle('select-region', async () => {
  const win = ensureOverlay();
  win.show(); win.setIgnoreMouseEvents(false); win.focus();
  safeOverlaySend('start-region-select');
  return await new Promise(resolve => {
    const timeout = setTimeout(() => { resolve({ cancelled: true }); }, 120000);
    ipcMain.once('region-selected-main', (_event, region) => { clearTimeout(timeout); win.hide(); win.setIgnoreMouseEvents(true, { forward: true }); resolve(region); });
  });
});
ipcMain.handle('start-record', async (_e, opts = {}) => {
  if (active) throw new Error('A recording is already active.');
  resolveFfmpeg();
  recordingOptions = { mode: 'region', resolution: 'native', fps: 30, sharpness: 'balanced', format: 'mp4', ...opts };
  if (!recordingOptions.savePath) recordingOptions.savePath = readPreferences().savePath || app.getPath('videos');
  writePreferences({ savePath: recordingOptions.savePath });
  if (recordingOptions.mode === 'region' && !recordingOptions.region) throw new Error('Select a recording region first.');
  if (recordingOptions.mode === 'window' && !recordingOptions.windowTitle) throw new Error('Select an open application window first.');
  segments = []; segmentIndex = 0; elapsedMs = 0; startedAt = Date.now(); active = true; paused = false;
  try {
    await startSegment();
    const win = ensureOverlay(); win.show(); win.setIgnoreMouseEvents(true, { forward: true });
    safeOverlaySend('show-recording-hud', { region: recordingOptions.mode === 'region' ? recordingOptions.region : null });
    if (mainWin && !mainWin.isDestroyed()) mainWin.minimize();
    send('recording-status-change', { status: 'recording' });
    return { ok: true };
  } catch (e) {
    active = false; paused = false;
    if (overlayWin && !overlayWin.isDestroyed()) { safeOverlaySend('hide-hud'); overlayWin.hide(); }
    if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.restore(); mainWin.focus(); }
    if (ffmpeg) { try { ffmpeg.kill(); } catch {} ffmpeg = null; }
    throw e;
  }
});
ipcMain.handle('pause-record', () => pauseCapture());
ipcMain.handle('resume-record', () => resumeCapture());
ipcMain.handle('stop-save', () => stopCapture());
ipcMain.on('region-selected', (_e, region) => {
  if (region && !region.cancelled) {
    const normalized = clampRegionToPrimaryDisplay(region);
    send('region-updated', normalized);
    ipcMain.emit('region-selected-main', null, normalized);
  } else {
    ipcMain.emit('region-selected-main', null, region || { cancelled: true });
  }
});
ipcMain.on('overlay-mouse-enter', () => overlayWin && overlayWin.setIgnoreMouseEvents(false));
ipcMain.on('overlay-mouse-leave', () => overlayWin && overlayWin.setIgnoreMouseEvents(true, { forward: true }));
ipcMain.on('hud-pause-resume', () => (paused ? resumeCapture() : pauseCapture()).catch(e => send('recording-error', e.message)));
ipcMain.on('hud-stop-save', () => stopCapture().catch(e => send('recording-error', e.message)));
