import {expect,it} from 'vitest';
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,AGORA} from '../f0-fecha/fixtures/consulta-completa.js';
import {salvarDraft} from '../../src/kernel/comandos/portas.js';
import {executarConfirmacao} from '../../src/kernel/comandos/index.js';
import {hashCanonico} from '../../src/rules/conteudoCanonico.js';
it('duto de farmácia exige fonte entregue pela consulta e recusa eco sem recibo',async()=>{
 const a=await abrirAmbiente(criarDiretorio()),ctx={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};try{
  cadastrarPaciente(a);await carregarConsulta(a);
  const data={documentId:'rx-l4',documentVersion:1,tipoDocumento:'PRESCRICAO_QT',texto:'Prescrição exclusivamente sintética'};
  salvarDraft(a.db,{draftId:'rx-l4',patientId:PACIENTE,sourceId:'manual',rawRef:'manual',payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
  executarConfirmacao(a.db,{...ctx,operationId:'rx-l4',reviewDecisionId:'rx-l4',sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:'rx-l4',expectedRevision:0,eventId:'rx-l4',tipo:'DOCUMENTO',revisao:'ASSINADO',fontes:[],payload:{data,signature:{documentId:'rx-l4',documentVersion:1,documentHash:hashCanonico(data),reviewDecisionId:'rx-l4',serverActorId:a.sessoes.obter(a.token)!.medicoId}}}]});
  const pedido={contexto:{...ctx,operationId:'farmacia-l4'},prescricao:{documentId:'rx-l4',documentVersion:1}},antes=a.eventos();
  expect(await a.request('/farmacia/enviar',pedido)).toMatchObject({status:409,data:{codigo:'CONTEUDO_DUTO_NAO_EXIBIDO'}});expect(a.eventos()).toEqual(antes);
  await carregarConsulta(a);
  expect((await a.request('/farmacia/enviar',pedido)).status).toBe(200);
  const gravados=a.eventos();expect((await a.request('/farmacia/enviar',pedido)).data.codigo).toBe('REPLAY');expect(a.eventos()).toEqual(gravados);
 }finally{await a.close();removerDiretorio(a.dir);}
});
