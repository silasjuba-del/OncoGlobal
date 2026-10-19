import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { criarGerenciadorSessao } from '../../../src/server/sessao.js';
import { CanalEnvelopeWebhookBruto, CanalWebhookBruto } from '../../../src/contracts/f2/canalEntrada.js';
import { interpretarCorpoWebhook } from '../../../src/modules/canal/ingresso.js';
import { avaliarAlarmesCanalConferidos, classificarRelatoCanal, extrairMencoesClinicasCanal,
  type RulesetAlarmeCanalEntrada } from '../../../src/modules/canal/reconciliacaoClinica.js';
import { receberEnvelopeWebhookCanal, receberTransporteSintetico, ingerirLoteImapCanal,
  lerCheckpointImapCanal, registrarConsentimentoCanal, type ContaWebhookConfigurada } from '../../../src/server/canalEntrada.js';
import { reconciliarMensagemCanalPersistida, lerReconciliacaoMensagemCanal } from '../../../src/server/canalReconciliacao.js';
import { prepararRascunhoRespostaCanal, confirmarRespostaCanalPeloMedico, integrarCanalNaPreConsultaECabecalho, registrarLeituraLocalMidiaCanal } from '../../../src/server/canalResposta.js';
import { garantirSchema, detalheMensagemCanal } from '../../../src/server/canalEntrada.js';
import { LIMITE_NOS_JSON } from '../../../src/modules/canal/autenticarWebhook.js';
import { autorizarSaida } from '../../../src/server/autorizacao.js';

const AGORA='2026-10-19T12:00:00.000Z';
const REMETENTE='contato-sintetico';
const EMAIL=['paciente-revisao','example.test'].join('@');
const SECRET='segredo-sintetico-revisao';
const CONTAS: ContaWebhookConfigurada[]=[{accountId:'conta-a',canal:'WHATSAPP_SERVICO',keyId:'key-a',segredo:SECRET}];
const CADASTROS=[{patientId:'paciente-revisao',identificadores:[{tipo:'TELEFONE' as const,valor:REMETENTE}],nome:'Paciente Revisao Sintetica',chaveDemografica:null}];
const DBS: ReturnType<typeof abrirLedger>[]=[];
const dbNovo=()=>{const db=abrirLedger(':memory:');DBS.push(db);return db;};
afterEach(()=>{for(const db of DBS.splice(0))db.close();});
const texto=(s:string)=>({tipo:'TEXT' as const,texto:s,contentSha256:createHash('sha256').update(s).digest('hex')});
const acesso=()=>{const sessoes=criarGerenciadorSessao({medicoId:'medico-revisao',crm:'CRM-SINTETICO',senha:'senha-sintetica-revisao',duracaoMs:60_000,agora:()=>AGORA});return {sessoes,token:sessoes.login('senha-sintetica-revisao')!.token,agora:AGORA};};
function mensagem(id:string,conteudo='Texto sintético') {return {categoriaEvento:'MENSAGEM',mensagem:{tipoConteudo:'TEXT',providerMessageId:id,senderRef:REMETENTE,providerSentAt:AGORA,texto:conteudo}};}
function pedido(eventos:unknown[],accountRef?:string){const bytes=Buffer.from(JSON.stringify({envelopeId:'env-sintetico',enviadoEm:AGORA,...(accountRef?{accountRef}:{}),eventos}));return {bytes,assinatura:`sha256=${createHmac('sha256',SECRET).update(bytes).digest('hex')}`,keyId:'key-a',verificadoEm:AGORA};}
const lote=(uidValidity:number,uid=1)=>({accountId:'imap-revisao',mailbox:'INBOX',uidValiditySessao:uidValidity,ingestedAt:AGORA,cadastros:[{patientId:'paciente-revisao',nome:'Paciente Revisao Sintetica',chaveDemografica:null,identificadores:[{tipo:'EMAIL' as const,valor:EMAIL}]}],mensagens:[{uidValidity,uid,fromAddress:EMAIL,sentAt:AGORA,rawBytes:Buffer.from('Authentication-Results: dkim=fail; spf=fail\r\n\r\nTexto sintético'),conteudo:texto('Relato recebido por e-mail')}]});
const regras: RulesetAlarmeCanalEntrada={rulesetId:'revisao-sintetica',rulesetVersao:'1.0.0',fraseFinal:'Nada substitui a avaliação presencial do seu médico.',sinais:[
  {id:'febre',termo:'Febre',termos:['febre'],limiarDecimosExclusivo:378,orientacao:'Texto sintético conferido.',status:'CONFERIDA_MEDICO',fonte:'fixture sintética'},
  {id:'sangramento',termo:'Sangramento',termos:['sangramento'],limiarDecimosExclusivo:null,orientacao:'Texto sintético conferido.',status:'CONFERIDA_MEDICO',fonte:'fixture sintética'},
]};
function alarmes(s:string,mencoes=extrairMencoesClinicasCanal(s)){return avaliarAlarmesCanalConferidos({textoOriginal:s,mencoes,patientIdVinculado:'paciente-revisao',autorRelato:'PACIENTE',ruleset:regras});}

