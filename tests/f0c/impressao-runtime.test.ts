import { confirmar, salvarDraft } from '../../src/kernel/ledger/writeRouter.js';
import { afterEach, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { criarExecutorImprimir } from '../../src/app/executores/imprimir.js';
import { criarResolverDocumentoLedger } from '../../src/app/executores/resolverDocumentoLedger.js';
import { criarGateway, memoriaIdempotencia } from '../../src/kernel/gateway/gateway.js';
import { autorizarSaida } from '../../src/server/autorizacao.js';
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from '../f0-fecha/fixtures/consulta-completa.js';

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
const dirs: string[] = [];
afterEach(async () => { if (ambiente) { await ambiente.close(); ambiente=undefined; } for(const d of dirs.splice(0))removerDiretorio(d); });
const contexto={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
async function preparar() {
  const dir=criarDiretorio();dirs.push(dir);const a=ambiente=await abrirAmbiente(dir);
  cadastrarPaciente(a);await carregarConsulta(a);
  const plano={acoesMarcadas:[],receitasMarcadas:[],apac:{cid:'',sigtap:'',finalidade:'',competencia:'',estado:'PENDENTE',pendencias:[],emitir:false},
    retorno:{dias:21,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:['HMG','CEA','<script>window.print()</script>'],imagem:['TC tórax']},
    decisaoQt:{solicitarCiclo:false,data:null}};
  const p=await a.request('/consulta/flash/preparar',{...contexto,plano,idempotencyKey:'impressao-preparar-real'});
  expect(p.status).toBe(200);expect(p.data.alvoImpressao.tipo).toBe('DOCUMENTO');
  const target=p.data.alvoImpressao as {tipo:string;id:string;versao:number};
  const resolver=criarResolverDocumentoLedger(a.db);
  const executor=criarExecutorImprimir({dataDir:dir,agora:()=>AGORA,resolverDocumento:resolver});
  const intent={verbo:'IMPRIMIR' as const,objeto:target,escopo:{patientId:PACIENTE,encounterId:ENCONTRO},destino:null,idempotencyKey:'impressao-executar-real'};
  const assinar=async()=>{
    expect((await a.request('/consulta/bundle',{...contexto,draftIds:p.data.registros.map((r:{id:string})=>r.id)})).status).toBe(200);
    const r=await a.request('/consulta/confirmar',{...contexto,bloco:'TUDO',registros:p.data.registros,
      documentosExibidos:p.data.documentos.map((d:{documentId:string;documentVersion:number})=>({documentId:d.documentId,documentVersion:d.documentVersion})),
      reconhecerAlertas:[],idempotencyKey:'impressao-assinatura-real'});
    expect(r.status).toBe(200);expect(r.data.codigo).toBe('GRAVADA');
  };
  return {a,target,resolver,executor,intent,assinar};
}
it('conjunto essencial percorre HTTP preparar/exibir/confirmar e gateway real escreve HTML assinado escapado',async()=>{
  const f=await preparar();await f.assinar();
  const doc=await f.resolver.resolver({id:f.target.id,version:1});expect(doc?.assinado).toBe(true);
  expect(doc?.html).toContain('Pedido de laboratório');expect(doc?.html).toContain('TC tórax');expect(doc?.html).toContain('Retorno em 21 dias');
  expect(doc?.html).toContain('&lt;script&gt;window.print()&lt;/script&gt;');expect(doc?.html).not.toContain('<script>window.print()');
  expect(autorizarSaida(f.a.db,f.intent)).toEqual({ok:true});
  const gateway=criarGateway({agora:()=>AGORA,store:memoriaIdempotencia(),auditar:()=>{},executores:{IMPRIMIR:f.executor}});
  const impresso=await gateway.executar(f.intent,f.a.sessoes.obter(f.a.token)!);
  expect(impresso.decisao).toBe('EXECUTADA');expect(impresso.recibo).toBeTruthy();
  const html=readFileSync(impresso.recibo!,'utf8');expect(html).toContain('addEventListener("click",()=>window.print())');
  expect(html).not.toMatch(/onload\s*=/i);expect(html).not.toContain('<script>window.print()');
  expect(html.match(/<script>/g)).toHaveLength(1);
  expect((await gateway.executar(f.intent,f.a.sessoes.obter(f.a.token)!)).decisao).toBe('REPLAY');
});
it('rascunho não é documento imprimível e não cria arquivo antes da assinatura',async()=>{
  const f=await preparar();
  expect(await f.resolver.resolver({id:f.target.id,version:1})).toBeNull();
  expect(autorizarSaida(f.a.db,f.intent)).toEqual({ok:false,codigo:'ARTEFATO_NAO_ASSINADO'});
  expect(await f.executor.executar(f.intent)).toMatchObject({ok:false,erro:'DOCUMENTO_NAO_RESOLVIDO'});
  expect(existsSync(`${f.a.dir}/impressao`)).toBe(false);
});
it('executor recusa outro paciente mesmo com documento assinado válido',async()=>{
  const f=await preparar();await f.assinar();
  expect(await f.executor.executar({...f.intent,escopo:{...f.intent.escopo,patientId:'Outro Paciente Sintético'}}))
    .toMatchObject({ok:false,erro:'DOCUMENTO_NAO_ASSINADO_OU_ESCOPO_DIVERGENTE'});
  expect(existsSync(`${f.a.dir}/impressao`)).toBe(false);
});
it('hash da assinatura adulterado é recusado pelo resolver e pelo executor',async()=>{
  const f=await preparar();await f.assinar();
  const e=f.a.eventos().find(e=>{
    const p=e.payload as {data?:{signature?:{documentId?:string}}};return p.data?.signature?.documentId===f.target.id;
  })!;
  expect(e).toBeTruthy();
  const p=JSON.parse(JSON.stringify(e.payload));p.data.signature.documentHash='0'.repeat(64);
  const adulterar=()=>f.a.db.prepare('UPDATE clinical_event SET payload=? WHERE eventId=?').run(JSON.stringify(p),e.eventId);
  expect(adulterar).toThrow(); // O ledger impede mutação normal.
  // Simula exclusivamente neste banco sintético corrupção externa do arquivo restaurado.
  f.a.db.exec('DROP TRIGGER clinical_event_no_update'); adulterar();
  expect(await f.resolver.resolver({id:f.target.id,version:1})).toBeNull();
  expect(await f.executor.executar(f.intent)).toMatchObject({ok:false,erro:'DOCUMENTO_NAO_RESOLVIDO'});
});
it('conteúdo alterado após assinatura e versão diferente não são resolvidos',async()=>{
  const f=await preparar();await f.assinar();
  expect(await f.resolver.resolver({id:f.target.id,version:2})).toBeNull();
  const e=f.a.eventos().find(e=>{
    const p=e.payload as {data?:{signature?:{documentId?:string}}};return p.data?.signature?.documentId===f.target.id;
  })!;
  const p=JSON.parse(JSON.stringify(e.payload));p.data.data.texto+=' texto adulterado';
  const adulterar=()=>f.a.db.prepare('UPDATE clinical_event SET payload=? WHERE eventId=?').run(JSON.stringify(p),e.eventId);
  expect(adulterar).toThrow(); // O ledger impede mutação normal.
  // Simula exclusivamente neste banco sintético corrupção externa do arquivo restaurado.
  f.a.db.exec('DROP TRIGGER clinical_event_no_update'); adulterar();
  expect(await f.resolver.resolver({id:f.target.id,version:1})).toBeNull();
});

it('conjunto não imprime cópia de pedido individual supersedido depois da assinatura',async()=>{
  const f=await preparar();await f.assinar();
  const laboratorio=f.a.eventos().find(e=>{
    const p=e.payload as {data?:{data?:{tipoDocumento?:string}}};return p.data?.data?.tipoDocumento==='FLASH_PEDIDO_LABORATORIO';
  })!;
  expect(laboratorio).toBeTruthy();
  salvarDraft(f.a.db,{draftId:'cancelamento-sintetico',patientId:PACIENTE,sourceId:'medico-sintetico',rawRef:'teste',payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
  expect(confirmar(f.a.db,{operationId:'cancelamento-operacao',...contexto,reviewDecisionId:'revisao-cancelamento',sessao:f.a.sessoes.obter(f.a.token)!,em:AGORA,
    registros:[{draftId:'cancelamento-sintetico',expectedRevision:0,eventId:'cancelamento-evento',tipo:'DOCUMENTO',payload:{cancelado:true},
      fontes:[],revisao:'CONFIRMADO',supersedesEventId:laboratorio.eventId}]}).estado).toBe('GRAVADA');
  expect(await f.resolver.resolver({id:f.target.id,version:1})).toBeNull();
  expect(await f.executor.executar(f.intent)).toMatchObject({ok:false,erro:'DOCUMENTO_NAO_RESOLVIDO'});
});
