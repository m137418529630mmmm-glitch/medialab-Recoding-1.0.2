// Reduce the packaged Electron runtime after electron-builder has copied the app.
const fs = require('fs');
const path = require('path');

const KEEP_LOCALES = new Set(['en-US.pak', 'ar.pak']);
function removeIfFile(file) {
  try {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) fs.rmSync(file, { force: true });
  } catch (error) {
    console.warn(`afterPack: unable to remove ${file}: ${error.message}`);
  }
}
exports.default = async function afterPack(context) {
  const resources = path.join(context.appOutDir, 'locales');
  let removedLocales = 0;
  if (fs.existsSync(resources)) {
    for (const name of fs.readdirSync(resources)) {
      if (name.endsWith('.pak') && !KEEP_LOCALES.has(name)) {
        removeIfFile(path.join(resources, name));
        removedLocales++;
      }
    }
  }

  let removedFiles = 0;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        entry.name.toLowerCase() === 'licenses.chromium.html' ||
        entry.name.toLowerCase().endsWith('.pdb') ||
        entry.name.toLowerCase().endsWith('.map')
      ) {
        removeIfFile(full);
        removedFiles++;
      }
    }
  };
  walk(context.appOutDir);
  console.log(`afterPack: removed ${removedLocales} unused locales and ${removedFiles} debug/license files.`);
};
