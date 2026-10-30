import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { criarGerenciadorSessao } from '../../../src/server/sessao.js';
import { operarConsultorio } from '../../../src/server/consultorioMedico.js';
import { operarDocumental } from '../../../src/server/importacaoDocumental.js';
import { operarConversa } from '../../../src/server/conversaOncoassist.js';
import { OperacaoAgendaResposta } from '../../../src/contracts/api/consultorioMedico.js';
import type { ServidorDeps } from '../../../src/server/rotas.js';
import { pdfDigital } from '../../f0-fecha/fixtures/colon-e2e.js';
import { criarBackup } from '../../../scripts/backup.mjs';
import { restaurarBackup } from '../../../scripts/backup-restore.mjs';
const require = createRequire(import.meta.url);
const { montarPacoteDocumental } = require('../../../integrations/pdfforge/exportar-pacote.cjs');
it('backup restaura cadastro, agenda, pré-consulta, dieta, conversa, preferências e PDF recebidos pelos serviços reais', async () => {
  const base = realpathSync(tmpdir()), dir = mkdtempSync(join(base, 'SINTETICO-m123-backup-'));
  if (dirname(dir) !== base) throw Error('TEMP_FORA_RAIZ');
  const caminho = join(dir, 'ledger.sqlite'), anexos = join(dir, 'anexos'), backups = join(dir, 'backups');
  mkdirSync(anexos); mkdirSync(backups);
  const db = abrirLedger(caminho), agora = () => '2026-10-26T12:00:00.000Z';
  const sessoes = criarGerenciadorSessao({ medicoId: 'MEDICO-SINTETICO', crm: 'CRM-SINTETICO', senha: 'senha-sintetica-teste', duracaoMs: 3600000, agora });
  const token = sessoes.login('senha-sintetica-teste')!.token;
  const deps = { db, sessoes, agora, log: () => {} } as unknown as ServidorDeps;
  try {
    const r = operarConsultorio(deps, token, '/medico/paciente/cadastrar', { operationId: 'cadastro-backup', paciente: {
      nome:'Paciente SINTETICO',identificadores:[],nascimento:null,sexoCadastral:'NAO_INFORMADO' },data:'2026-10-26',horario:'09:00' })!;
    expect(r.status).toBe(201);
    const {contexto}=OperacaoAgendaResposta.parse(r.body);sessoes.selecionarConsulta(token,contexto);
    expect(operarConsultorio(deps,token,'/medico/preconsulta/salvar',{contexto,operationId:'pre-backup',expectedVersion:0,entrada:{queixa:'SINTETICO',historia:'',antecedentes:'',medicamentos:'',alergias:'',contextoPessoal:'',observacoes:'',pesoKg:null,alturaCm:null,origemPeso:'NAO_INFORMADO'}})!.status).toBe(201);
    expect(operarConsultorio(deps,token,'/medico/nutricao/salvar',{contexto,operationId:'dieta-backup',expectedVersion:0,texto:'Orientação SINTETICA'})!.status).toBe(201);
    expect((await operarConversa(deps,token,'/consulta/assistente/configurar',{...contexto,expectedRevision:0,preferencias:{formato:'TOPICOS',extensao:'BREVE',incluirBiblioteca:false},modelo:null})).status).toBe(200);
    expect((await operarConversa(deps,token,'/consulta/assistente/responder',{...contexto,operationId:'conversa-backup',pergunta:'Briefing SINTETICO',fontesIds:[],modo:'BRIEFING'})).status).toBe(200);
    const pacote=montarPacoteDocumental({original:{name:'SINTETICO.pdf',bytes:pdfDigital(['Documento SINTETICO'])},autor:'Autor SINTETICO'});
    expect((await operarDocumental(deps,token,'/consulta/documental/importar',{contexto,tipoFonte:'medical_note',pacote})).status).toBe(201);
    const antes=db.prepare('SELECT * FROM draft_envelope ORDER BY draftId').all();
    const eventosAntes=db.prepare('SELECT * FROM clinical_event ORDER BY eventId').all();
    const operacoesAntes=db.prepare('SELECT * FROM operation ORDER BY operationId').all();
    const arquivo=await criarBackup({dbPath:caminho,filesRoot:anexos,destino:backups,nome:'m123',senha:'senha-sintetica-backup'});
    const restaurado=restaurarBackup({arquivo,destino:join(dir,'restaurado'),senha:'senha-sintetica-backup'});
    const outro=abrirLedger(restaurado.database);
    try {
      expect(outro.prepare('SELECT * FROM draft_envelope ORDER BY draftId').all()).toEqual(antes);
      expect(outro.prepare('SELECT * FROM clinical_event ORDER BY eventId').all()).toEqual(eventosAntes);
      expect(outro.prepare('SELECT * FROM operation ORDER BY operationId').all()).toEqual(operacoesAntes);
    }
    finally { outro.close(); }
  } finally { db.close(); rmSync(dir,{recursive:true,force:true}); }
});