describe('revisão independente F2 — ingresso',()=>{
  it.each([[false,false],[false,true],[true,false],[true,true]])('ACK de conflito exige persistência real: quarentena=%s autorização=%s',(quarentenarConflito,autorizarAckConflitoQuarentenado)=>{
    const db=dbNovo();
    expect(receberEnvelopeWebhookCanal(db,pedido([mensagem('id-conflito','original')]),{contasConfiguradas:CONTAS,cadastros:[]}).ok).toBe(true);
    const r=receberEnvelopeWebhookCanal(db,pedido([mensagem('id-conflito','divergente')]),{contasConfiguradas:CONTAS,cadastros:[],quarentenarConflito,autorizarAckConflitoQuarentenado});
    expect(r.ok&&'ackAutorizado' in r&&r.ackAutorizado).toBe(quarentenarConflito&&autorizarAckConflitoQuarentenado);
    expect(Number(db.prepare('SELECT count(*) AS n FROM canal_conflito_quarentena').get()!.n)).toBe(quarentenarConflito?1:0);
    expect(JSON.parse(String(db.prepare('SELECT conteudo FROM canal_mensagem').get()!.conteudo)).texto).toBe('original');
  });
  it('segredo compartilhado não autentica uma conta escolhida fora do envelope assinado',()=>{
    const db=dbNovo();const contas=[...CONTAS,{...CONTAS[0]!,accountId:'conta-b',keyId:'key-b'}];
    const p=pedido([mensagem('id-compartilhado')]);
    expect(receberEnvelopeWebhookCanal(db,p,{contasConfiguradas:contas,cadastros:[]}).ok).toBe(false);
    const assinado=pedido([mensagem('id-compartilhado')],'conta-a');
    expect(receberEnvelopeWebhookCanal(db,assinado,{contasConfiguradas:contas,cadastros:[]}).ok).toBe(true);
    expect(receberEnvelopeWebhookCanal(db,{...assinado,keyId:'key-b'},{contasConfiguradas:contas,cadastros:[]}).ok).toBe(false);
  });
  it('lote máximo permitido pelo contrato cabe nos limites do autenticador',()=>{
    const p=pedido(Array.from({length:50},(_,i)=>mensagem(`msg-${i}`)),'conta-a');
    expect(CanalEnvelopeWebhookBruto.safeParse(JSON.parse(p.bytes.toString())).success).toBe(true);
    expect(receberEnvelopeWebhookCanal(dbNovo(),p,{contasConfiguradas:CONTAS,cadastros:[]})).toMatchObject({ok:true,ackAutorizado:true});
  });
  it('hash declarado pelo provedor é preservado sem comprovar leitura local da mídia',()=>{
    const payload={tipoConteudo:'MEDIA_UNPROCESSED',providerMessageId:'midia-1',senderRef:REMETENTE,providerSentAt:AGORA,media:{providerMediaId:'arquivo-1',mimeType:'image/png',sizeBytes:32,sha256:'a'.repeat(64)}};
    expect(CanalWebhookBruto.safeParse(payload).success).toBe(true);
    const p=interpretarCorpoWebhook(Buffer.from(JSON.stringify(payload)));
    expect(p).toMatchObject({ok:true,corpo:{conteudo:{processamento:'NAO_PROCESSADA',contentSha256:null,providerSha256:'a'.repeat(64)}}});
  });
  it('From cadastrado sem prova de autoria não atribui automaticamente o paciente',async()=>{
    const db=dbNovo();expect((await ingerirLoteImapCanal(db,lote(1))).ok).toBe(true);
    const row=db.prepare('SELECT vinculoClasse,vinculoPatientId,vinculoMotivo FROM canal_mensagem').get()!;
    expect(row.vinculoPatientId).toBeNull();expect(row.vinculoClasse).not.toBe('CONHECIDO');
    expect(String(row.vinculoMotivo)).toMatch(/autentic|revis/i);
  });
  it('reconciliação não restaura vínculo automático de um From não autenticado',async()=>{
    const db=dbNovo();const entrada=lote(1);const r=await ingerirLoteImapCanal(db,entrada);expect(r.ok).toBe(true);if(!r.ok)return;
    const result=await reconciliarMensagemCanalPersistida(db,acesso(),{mensagemId:r.resultados[0]!.reciboId,cadastros:entrada.cadastros});
    expect(result.ok).toBe(true);if(result.ok)expect(result.reconciliacao.vinculo.patientId).toBeNull();
  });
  it('checkpoint é revalidado sob a mesma transação que o atualiza',async()=>{
    const db=dbNovo();expect((await ingerirLoteImapCanal(db,lote(1))).ok).toBe(true);
    const exec=db.exec.bind(db);let intercalou=false;let concorrente: ReturnType<typeof ingerirLoteImapCanal> | undefined;
    db.exec=(sql:string)=>{if(!intercalou&&sql==='BEGIN IMMEDIATE'){intercalou=true;db.exec=exec;concorrente=ingerirLoteImapCanal(db,lote(2));}return exec(sql);};
    const antigo=await ingerirLoteImapCanal(db,lote(1,2));db.exec=exec;
    expect(intercalou).toBe(true);expect((await concorrente)?.ok).toBe(false);expect(antigo.ok).toBe(false);
    expect(lerCheckpointImapCanal(db,'imap-revisao','INBOX')?.estadoReconciliacao).toBe('RECONCILIACAO_UIDVALIDITY_NECESSARIA');
  });
  it('falha de marcação IMAP preserva sucesso local e pendência recuperável',async()=>{
    const db=dbNovo();const r=await ingerirLoteImapCanal(db,{...lote(1),marcarProcessadoNoServidorImap:()=>{throw Error('falha sintética de rede');}});
    expect(r).toMatchObject({ok:true,persistida:true,marcacaoRemota:'PENDENTE'});
    expect(lerCheckpointImapCanal(db,'imap-revisao','INBOX')?.lastUid).toBe(1);
    let uids:readonly number[]=[];
    const retry=await ingerirLoteImapCanal(db,{...lote(1),mensagens:[],marcarProcessadoNoServidorImap:(ids)=>{uids=ids;}});
    expect(retry).toMatchObject({ok:true,persistida:true,marcacaoRemota:'CONFIRMADA'});expect(uids).toEqual([1]);
  });
});

