import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/pdfforge/package.json', import.meta.url));
const electron = require('electron');
const env = { ...process.env, PDFFORGE_SMOKE_ROOT: fileURLToPath(new URL('../apps/pdfforge/', import.meta.url)) };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [...process.argv.slice(2), fileURLToPath(new URL('../integrations/pdfforge/smoke-ponte.cjs', import.meta.url)),
  fileURLToPath(new URL('../apps/pdfforge/', import.meta.url))], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
const prazo = setTimeout(() => { console.error('ELECTRON_CHILD_TIMEOUT'); child.kill(); process.exitCode = 1; }, 60000);
child.on('exit', code => { clearTimeout(prazo); process.exitCode = code ?? 1; });
