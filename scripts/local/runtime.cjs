const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const localDir = path.join(root, '.local');

function findMariaDbBinary(name) {
  const installation = fs.readdirSync(localDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && /^mariadb-.*-winx64$/.test(entry.name));
  if (!installation) throw new Error('MariaDB local no esta instalado en .local');
  const executable = path.join(localDir, installation.name, 'bin', `${name}.exe`);
  if (!fs.existsSync(executable)) throw new Error(`No se encontro ${executable}`);
  return executable;
}

function portIsOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function waitForPort(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portIsOpen(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`El puerto ${port} no respondio dentro del tiempo esperado`);
}

module.exports = { findMariaDbBinary, localDir, portIsOpen, root, waitForPort };
