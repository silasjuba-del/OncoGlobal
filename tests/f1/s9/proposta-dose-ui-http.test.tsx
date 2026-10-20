// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import * as fontes from '../../../src/server/propostasDoseReceita.js';
import {ConsultaPersistida} from '../../../src/ui/consulta/ConsultaPersistida.js';
import {criarPortaHttp} from '../../../src/ui/api/http.js';
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,SENHA} from '../../f0-fecha/fixtures/consulta-completa.js';
import {criarResolverDocumentoLedger} from '../../../src/kernel/ledger/documentos.js';
let ambiente:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});
it('dose documental é pré-preenchida; fonte aparece na revisão; só o clique médico assina',async()=>{
 const propostas=fontes.lerPropostasDoseReceita(JSON.stringify({header:{versao:'sintetica-1'},consultavel:true,status:'RASCUNHO',itens:[{id:'fonte-sintetica',droga:'Medicamento sintético',dose:'25',unidade:'mg',nota:'Restrição sintética integral',pendencia:'Pendência documental sintética',via:'Via sintética',frequencia:'Frequência sintética',duracao:'Duração sintética',indicacao:'Caso integralmente sintético',controle344:{lista:'comum'},fonte:{estado:'VERIFICADO',referencia:'Referência sintética de teste',trecho:'Dose sintética literal'}}]}));
 vi.spyOn(fontes,'lerPropostasDoseReceita').mockReturnValue(propostas);
 ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);
 const base=ambiente.baseUrl,realFetch=globalThis.fetch;
 vi.stubGlobal('fetch',(input:string|URL|Request,init?:RequestInit)=>realFetch(typeof input==='string'&&input.startsWith('/')?base+input:input,init));
 const porta=criarPortaHttp({onSessaoExpirada:()=>{}});expect((await porta.login(SENHA)).ok).toBe(true);
 render(<ConsultaPersistida porta={porta} contexto={{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Consulta Flash'}));
 fireEvent.change(screen.getByLabelText('Medicamento da receita'),{target:{value:'Medicamento sintético'}});fireEvent.blur(screen.getByLabelText('Medicamento da receita'));
 await waitFor(()=>expect((screen.getByLabelText('Dose da receita') as HTMLInputElement).value).toBe('25 mg'));
 expect(ambiente.eventos().filter(e=>e.revisao==='ASSINADO')).toHaveLength(0);
 fireEvent.click(screen.getByRole('checkbox',{name:'Incluir receita digitada'}));
 fireEvent.click(screen.getByRole('button',{name:'Revisar documentos para assinatura'}));
 const preview=await screen.findByRole('region',{name:'Conteúdo para assinatura'});
 expect(preview.textContent).toContain('25 mg');expect(preview.textContent).toContain('Referência sintética de teste');expect(preview.textContent).toContain('RASCUNHO');expect(preview.textContent).toContain('Restrição sintética integral');expect(preview.textContent).toContain('Pendência documental sintética');
 expect(ambiente.eventos().filter(e=>e.revisao==='ASSINADO')).toHaveLength(0);
 fireEvent.click(within(preview).getByRole('button',{name:'Confirmar e assinar conteúdo exibido'}));
 await waitFor(()=>expect(ambiente!.eventos().some(e=>e.tipo==='DOCUMENTO'&&JSON.stringify(e.payload).includes('FLASH_RECEITA')&&e.revisao==='ASSINADO')).toBe(true));
 const eventos=ambiente.eventos();const rx=eventos.find(e=>(e.payload as any)?.data?.data?.tipoDocumento==='FLASH_RECEITA')!;
 const corpo=(rx.payload as any).data.data;
 expect(corpo.propostasDoseReceita).toMatchObject([{id:'fonte-sintetica',fonte:{referencia:'Referência sintética de teste'}}]);
 expect((await criarResolverDocumentoLedger(ambiente.db).resolver({id:corpo.documentId,version:1}))?.html).toContain('25 mg');
 cleanup();render(<ConsultaPersistida porta={porta} contexto={{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null}}/>);
 expect((await screen.findByRole('region',{name:'Histórico de documentos assinados'})).textContent).toContain('25 mg');
});
it('fonte retirada depois do preparo conserva a minuta e impede assinatura desatualizada',async()=>{
 const propostas=fontes.lerPropostasDoseReceita(JSON.stringify({header:{versao:'sintetica'},consultavel:true,status:'RASCUNHO',itens:[{id:'fonte-teste',droga:'Medicamento sintético',dose:'25',unidade:'mg',indicacao:'Caso sintético',controle344:{lista:'comum'},fonte:{estado:'VERIFICADO',referencia:'Fonte sintética',trecho:'Trecho sintético'}}]}));
 const fonte=propostas[0]!;vi.spyOn(fontes,'lerPropostasDoseReceita').mockReturnValue(propostas);
 ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);await carregarConsulta(ambiente);
 const contexto={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
 const plano={acoesMarcadas:[],receitasMarcadas:['rx'],receitas:[{id:'rx',medicamento:fonte.medicamento,dose:fonte.dose,orientacao:null,duracao:null,via:null,quantidade:null}],
 propostasDoseReceita:[{receitaId:'rx',propostaId:fonte.id,hashFonte:fonte.fonte.hash,hashProposta:fonte.hashProposta}],
 apac:{cid:'',sigtap:'',finalidade:'',competencia:'',estado:'PENDENTE',pendencias:[],emitir:false},retorno:{dias:null,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:[],imagem:[]}};
 const preparada=await ambiente.request('/consulta/flash/preparar',{...contexto,plano,idempotencyKey:'preparo-sintetico'});expect(preparada.status).toBe(200);
 const rx=preparada.data.documentos.find((d:any)=>d.tipoDocumento==='FLASH_RECEITA');const reg=preparada.data.registros.find((r:any)=>r.id===rx.documentId);
 expect((await ambiente.request('/consulta/bundle',{...contexto,draftIds:[reg.id]})).status).toBe(200);
 propostas.splice(0);
 const salva=await ambiente.request('/consulta/flash/rascunho',{...contexto,plano,expectedRevision:null});expect(salva.status,JSON.stringify(salva.data)).toBe(201);
 const assinatura=await ambiente.request('/consulta/confirmar',{...contexto,bloco:'TUDO',registros:[reg],documentosExibidos:[{documentId:rx.documentId,documentVersion:rx.documentVersion}],reconhecerAlertas:[],idempotencyKey:'assinatura-sintetica'});
 expect(assinatura.status).toBe(409);expect(assinatura.data.codigo).toBe('PROPOSTA_DOSE_DESATUALIZADA');
 expect((await ambiente.request('/consulta/flash/preparar',{...contexto,plano,idempotencyKey:'preparo-obsoleto'})).data.codigo).toBe('PROPOSTA_DOSE_DESATUALIZADA');
 expect(ambiente.eventos().filter(e=>e.revisao==='ASSINADO')).toHaveLength(0);
});
