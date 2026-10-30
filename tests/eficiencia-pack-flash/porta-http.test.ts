import { afterEach, expect, it, vi } from 'vitest';
import { criarPortaHttp } from '../../src/ui/api/http.js';
import { lerFontePack } from '../../src/server/leituraPack.js';
import { fixturePack } from './fixtures.js';
afterEach(() => vi.unstubAllGlobals());
it.each(['packId','hash','patientId','encounterId','tumorLotId'])('cliente não apresenta fonte com %s divergente', async campo => {
  const f=fixturePack(), resposta=lerFontePack(f.catalogo,f.pedido);
  if(campo==='packId')resposta.packId='outro-pack';
  else if(campo==='hash')resposta.original.sha256='b'.repeat(64);
  else resposta.contexto[campo as 'patientId'|'encounterId'|'tumorLotId']='outro-contexto';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(resposta),{status:200})));
  const porta=criarPortaHttp({onSessaoExpirada:()=>{}});
  await expect(porta.fontePack!(f.pedido)).rejects.toThrow('FONTE_PACK_ALTERADA');
});
