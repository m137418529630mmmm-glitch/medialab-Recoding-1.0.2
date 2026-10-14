const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

let mainWin, overlayWin, active = false, paused = false, ffmpeg = null;
let segments = [], segmentIndex = 0, recordingOptions = null, currentOutput = null, startedAt = 0, elapsedMs = 0;
const ffmpegPath = (ffmpegStatic || '').replace('app.asar', 'app.asar.unpacked');
const tempRoot = path.join(os.tmpdir(), 'medialab-recoding-' + process.pid);

function send(channel, data) { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, data); }
function ensureOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return;
  overlayWin = new BrowserWindow({
    x: 0, y: 0, width: screen.getPrimaryDisplay().bounds.width, height: screen.getPrimaryDisplay().bounds.height,
    transparent: true, frame: false, resizable: false, movable: false, alwaysOnTop: true,
    skipTaskbar: true, show: false, hasShadow: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setContentProtection(true);
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWin.on('closed', () => { overlayWin = null; });
}
function runFfmpeg(args, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(outputPath) : reject(new Error(err.slice(-3000) || `FFmpeg exited ${code}`)));
    ffmpeg = child;
  });
}
function buildInputArgs(opts) {
  const args = ['-thread_queue_size', '1024', '-f', 'gdigrab', '-framerate', String(opts.fps || 60), '-draw_mouse', opts.hideCursor ? '0' : '1'];
  if (opts.mode === 'region' && opts.region) {
    const r = opts.region;
    args.push('-offset_x', String(Math.max(0, Math.round(r.x))), '-offset_y', String(Math.max(0, Math.round(r.y))),
      '-video_size', `${Math.max(2, Math.floor(r.width/2)*2)}x${Math.max(2, Math.floor(r.height/2)*2)}`);
  }
  args.push('-i', opts.mode === 'window' && opts.windowTitle ? `title=${opts.windowTitle}` : 'desktop');
  return args;
}
function buildVideoFilter(opts) {
  const scales = { '4k': 'scale=3840:2160:flags=lanczos', '1080p': 'scale=1920:1080:flags=lanczos', '720p': 'scale=1280:720:flags=lanczos', native: 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos' };
  return (scales[opts.resolution || '1080p'] || scales['1080p']) + (opts.sharpness === 'ultra' ? ',unsharp=3:3:0.55:3:3:0.0' : '');
}
async function startSegment() {
  fs.mkdirSync(tempRoot, { recursive: true });
  const seg = path.join(tempRoot, `segment-${segmentIndex++}.mp4`);
  segments.push(seg);
  const crf = recordingOptions.sharpness === 'ultra' ? '12' : recordingOptions.sharpness === 'high' ? '16' : '21';
  const args = [...buildInputArgs(recordingOptions), '-probesize', '42M', '-vf', buildVideoFilter(recordingOptions),
    '-r', String(recordingOptions.fps || 60), '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', seg];
  ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
  ffmpeg.stderr.on('data', () => {});
  ffmpeg.on('error', e => { send('recording-error', e.message); });
}
async function pauseCapture() {
  if (!active || paused) return;
  paused = true;
  if (ffmpeg && !ffmpeg.killed) {
    const child = ffmpeg;
    await new Promise(resolve => { child.once('close', resolve); child.kill('SIGINT'); });
  }
  elapsedMs += Date.now() - startedAt;
  send('recording-status-change', { status: 'paused' });
  if (overlayWin) overlayWin.webContents.send('hud-status', { paused: true, elapsedMs });
}
async function resumeCapture() {
  if (!active || !paused) return;
  paused = false; startedAt = Date.now();
  await startSegment();
  send('recording-status-change', { status: 'recording' });
  if (overlayWin) overlayWin.webContents.send('hud-status', { paused: false, elapsedMs });
}
async function stopCapture() {
  if (!active) return null;
  if (!paused && ffmpeg && !ffmpeg.killed) {
    const child = ffmpeg;
    await new Promise(resolve => { child.once('close', resolve); child.kill('SIGINT'); });
    elapsedMs += Date.now() - startedAt;
  }
  active = false; paused = false;
  if (overlayWin) { overlayWin.hide(); overlayWin.webContents.send('hide-hud'); }
  const valid = segments.filter(p => fs.existsSync(p) && fs.statSync(p).size > 1000);
  if (!valid.length) throw new Error('No video frames were captured. Check screen permissions and FFmpeg.');
  const folder = recordingOptions.savePath || app.getPath('videos');
  fs.mkdirSync(folder, { recursive: true });
  let index = Number.isInteger(recordingOptions.currentIndex) ? recordingOptions.currentIndex : 0;
  let output;
  do { output = path.join(folder, `${recordingOptions.prefix || ''}${index}.${recordingOptions.format || 'mp4'}`); index++; } while (fs.existsSync(output));
  if (valid.length === 1) fs.copyFileSync(valid[0], output);
  else {
    const listPath = path.join(tempRoot, 'concat.txt');
    fs.writeFileSync(listPath, valid.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-y', output], output);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  const result = { path: output, fileName: path.basename(output), durationSeconds: Math.max(1, Math.round(elapsedMs / 1000)), currentIndex: index };
  send('recording-saved', result); send('recording-status-change', { status: 'idle' });
  return result;
}
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1080, height: 850, minWidth: 760, minHeight: 650, title: 'medialab Recoding',
    icon: path.join(__dirname, 'dist', 'recording_icon_transparent.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWin.loadFile(path.join(__dirname, 'dist', 'index.html'));
}
app.whenReady().then(() => { ensureOverlay(); createMainWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-default-save-info', () => ({ savePath: app.getPath('videos'), currentIndex: 0 }));
ipcMain.handle('choose-folder', async (_e, format = 'mp4') => {
  const result = await dialog.showOpenDialog(mainWin, { title: 'Choose recording folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  const folder = result.filePaths[0];
  let index = 0;
  while (fs.existsSync(path.join(folder, `${index}.${format}`))) index++;
  return { savePath: folder, currentIndex: index };
});
ipcMain.handle('select-region', async () => {
  ensureOverlay(); overlayWin.show(); overlayWin.setIgnoreMouseEvents(false);
  overlayWin.webContents.send('start-region-select');
  return await new Promise(resolve => { ipcMain.once('region-selected-main', (_event, region) => { overlayWin.hide(); overlayWin.setIgnoreMouseEvents(true, { forward: true }); resolve(region); }); });
});
ipcMain.handle('start-record', async (_e, opts) => {
  if (active) throw new Error('A recording is already active.');
  recordingOptions = { mode: 'region', resolution: '1080p', fps: 60, sharpness: 'ultra', format: 'mp4', ...opts };
  if (!recordingOptions.savePath) recordingOptions.savePath = app.getPath('videos');
  segments = []; segmentIndex = 0; elapsedMs = 0; startedAt = Date.now(); active = true; paused = false;
  await startSegment();
  ensureOverlay(); overlayWin.show(); overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.webContents.send('show-recording-hud', { region: recordingOptions.mode === 'region' ? recordingOptions.region : null });
  send('recording-status-change', { status: 'recording' });
  return { ok: true };
});
ipcMain.handle('pause-record', () => pauseCapture());
ipcMain.handle('resume-record', () => resumeCapture());
ipcMain.handle('stop-save', () => stopCapture());
ipcMain.on('region-selected', (_e, region) => ipcMain.emit('region-selected-main', null, region));
ipcMain.on('overlay-mouse-enter', () => overlayWin && overlayWin.setIgnoreMouseEvents(false));
ipcMain.on('overlay-mouse-leave', () => overlayWin && overlayWin.setIgnoreMouseEvents(true, { forward: true }));
ipcMain.on('hud-pause-resume', () => paused ? resumeCapture() : pauseCapture());
ipcMain.on('hud-stop-save', () => stopCapture().catch(e => send('recording-error', e.message)));
