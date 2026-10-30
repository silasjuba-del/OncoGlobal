import { executarJornadaMedicoM123 } from '../tests/medico-m123/e2e/jornada.mjs';
executarJornadaMedicoM123().catch(error => { console.error(error); process.exitCode = 1; });