describe('segunda rodada independente — limites, rede e legado', () => {
  it.each(['buffer-buffer', 'string-buffer'])('segredos com bytes iguais exigem conta assinada: %s', forma => {
    const contas = [
      { ...CONTAS[0]!, segredo: forma === 'buffer-buffer' ? Buffer.from(SECRET) : SECRET },
      { ...CONTAS[0]!, accountId: 'conta-b', keyId: 'key-b', segredo: Buffer.from(SECRET) },
    ];
    for (const keyId of ['key-a', 'key-b']) {
      expect(receberEnvelopeWebhookCanal(dbNovo(), { ...pedido([mensagem('msg')]), keyId }, { contasConfiguradas: contas, cadastros: [] }).ok).toBe(false);
    }
  });

  it('admite 50 mídias completas, conserva o hash alegado e rejeita bytes locais divergentes', () => {
    const db = dbNovo();
    const eventos = Array.from({ length: 50 }, (_, i) => ({ categoriaEvento: 'MENSAGEM', mensagem: {
      tipoConteudo: 'MEDIA_UNPROCESSED', providerMessageId: `media-${i}`, senderRef: REMETENTE, providerSentAt: AGORA,
      media: { providerMediaId: `arquivo-${i}`, mimeType: 'image/png', sizeBytes: 3, sha256: 'a'.repeat(64) },
    } }));
    const p = pedido(eventos, 'conta-a');
    expect(CanalEnvelopeWebhookBruto.safeParse(JSON.parse(p.bytes.toString())).success).toBe(true);
    const recebido = receberEnvelopeWebhookCanal(db, p, { contasConfiguradas: CONTAS, cadastros: [] });
    expect(recebido.ok).toBe(true); if (!recebido.ok) return;
    expect(recebido.mensagens).toHaveLength(50);
    const mensagemId = recebido.mensagens[0]!.reciboId;
    expect(detalheMensagemCanal(db, acesso(), mensagemId)).toMatchObject({ ok: true, mensagem: { conteudo: { providerSha256: 'a'.repeat(64), contentSha256: null } } });
    expect(registrarLeituraLocalMidiaCanal(db, acesso(), { mensagemId, bytesLocais: Buffer.from('xyz'), mimeTypeVerificado: 'image/png' })).toMatchObject({ ok: false, codigo: 'MIDIA_BYTES_INVALIDOS' });
    expect(receberEnvelopeWebhookCanal(db, pedido(Array.from({ length: LIMITE_NOS_JSON + 1 }, () => null)), { contasConfiguradas: CONTAS, cadastros: [] }).ok).toBe(false);
  });

  it('só confirma marcação IMAP depois de resolver a Promise; rejeição mantém pendência', async () => {
    const db = dbNovo(); let rejeitar!: (err: Error) => void;
    const promessa = new Promise<void>((_, reject) => { rejeitar = reject; });
    const emCurso = ingerirLoteImapCanal(db, { ...lote(1), marcarProcessadoNoServidorImap: () => promessa });
    expect(db.isTransaction).toBe(false);
    expect(db.prepare('SELECT confirmadoEm FROM canal_imap_marcacao').get()!.confirmadoEm).toBeNull();
    rejeitar(Error('rede sintética indisponível'));
    expect(await emCurso).toMatchObject({ ok: true, persistida: true, marcacaoRemota: 'PENDENTE' });
    let chamadas = 0;
    expect(await ingerirLoteImapCanal(db, { ...lote(1), mensagens: [], marcarProcessadoNoServidorImap: async ids => { expect(ids).toEqual([1]); chamadas++; } })).toMatchObject({ ok: true, marcacaoRemota: 'CONFIRMADA' });
    expect(chamadas).toBe(1);
    expect(db.prepare('SELECT confirmadoEm FROM canal_imap_marcacao').get()!.confirmadoEm).toBe(AGORA);
  });

  it('não emite ACK nem marca IMAP sob transação externa que pode sofrer rollback', async () => {
    const db = dbNovo(); garantirSchema(db); let chamou = false;
    db.exec('BEGIN IMMEDIATE');
    try {
      expect(receberEnvelopeWebhookCanal(db, pedido([mensagem('aninhada')]), { contasConfiguradas: CONTAS, cadastros: [] }).ok).toBe(false);
      expect((await ingerirLoteImapCanal(db, { ...lote(1), marcarProcessadoNoServidorImap: () => { chamou = true; } })).ok).toBe(false);
    } finally { db.exec('ROLLBACK'); }
    expect(chamou).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM canal_mensagem').get()!.n).toBe(0);
  });

  it('preserva legado IMAP bruto e impede reutilizar vínculo inseguro em replay e pré-consulta', async () => {
    const db = dbNovo(), a = acesso(); const entrada = lote(1);
    const ack = receberTransporteSintetico(db, { accountId: 'sintetico', canal: 'EMAIL', providerMessageId: 'fonte', senderRef: EMAIL, providerSentAt: AGORA, ingestedAt: AGORA, conteudo: texto('Hoje tenho febre.'), cadastros: entrada.cadastros });
    expect(ack.ok).toBe(true); if (!ack.ok) return;
    const r = await reconciliarMensagemCanalPersistida(db, a, { mensagemId: ack.reciboId, cadastros: entrada.cadastros });
    expect(r.ok).toBe(true); if (!r.ok) return;
    // Fixture reproduz exatamente um registro legado sem remover triggers ou alterar dados existentes.
    db.prepare(`INSERT INTO canal_mensagem SELECT 'legado-imap', accountId, 'legado', canal, senderRef,
      providerSentAt, ingestedAt, payloadSha256, conteudo, vinculoClasse, vinculoPatientId, vinculoMotivo,
      'IMAP_CONTA_LOCAL', 'INBOX' FROM canal_mensagem WHERE mensagemId = ?`).run(ack.reciboId);
    const antigo = JSON.stringify({ ...r.reconciliacao, mensagemId: 'legado-imap' });
    db.prepare('INSERT INTO canal_reconciliacao_clinica VALUES (?, ?, ?)').run('legado-imap', antigo, AGORA);
    expect(detalheMensagemCanal(db, a, 'legado-imap')).toMatchObject({ ok: true, mensagem: { vinculo: { patientId: null } } });
    expect(await reconciliarMensagemCanalPersistida(db, a, { mensagemId: 'legado-imap', cadastros: entrada.cadastros })).toMatchObject({ ok: false, codigo: 'VINCULO_EMAIL_REQUER_REVISAO' });
    expect(lerReconciliacaoMensagemCanal(db, 'legado-imap')).toBeNull();
    const integracao = integrarCanalNaPreConsultaECabecalho(db, { ultimaConsultaConfirmadaEm: null, entradaPreConsulta: {
      hoje: AGORA.slice(0, 10), anterior: null, prazosApac: null, direcoes: null,
      atual: { kind: 'CONFIRMED', snapshotId: 'snap', patientId: 'paciente-revisao', tumorLotId: null, encounterId: 'enc', fatos: [], pendencias: null, tratamento: null, cumulativos: null, contatos: null, apac: null, decisoes: null },
    } });
    expect(integracao.resumosDoPaciente.flatMap(x => x.mensagensOriginaisIds)).not.toContain('legado-imap');
    expect(integracao.filaRevisao.flatMap(x => x.mensagensOriginaisIds)).toContain('legado-imap');
    expect(db.prepare('SELECT reconciliacaoJson FROM canal_reconciliacao_clinica WHERE mensagemId = ?').get('legado-imap')!.reconciliacaoJson).toBe(antigo);
  });

  it('predicado afirmativo elíptico encerra a negação', () => {
    const s = 'Estou sem febre e com sangramento.';
    expect(extrairMencoesClinicasCanal(s)).toContainEqual(expect.objectContaining({ termo: 'sangramento', polaridade: 'AFIRMADO' }));
    expect(alarmes(s).alarmesAtivos.map(x => x.regraId)).toEqual(['sangramento']);
  });
});

