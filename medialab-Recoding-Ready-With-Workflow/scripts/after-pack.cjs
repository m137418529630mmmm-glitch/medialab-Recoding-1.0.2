// Runs after electron-builder packs the app (before the installer is built).
// Chromium ships ~55 locale files (~40 MB); this app only needs English (required fallback) and Arabic.
const fs = require('fs');
const path = require('path');
const KEEP = new Set(['en-US.pak', 'ar.pak']);
exports.default = async function afterPack(context) {
  const dir = path.join(context.appOutDir, 'locales');
  if (!fs.existsSync(dir)) return;
  let removed = 0, bytes = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.pak') || KEEP.has(name)) continue;
    const file = path.join(dir, name);
    bytes += fs.statSync(file).size;
    fs.rmSync(file, { force: true });
    removed++;
  }
  console.log(`  • afterPack: removed ${removed} unused locale files (${(bytes / 1048576).toFixed(1)} MB)`);
};
