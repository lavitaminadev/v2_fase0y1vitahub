const { portIsOpen } = require('./runtime.cjs');

(async () => {
  for (const [name, port] of [['MariaDB', 3307], ['API', 3000], ['Web', 5173]]) {
    const active = await portIsOpen(port, 'localhost') || await portIsOpen(port, '127.0.0.1');
    console.log(`${name.padEnd(8)} ${active ? 'activo' : 'detenido'} (${port})`);
  }
})();