describe('revisão independente F2 — fidelidade clínica e PHI',()=>{
  it.each(['Hoje tenho dor e estou sem sangramento.','Hoje tenho sangramento e estou sem febre.'])('não transfere polaridade entre sintomas: %s',s=>{
    const ids=alarmes(s).alarmesAtivos.map(x=>x.regraId);
    expect(ids).not.toContain(s.includes('sem sangramento')?'sangramento':'febre');
  });
  it.each(['37.9','37,9'])('preserva decimal da temperatura: %s',n=>{
    const s=`Estou com temperatura ${n} graus agora.`;
    expect(extrairMencoesClinicasCanal(s)).toContainEqual(expect.objectContaining({termo:'febre',temperaturaDecimos:379}));
    expect(alarmes(s).alarmesAtivos.map(x=>x.regraId)).toContain('febre');
  });
  it.each(['Nao tenho febre, tenho falta de ar agora.','Nao tenho febre e estou com falta de ar agora.','Não estou com febre, apenas com falta de ar.'])('nova oração encerra negação coordenada: %s',s=>{
    const m=extrairMencoesClinicasCanal(s);expect(m).toContainEqual(expect.objectContaining({termo:'febre',polaridade:'NEGADO'}));
    expect(m).toContainEqual(expect.objectContaining({termo:'falta de ar',polaridade:'AFIRMADO'}));
  });
  it.each(['sem febre ou sangramento','não tenho febre nem vômito','nega febre, náusea e diarreia','sem febre e sangramento','nego febre e sangramento'])('mantém listas negativas existentes: %s',s=>{
    const m=extrairMencoesClinicasCanal(s);expect(m.length).toBeGreaterThan(1);expect(m.every(x=>x.polaridade==='NEGADO')).toBe(true);
  });
  it('reconstrói a evidência real em vez de aceitar trecho e temperatura inventados pela LLM',()=>{
    const s='Hoje tenho calafrio.';
    const r=classificarRelatoCanal({textoOriginal:s,origemCanal:'WHATSAPP_SERVICO',providerSentAt:AGORA,ingestedAt:AGORA,vinculado:true,propostaLlm:{textoDesidentificadoEnviado:s,phiEgressPassou:true,saidaBrutaLlm:{categoria:'SINTOMA_INTERCORRENCIA',autorRelato:'PACIENTE',momentoClinicoRelatado:{temporalidade:'ATUAL',trechoTemporal:'hoje'},mencoes:[{termo:'calafrio',polaridade:'AFIRMADO',temporalidade:'ATUAL',trechoOriginal:'Hoje tenho sangramento intenso.',temperaturaDecimos:400}]}}});
    expect(r.mencoes.every(m=>s.includes(m.trechoOriginal))).toBe(true);
    expect(r.mencoes.every(m=>m.temperaturaDecimos===null)).toBe(true);
    expect(alarmes(s,r.mencoes).alarmesAtivos).toEqual([]);
  });
  it.each([false,true])('texto livre com nome de terceiro nunca sai para o classificador: cadastrado=%s',async conhecido=>{
    const db=dbNovo();const s='Meu nome e Aurora Inventada Exemplo e hoje tenho sangramento.';
    const cadastros=conhecido?CADASTROS:[];
    const ack=receberTransporteSintetico(db,{accountId:'conta-a',canal:'WHATSAPP_SERVICO',providerMessageId:'phi-1',senderRef:REMETENTE,providerSentAt:AGORA,ingestedAt:AGORA,conteudo:texto(s),cadastros});expect(ack.ok).toBe(true);if(!ack.ok)return;
    const enviados:string[]=[];
    const r=await reconciliarMensagemCanalPersistida(db,acesso(),{mensagemId:ack.reciboId,cadastros,classificadorLlm:({textoDesidentificado})=>{enviados.push(textoDesidentificado);return {categoria:'SINTOMA_INTERCORRENCIA',autorRelato:'PACIENTE',momentoClinicoRelatado:{temporalidade:'ATUAL',trechoTemporal:'hoje'},mencoes:[]};}});
    expect(r.ok).toBe(true);expect(enviados.join(' ')).not.toContain('Aurora');expect(enviados.join(' ')).not.toContain('Meu nome');
    if(!conhecido)expect(enviados).toEqual([]);
  });
});

