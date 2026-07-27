const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { findMariaDbBinary, localDir, portIsOpen, root, waitForPort } = require('./runtime.cjs');

fs.mkdirSync(localDir, { recursive: true });
const pids = {};

function startProcess(name, executable, args, cwd) {
  const output = fs.openSync(path.join(localDir, `${name}.log`), 'a');
  const error = fs.openSync(path.join(localDir, `${name}.error.log`), 'a');
  const child = spawn(executable, args, {
    cwd,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', output, error],
  });
  child.unref();
  fs.closeSync(output);
  fs.closeSync(error);
  pids[name] = child.pid;
}

async function main() {
  if (!(await portIsOpen(3307))) {
    const server = findMariaDbBinary('mariadbd');
    const config = path.join(localDir, 'mariadb-data', 'my.ini');
    if (!fs.existsSync(config)) throw new Error('La base local no esta inicializada');
    startProcess('database', server, [`--defaults-file=${config}`, '--console'], path.dirname(server));
    await waitForPort(3307);
  }

  if (!(await portIsOpen(3000))) {
    const tsNode = require.resolve('ts-node/dist/bin.js', { paths: [root] });
    startProcess('api', process.execPath, [tsNode, 'src/main.ts'], path.join(root, 'apps', 'api'));
    await waitForPort(3000, 60_000);
  }
  if (!(await portIsOpen(5173))) {
    const vitePackage = require.resolve('vite/package.json', { paths: [path.join(root, 'apps', 'web')] });
    const vite = path.join(path.dirname(vitePackage), 'bin', 'vite.js');
    startProcess('web', process.execPath, [vite, '--host', 'localhost'], path.join(root, 'apps', 'web'));
    await waitForPort(5173, 60_000);
  }

  fs.writeFileSync(path.join(localDir, 'pids.json'), JSON.stringify(pids, null, 2));
  const health = await fetch('http://localhost:3000/api/health').then((response) => response.json());
  console.log(`VITAHUB local listo (${health.status || 'healthy'})`);
  console.log('Aplicacion: http://localhost:5173');
  console.log('API:        http://localhost:3000/api');
  console.log('Swagger:    http://localhost:3000/api/docs');
}

main().catch((error) => {
  console.error(error.message);
  console.error('Revisa los archivos .local/*.error.log para mas detalle.');
  process.exit(1);
});
