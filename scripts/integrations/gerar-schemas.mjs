// Development-only: regenerate output contracts after a deliberate canonical schema change.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import { z } from 'zod';
const acervo = (await runnerImport(fileURLToPath(new URL('../../src/contracts/api/consultaAcervo.ts', import.meta.url)))).module;
const integracoes = (await runnerImport(fileURLToPath(new URL('../../src/contracts/api/integracoesEstado.ts', import.meta.url)))).module;
const schemas = { acervo_buscar: acervo.BuscaAcervoResposta, acervo_ler: acervo.LeituraAcervoResposta, integracoes_estado: integracoes.EstadoIntegracoes };
const json = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, z.toJSONSchema(schema, { unrepresentable: 'any' })]));
await writeFile(new URL('./saidas-canonicas.json', import.meta.url), JSON.stringify(json, null, 2) + '\n');