it('versão de resposta confirmada é imutável; nova versão exige nova confirmação',()=>{
  const db=dbNovo(),a=acesso(),contexto={patientId:'paciente-revisao',encounterId:'enc-revisao',tumorLotId:null,revisaoContexto:'r1'};
  const ack=receberTransporteSintetico(db,{accountId:'conta-a',canal:'WHATSAPP_SERVICO',providerMessageId:'resp-origem',senderRef:REMETENTE,providerSentAt:AGORA,ingestedAt:AGORA,conteudo:texto('Quando será meu retorno?'),cadastros:CADASTROS});expect(ack.ok).toBe(true);if(!ack.ok)return;
  const base={respostaId:'resposta-revisao',versao:1,mensagemOrigemId:ack.reciboId,contexto,tipoResposta:'RESPOSTA_LIVRE_MEDICA' as const,texto:'Retorno na quinta-feira.'};
  const p=prepararRascunhoRespostaCanal(db,a,base);expect(p.ok).toBe(true);if(!p.ok)return;
  expect(registrarConsentimentoCanal(db,a,{contatoId:REMETENTE,patientId:contexto.patientId,referenciaTermo:'termo-sintetico',versaoTermo:'1.0.0',finalidade:['COMUNICACAO_CLINICA'],origem:'PRESENCIAL_CONSULTORIO'}).ok).toBe(true);
  expect(confirmarRespostaCanalPeloMedico(db,a,{respostaId:base.respostaId,versao:1,comprovanteExibicao:{destinatario:REMETENTE,conteudoSha256:p.rascunho.conteudoSha256,contexto}}).ok).toBe(true);
  expect(prepararRascunhoRespostaCanal(db,a,base)).toMatchObject({ok:true,rascunho:{confirmadoPeloMedico:true}});
  expect(prepararRascunhoRespostaCanal(db,a,{...base,texto:'Retorno na sexta-feira.'}).ok).toBe(false);
  expect(prepararRascunhoRespostaCanal(db,a,{...base,versao:2,texto:'Retorno na sexta-feira.'})).toMatchObject({ok:true,rascunho:{confirmadoPeloMedico:false}});
  const intent={verbo:'ENVIAR_WHATSAPP' as const,objeto:{tipo:'MENSAGEM_CANAL',id:base.respostaId,versao:1},escopo:{patientId:contexto.patientId,encounterId:contexto.encounterId},destino:REMETENTE,idempotencyKey:'revisao-envio'};
  expect(autorizarSaida(db,intent).ok).toBe(false);
  expect(autorizarSaida(db,{...intent,objeto:{...intent.objeto,versao:2}}).ok).toBe(false);
});
