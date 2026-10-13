// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,fireEvent,screen,waitFor} from '@testing-library/react';
import {ReconciliarMedicamentos} from '../../../src/ui/consulta/ReconciliarMedicamentos.js';
import {criarPortaHttp} from '../../../src/ui/api/http.js';
import {criarMotorF1} from '../../../src/kernel/orquestracao/runtime.js';
import {abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,SENHA,AGORA} from '../../f0-fecha/fixtures/consulta-completa.js';
let ambiente:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{cleanup();vi.unstubAllGlobals();if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});
it('HTTP autenticado confirma novo medicamento, estímulo MED_RECONC e callback vê revisão causal atual',async()=>{
 ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);
 const ctx={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
 const motor=criarMotorF1(ambiente.db,()=>AGORA,()=>({regras:[],biblioteca:{id:'biblioteca-sintetica',versao:'1',hash:'hash-sintetico'}}));
 const antes=motor.retrato(ctx);const http=globalThis.fetch,base=ambiente.baseUrl;
 vi.stubGlobal('fetch',(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>http(typeof input==='string'&&input.startsWith('/')?`${base}${input}`:input,init));
 const porta=criarPortaHttp({onSessaoExpirada:()=>{}});expect((await porta.login(SENHA)).ok).toBe(true);await porta.carregarConsulta(PACIENTE,null,ENCONTRO);
 const callback=vi.fn(()=>{const r=motor.retrato(ctx);expect(r.revisao).not.toBe(antes.revisao);expect(r.fatos.some(f=>f.campo==='medicamentos'&&JSON.stringify(f.dados.valor)==='["Pemetrexede","Ibuprofeno"]')).toBe(true);});
 render(<ReconciliarMedicamentos porta={porta} contexto={ctx} aoFatosConfirmados={callback}/>);
 fireEvent.change(screen.getByLabelText('Lista de medicamentos'),{target:{value:'Pemetrexede\nIbuprofeno'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button'));
 await waitFor(()=>expect(callback).toHaveBeenCalledWith(ctx));expect(ambiente.eventos().filter(e=>e.tipo==='FATO')).toHaveLength(1);
 expect(ambiente.db.prepare("SELECT conteudo FROM estimulo_tecnico WHERE json_extract(conteudo,'$.tipo')='MED_RECONCILIADO'").all()).toHaveLength(1);
 await motor.processar();const atual=await motor.consultar(ctx);expect(atual.visaoIntegrada?.correlacao.revisaoFatos).toBe(atual.retrato.revisao);
 const negado=await ambiente.request('/consulta/medicamentos/reconciliar',{...ctx,operationId:'injetar-ator',medicamentos:[],listaAtualCompleta:true,criadoPor:'falso'});expect(negado.status).toBe(400);
});
