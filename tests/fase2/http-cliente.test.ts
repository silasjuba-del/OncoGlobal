import {afterEach,expect,it,vi} from 'vitest';
import {criarPortaHttp} from '../../src/ui/api/http.js';
afterEach(()=>vi.unstubAllGlobals());
it('preserva consulta ainda não criada para abrir o seletor de lotes; rota inexistente continua pendente',async()=>{
 const porta=criarPortaHttp({onSessaoExpirada:vi.fn()});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({codigo:'CONSULTA_NAO_ENCONTRADA'}),{status:404})));
 await expect(porta.carregarConsulta('sintetico',null,'encontro')).rejects.toMatchObject({codigo:'CONSULTA_NAO_ENCONTRADA'});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({codigo:'ROTA_NAO_ENCONTRADA'}),{status:404})));
 await expect(porta.carregarConsulta('sintetico',null,'encontro')).rejects.toMatchObject({codigo:'SERVIDOR_PENDENTE'});
});
