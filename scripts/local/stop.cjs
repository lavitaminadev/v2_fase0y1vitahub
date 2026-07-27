const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { localDir } = require('./runtime.cjs');

const pidFile = path.join(localDir, 'pids.json');
if (!fs.existsSync(pidFile)) {
  console.log('No hay procesos locales registrados.');
  process.exit(0);
}

const pids = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
for (const [name, pid] of Object.entries(pids)) {
  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    console.log(`${name} detenido`);
  } catch {
    console.log(`${name} ya estaba detenido`);
  }
}
fs.rmSync(pidFile, { force: true });
