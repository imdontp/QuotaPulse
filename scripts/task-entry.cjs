// The Scheduled Task owns this process directly; there is no shell parent.
const { parseArgs } = require('node:util');
const { join, isAbsolute, resolve } = require('node:path');
// Electron may retain its runtime switches before the application entry in argv.
const samePath = (value) => process.platform === 'win32' ? resolve(value).toLowerCase() === __filename.toLowerCase() : resolve(value) === __filename;
const entryIndex = process.argv.findIndex((value, index) => index > 0 && samePath(value));
if (entryIndex < 0) throw new Error('Task entry not found in process arguments');
const { values } = parseArgs({ args: process.argv.slice(entryIndex + 1), options: {
  role: { type: 'string' }, port: { type: 'string' },
  'data-dir': { type: 'string' }, 'no-readers': { type: 'boolean', default: false },
  'node-exe': { type: 'string' },
} });
if (!['daemon', 'tray'].includes(values.role)) throw new Error('Invalid task role');
const port = Number(values.port);
if (!/^\d+$/.test(values.port ?? '') || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid task port');
if (values['data-dir'] !== undefined && !isAbsolute(values['data-dir'])) throw new Error('Task data directory must be absolute');
if (values['node-exe'] !== undefined && !isAbsolute(values['node-exe'])) throw new Error('Task Node executable must be absolute');
process.env.QUOTAPULSE_PORT = String(port);
if (values['data-dir'] !== undefined) process.env.QUOTAPULSE_DATA_DIR = values['data-dir'];
if (values['no-readers']) process.env.QUOTAPULSE_READERS = 'off';
if (values['node-exe'] !== undefined) process.env.QUOTAPULSE_NODE_EXE = values['node-exe'];
const root = join(__dirname, '..');
const entry = join(root, 'packages', values.role, 'dist', values.role === 'daemon' ? 'index.js' : 'main.js');
if (values.role === 'tray') {
  // Electron's bundled Node supports synchronous ESM loading. Keep profile setup
  // before readiness; loading this module asynchronously could race app.ready.
  require(entry);
} else {
  // Preserve the daemon's Node >=22.5 compatibility without require(ESM).
  import(require('node:url').pathToFileURL(entry).href).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
