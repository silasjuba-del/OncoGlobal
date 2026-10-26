import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer as criarHttp } from 'node:http';
import { createServer as criarSocket } from 'node:net';
import { mkdtempSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as criarVite } from 'vite';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const { montarPacoteDocumental } = require('../../../integrations/pdfforge/exportar-pacote.cjs');
const PACIENTE = 'Paciente SINTETICO M123';
const TEXTO_FONTE = 'SINTETICO: nega febre; achado pulmonar incerto, A CONFERIR.';
const TEXTO_NUTRICAO = 'Orientacao SINTETICA escrita e revisada pelo medico para este encontro.';
const TEXTO_ORIENTACAO_ASSINADA = TEXTO_NUTRICAO + ' Ajuste medico SINTETICO na Flash.';
const PERGUNTA_MODELO = 'Organize o trecho SINTETICO e mantenha negacao e incerteza.';
const TEXTO_PROPOSTA = 'Documento SINTETICO revisado pelo medico a partir da proposta citada.';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const arquivoPacote = pacote => ({ name: 'fonte-SINTETICA.oncoglobal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pacote)) });

async function portaLivre() {
  const server = criarSocket();
  await new Promise((ok, falha) => { server.once('error', falha); server.listen(0, '127.0.0.1', ok); });
  const porta = server.address().port;
  await new Promise(ok => server.close(ok));
  return porta;
}
function diferido() {
  let resolver;
  const promessa = new Promise(ok => { resolver = ok; });
  return { promessa, resolver };
}
async function prazo(promessa, nome) {
  let timer;
  try { return await Promise.race([promessa, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(nome)), 30_000); })]); }
  finally { clearTimeout(timer); }
}

export async function executarJornadaMedicoM123() {
  const evidencias = mkdtempSync(join(tmpdir(), 'medico-m123-evidence-'));
  const dir = mkdtempSync(join(tmpdir(), 'e2e-b2-f1-'));
  const log = value => {
    const linha = JSON.stringify({ instante: new Date().toISOString(), ...value });
    appendFileSync(join(evidencias, 'jornada.log'), linha + '\n'); console.log(linha);
  };
  log({ etapa: 'inicio', evidencias, sqliteDir: dir });
  process.env.VITE_ONCOGLOBAL_PERFIL = 'MEDICO';
  process.env.ONCOGLOBAL_API_PORT = String(await portaLivre());
  const uiPort = await portaLivre();
  let vite, demo, browser, page, modelo;
  const liberarModelo = diferido(), modeloChegou = diferido();
  let chamadasModelo = 0;
  let etapa = 'inicializacao';
  const errosPagina = [], requisicoesExternas = [];
  try {
    modelo = criarHttp(async (req, res) => {
      try {
        assert.equal(req.url, '/v1/chat/completions');
        let bruto = ''; for await (const b of req) { bruto += b; if (bruto.length > 200000) throw Error('MODELO_ENTRADA_EXCESSIVA'); }
        const pedido = JSON.parse(bruto), contexto = JSON.parse(pedido.messages.at(-1).content);
        const fonte = contexto.fontes.find(f => f.tipo === 'DOCUMENTO' && f.texto.includes(TEXTO_FONTE));
        assert.ok(fonte, 'modelo recebe fonte selecionada do paciente, não dado inventado');
        chamadasModelo++;
        const saida = JSON.stringify({ texto: `Proposta SINTETICA baseada no documento: ${TEXTO_FONTE}`, citacoes: [{ fonteId: fonte.id, trecho: TEXTO_FONTE }] });
        const meio = saida.indexOf('citacoes') - 2;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: saida.slice(0, meio) } }] })}\n\n`);
        if (chamadasModelo === 1) { modeloChegou.resolver(); await liberarModelo.promessa; }
        if (res.destroyed) return;
        res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: saida.slice(meio) } }] })}\n\ndata: [DONE]\n\n`);
      } catch (e) { log({ modeloErro: String(e) }); if (!res.headersSent) res.writeHead(500); res.end(); }
    });
    await new Promise((ok, falha) => { modelo.once('error', falha); modelo.listen(0, '127.0.0.1', ok); });
    const endpointModelo = `http://127.0.0.1:${modelo.address().port}/v1`;
    vite = await criarVite({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), cacheDir: join(evidencias, 'vite-cache'),
      server: { host: '127.0.0.1', port: uiPort, strictPort: true } });
    await vite.listen();
    const fixture = await vite.ssrLoadModule('/tests/f1/s12/fixtures/servidor-demo-b2.ts');
    demo = await fixture.bootServidorDemoB2(dir);
    const { pdfDigital } = await vite.ssrLoadModule('/tests/f0-fecha/fixtures/colon-e2e.ts');
    const { listarEventos } = await vite.ssrLoadModule('/src/kernel/ledger/ledger.ts');
    const pacote = montarPacoteDocumental({ autor: 'Autor SINTETICO M123',
      original: { name: 'original-SINTETICO.pdf', bytes: pdfDigital(['Documento SINTETICO - data clinica 2026-10-09', TEXTO_FONTE]) },
      derivado: { name: 'derivado-SINTETICO.pdf', bytes: pdfDigital(['Derivado SINTETICO com anotacao visual; original preservado.']), descricao: 'Derivado SINTETICO para comparacao, sem substituir o original.' },
      paginasExtraidas: [{ pagina: 1, texto: 'Texto auxiliar externo SINTETICO, nao e fato confirmado.' }],
      anotacoes: [{ id: 'nota-sintetica', pagina: 1, texto: 'Anotacao SINTETICA para conferencia.', autorTipo: 'USUARIO', autor: 'Autor SINTETICO M123', criadoEm: demo.manifesto.agora }],
    }, { pacoteId: 'pacote-m123-sintetico', agora: demo.manifesto.agora });
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    page.setDefaultTimeout(30_000);
    await page.clock.setFixedTime(new Date(demo.manifesto.agora));
    page.on('pageerror', e => errosPagina.push(e.message));
    page.on('request', r => { const u = new URL(r.url()); if (['http:', 'https:'].includes(u.protocol) && u.hostname !== '127.0.0.1') requisicoesExternas.push(u.origin); });
    const nav = () => page.getByRole('navigation', { name: 'Áreas clínicas', exact: true });
    const navegar = nome => nav().getByRole('button', { name: nome, exact: true }).click();
    const salvarFlash = async () => {
      const pendente = page.waitForResponse(r => r.url().endsWith('/consulta/flash/rascunho'));
      await page.getByRole('button', { name: 'SALVAR RASCUNHO', exact: true }).click();
      const resposta = await pendente;
      assert.equal(resposta.status(), 201, `rascunho Flash deve ser persistido, resposta: ${JSON.stringify(await resposta.json())}`);
      await page.getByText('Rascunho salvo; sem assinatura.', { exact: true }).waitFor();
    };
    const entrar = async () => {
      await page.goto(`http://127.0.0.1:${uiPort}/oncoassist.html`);
      await page.getByLabel('Senha do servidor').fill(demo.manifesto.senhaDemo);
      const agendaHttp = page.waitForResponse(r => r.url().endsWith('/medico/agenda'));
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      assert.equal((await agendaHttp).status(), 200, 'agenda médica deve atravessar o proxy e o backend real');
      await page.getByRole('region', { name: 'Agenda médica', exact: true }).waitFor();
    };
    await entrar();
    for (const nome of ['Salão', 'Canal', 'APAC', 'Estatísticas', 'Estudos clínicos']) assert.equal(await nav().getByRole('button', { name: nome, exact: true }).count(), 0, `${nome} fora da navegação médica`);
    etapa = 'cadastro';
    await page.getByLabel('Cadastrar novo paciente', { exact: true }).check();
    await page.getByLabel('Nome do paciente', { exact: true }).fill(PACIENTE);
    await page.getByLabel('Nascimento', { exact: true }).fill('1970-01-01');
    await page.getByRole('combobox', { name: /^Sexo cadastral/ }).selectOption('F');
    await page.getByLabel('Identificador (opcional)', { exact: true }).fill('PRONTUARIO-SINTETICO-M123');
    const cadastroResposta = page.waitForResponse(r => r.url().endsWith('/medico/paciente/cadastrar'));
    await page.getByRole('button', { name: 'Cadastrar e agendar', exact: true }).click();
    const cadastro = await cadastroResposta; assert.equal(cadastro.status(), 201);
    const contexto = (await cadastro.json()).contexto;
    const eventos = () => listarEventos(demo.app.db, contexto.patientId);
    const assinados = () => eventos().filter(e => e.tipo === 'DOCUMENTO' && e.revisao === 'ASSINADO');
    assert.equal(eventos().filter(e => e.tipo === 'Paciente').length, 1);
    assert.equal(eventos().filter(e => e.tipo === 'AgendaEntry').length, 1);
    await page.getByRole('button', { name: `Abrir consulta de ${PACIENTE}`, exact: true }).click();
    await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
    etapa = 'preconsulta'; await navegar('Pré-consulta');
    await page.getByLabel('Queixa principal', { exact: true }).fill('Queixa SINTETICA para consulta.');
    await page.getByLabel('História e sintomas relatados', { exact: true }).fill(TEXTO_FONTE);
    await page.getByLabel('Alergias relatadas', { exact: true }).fill('Informacao SINTETICA a conferir, sem presumir negativa.');
    await page.getByRole('button', { name: 'Salvar pré-consulta', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar relato revisado na evolução', exact: true }).click();
    await page.getByRole('button', { name: 'Relato já registrado na evolução', exact: true }).waitFor();
    assert.equal(assinados().length, 0);
    log({ etapa, cadastroAtomico: true, preConsultaRevisadaSemAssinatura: true });

    etapa = 'documental'; await navegar('Documentos e PDF');
    const importar = async valor => {
      await page.getByLabel('Pacote documental PDFForge', { exact: true }).setInputFiles(arquivoPacote(valor));
      const resposta = page.waitForResponse(r => r.url().endsWith('/consulta/documental/importar'));
      await page.getByRole('button', { name: 'Importar pacote documental', exact: true }).click();
      const r = await resposta; return { status: r.status(), body: await r.json() };
    };
    const corrompido = structuredClone(pacote), bytesCorrompidos = Buffer.from(pacote.original.bytesBase64, 'base64');
    bytesCorrompidos[bytesCorrompidos.length - 1] ^= 1;
    corrompido.original.bytesBase64 = bytesCorrompidos.toString('base64');
    const antesCorrompido = sha(eventos());
    const invalido = await importar(corrompido);
    assert.equal(invalido.status, 400); assert.equal(invalido.body.codigo, 'DOCUMENTO_HASH_DIVERGENTE'); assert.equal(sha(eventos()), antesCorrompido);
    const recebido = await importar(pacote); assert.equal(recebido.status, 201);
    const replay = await importar(pacote); assert.equal(replay.status, 200); assert.equal(replay.body.codigo, 'REPLAY');
    assert.equal(recebido.body.documento.draftId, replay.body.documento.draftId);
    const conflitante = structuredClone(pacote); conflitante.autor = 'Outro autor declarado SINTETICO';
    const antesConflito = sha(eventos());
    const conflito = await importar(conflitante);
    assert.equal(conflito.status, 409); assert.equal(conflito.body.codigo, 'PACOTE_ID_CONFLITANTE');
    assert.equal(sha(eventos()), antesConflito);
    const draftId = recebido.body.documento.draftId, sourceId = recebido.body.documento.sourceId;
    const aberturaHttp = page.waitForResponse(r => r.url().endsWith('/consulta/documental/abrir'));
    await page.getByRole('combobox', { name: /^Documento 1/ }).selectOption(pacote.pacoteId);
    const abertura = await aberturaHttp; assert.equal(abertura.status(), 200);
    const aberto = await abertura.json();
    assert.equal(aberto.pacote.original.sha256, pacote.original.sha256);
    assert.equal(aberto.pacote.original.bytesBase64, pacote.original.bytesBase64);
    assert.equal(aberto.pacote.autor, pacote.autor, 'replay divergente não altera autoria recebida');
    assert.equal(aberto.pacote.derivado.sha256, pacote.derivado.sha256);
    const documento = page.getByRole('article', { name: 'Documento original-SINTETICO.pdf', exact: true });
    await documento.getByRole('img', { name: 'original-SINTETICO.pdf — página 1', exact: true }).waitFor();
    const conferirDownload = async (nome, esperado) => {
      await page.waitForFunction(async ({ nome, esperado }) => {
        const link = [...document.querySelectorAll('a')].find(a => a.textContent === nome);
        if (!link?.href.startsWith('blob:')) return false;
        try {
          const bytes = await (await fetch(link.href)).arrayBuffer();
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
          return hash === esperado;
        } catch { return false; }
      }, { nome, esperado });
    };
    await conferirDownload('Baixar original', pacote.original.sha256);
    await documento.getByRole('button', { name: 'Derivado editado', exact: true }).click();
    await documento.getByRole('img', { name: 'derivado-SINTETICO.pdf — página 1', exact: true }).waitFor();
    await conferirDownload('Baixar derivado', pacote.derivado.sha256);
    await documento.getByRole('button', { name: 'Original preservado', exact: true }).click();
    await documento.getByRole('img', { name: 'original-SINTETICO.pdf — página 1', exact: true }).waitFor();
    await conferirDownload('Baixar original', pacote.original.sha256);
    await documento.getByText('Anotações e texto enviados pelo PDFForge', { exact: true }).click();
    assert.ok((await documento.innerText()).includes('Anotacao SINTETICA para conferencia.'));
    await documento.getByRole('button', { name: 'Revisar fonte na consulta', exact: true }).click();
    const grupoRevisao = page.getByRole('button', { name: /Revisão de fontes & Alertas RADS/ });
    if (await grupoRevisao.getAttribute('aria-expanded') === 'false') await grupoRevisao.click();
    await page.getByLabel('Trecho sem vínculo', { exact: true }).selectOption(draftId);
    const vinculo = page.waitForResponse(r => r.url().endsWith('/consulta/rascunho/revisar'));
    await page.getByRole('button', { name: `Confirmar vínculo deste trecho com ${PACIENTE} · ${contexto.patientId}`, exact: true }).click();
    assert.equal((await vinculo).status(), 200);
    await page.getByRole('button', { name: /^Confirmar vínculo deste trecho/ }).waitFor({ state: 'detached' });
    await page.getByLabel('Fonte para revisão', { exact: true }).selectOption(draftId);
    const fonteOriginal = page.getByRole('region', { name: 'Fonte original vinculada', exact: true });
    await fonteOriginal.getByText(`Fonte ${sourceId}`, { exact: true }).waitFor();
    assert.ok((await fonteOriginal.innerText()).includes(TEXTO_FONTE));
    await page.getByRole('checkbox', { name: 'Incluir texto original deste trecho na evolução', exact: true }).check();
    await page.getByRole('button', { name: 'Preparar revisão', exact: true }).click();
    await page.getByRole('region', { name: 'Conteúdo preparado para revisão', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirmar revisão exibida', exact: true }).click();
    await page.getByText('Revisão registrada. Candidatos incertos conservam sua pendência.', { exact: true }).waitFor();
    assert.equal(assinados().length, 0);
    log({ etapa, hashAdulteradoRecusado: true, replayUnico: true, replayMetadadoDivergenteRecusado: true, originalDerivadoConferidosPorHash: true, fonte: sourceId, originalRevisado: true });

    etapa = 'oncoassist'; await navegar('OncoAssist');
    const briefingHttp = page.waitForResponse(r => r.url().endsWith('/consulta/assistente/responder-stream'));
    await page.getByRole('button', { name: 'Preparar briefing documental', exact: true }).click();
    const briefingResposta = await briefingHttp;
    assert.equal(briefingResposta.status(), 200, 'briefing deve aceitar o instante válido do servidor e publicar resposta contextual');
    const proposta = page.getByRole('region', { name: 'Proposta do OncoAssist', exact: true });
    await proposta.waitFor(); assert.ok((await proposta.innerText()).includes('Briefing documental determinístico'));
    assert.ok((await page.getByLabel('Texto da proposta para revisão').inputValue()).includes(TEXTO_FONTE));
    await proposta.getByRole('button', { name: 'Conferir evidência', exact: true }).last().click();
    const evidenciaAberta = page.getByRole('region', { name: 'Evidência clínica aberta', exact: true });
    await evidenciaAberta.waitFor();
    assert.ok((await evidenciaAberta.innerText()).includes(TEXTO_FONTE));
    await page.getByRole('button', { name: 'Fechar evidência', exact: true }).click();
    await page.getByText('Modelo local e preferências', { exact: true }).click();
    await page.getByLabel('Endpoint local', { exact: true }).fill(endpointModelo);
    await page.getByLabel('Modelo local', { exact: true }).fill('modelo-SINTETICO-M123');
    await page.getByRole('button', { name: 'Salvar preferências do assistente', exact: true }).click();
    await page.getByText('Modelo configurado: modelo-SINTETICO-M123 · execução local', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: /^Pergunta ao OncoAssist/ }).fill(PERGUNTA_MODELO);
    await page.getByRole('button', { name: 'Perguntar ao modelo local', exact: true }).click();
    await prazo(modeloChegou.promessa, 'MODELO_NAO_RECEBEU_PERGUNTA');
    await page.getByRole('region', { name: 'Resposta parcial não validada', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Preparar documento com texto revisado', exact: true }).count(), 0, 'parcial não tem aceite');
    await page.getByRole('button', { name: 'Cancelar resposta', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Operação cancelada' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: /^Pergunta ao OncoAssist/ }).inputValue(), PERGUNTA_MODELO);
    assert.equal(await proposta.count(), 0, 'cancelamento não publica proposta parcial');
    assert.equal(assinados().length, 0);
    liberarModelo.resolver();
    await page.getByRole('textbox', { name: /^Pergunta ao OncoAssist/ }).fill('');
    await navegar('Agenda e pacientes');
    await page.getByRole('region', { name: 'Agenda médica', exact: true }).waitFor();
    await page.getByRole('button', { name: `Abrir consulta de ${PACIENTE}`, exact: true }).click();
    await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
    await navegar('OncoAssist');
    const resumoHistoricoCancelado = page.getByText('Histórico deste encontro (2 turnos recentes)', { exact: true });
    await resumoHistoricoCancelado.click();
    const turnoCancelado = resumoHistoricoCancelado.locator('..').locator('article').filter({ hasText: 'CANCELADA' });
    await turnoCancelado.waitFor();
    await turnoCancelado.getByRole('button', { name: 'Reutilizar pergunta como rascunho', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: /^Pergunta ao OncoAssist/ }).inputValue(), PERGUNTA_MODELO);
    assert.equal(chamadasModelo, 1, 'reutilizar pergunta não dispara provedor');
    await page.getByRole('button', { name: 'Perguntar ao modelo local', exact: true }).click();
    await proposta.waitFor();
    assert.equal(chamadasModelo, 2);
    assert.ok((await proposta.innerText()).includes('Proposta do modelo local modelo-SINTETICO-M123'));
    log({ etapa: 'oncoassist-modelo', briefingComFonte: true, evidenciaAbertaNaMesmaTela: true, upstreamSSELocalSintetico: true, parcialSemAceite: true, cancelamentoDuravel: true, chamadasModelo });
    await page.getByRole('textbox', { name: /^Texto da proposta para revisão/ }).fill(TEXTO_PROPOSTA);
    await page.getByRole('button', { name: 'Preparar documento com texto revisado', exact: true }).click();
    await page.getByRole('region', { name: 'Conteúdo da Consulta Flash', exact: true }).waitFor();
    await page.getByText('Encaminhamentos, laudos e orientações', { exact: true }).click();
    assert.equal(await page.getByLabel('Conteúdo do documento 1', { exact: true }).inputValue(), TEXTO_PROPOSTA);
    await salvarFlash();
    assert.equal(assinados().length, 0);
    log({ etapa, briefingComFonte: true, upstreamSSEReal: true, modeloChamadas: chamadasModelo, parcialNaoAceitavel: true, propostaEmRascunho: true });

    etapa = 'nutricao_assinatura'; await navegar('Orientações dietéticas');
    const orientacao = page.getByRole('textbox', { name: /^Orientação dietética para revisão/ });
    await orientacao.fill(TEXTO_NUTRICAO);
    await navegar('Consulta');
    const protegerEdicao = page.getByRole('dialog', { name: 'Alterações não salvas', exact: true });
    await protegerEdicao.waitFor();
    assert.ok((await protegerEdicao.innerText()).includes('orientação dietética'));
    await protegerEdicao.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    assert.equal(await orientacao.inputValue(), TEXTO_NUTRICAO, 'continuar editando mantém orientação não salva');
    await page.route('**/medico/nutricao/salvar', route => route.abort('connectionfailed'), { times: 1 });
    await page.getByRole('button', { name: 'Salvar orientação dietética', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'O texto foi preservado' }).waitFor();
    assert.equal(await orientacao.inputValue(), TEXTO_NUTRICAO);
    await page.getByRole('button', { name: 'Salvar orientação dietética', exact: true }).click();
    await page.getByText('Orientação salva como rascunho, sem assinatura ou entrega ao paciente.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Usar orientação na consulta', exact: true }).click();
    const flash = page.getByRole('region', { name: 'Conteúdo da Consulta Flash', exact: true });
    await flash.waitFor();
    await page.getByText('Encaminhamentos, laudos e orientações', { exact: true }).click();
    assert.equal(await flash.getByRole('textbox', { name: 'Conteúdo do documento 2', exact: true }).inputValue(), TEXTO_NUTRICAO);
    assert.equal(await flash.getByRole('textbox', { name: 'Conteúdo do documento 1', exact: true }).inputValue(), TEXTO_PROPOSTA);
    await flash.getByRole('textbox', { name: 'Conteúdo do documento 2', exact: true }).fill(TEXTO_ORIENTACAO_ASSINADA);
    await salvarFlash();
    await navegar('OncoAssist');
    await page.getByRole('region', { name: 'Conversa com OncoAssist', exact: true }).waitFor();
    await navegar('Consulta');
    await page.getByRole('button', { name: 'Consulta Flash', exact: true }).click();
    await page.getByText('Encaminhamentos, laudos e orientações', { exact: true }).click();
    assert.equal(await flash.getByRole('textbox', { name: 'Conteúdo do documento 2', exact: true }).inputValue(), TEXTO_ORIENTACAO_ASSINADA, 'proposta consumida não sobrescreve edição médica salva');
    await page.getByLabel('Prazo do retorno em dias', { exact: true }).fill('14');
    await page.getByRole('button', { name: 'Revisar documentos para assinatura', exact: true }).click();
    const previa = page.getByRole('region', { name: 'Conteúdo para assinatura', exact: true });
    await previa.waitFor();
    assert.equal(assinados().length, 0, 'preparar prévia nunca assina');
    const previaTexto = await previa.innerText();
    for (const trecho of [TEXTO_ORIENTACAO_ASSINADA, TEXTO_PROPOSTA, TEXTO_FONTE]) assert.ok(previaTexto.includes(trecho), `prévia contém ${trecho}`);
    assert.equal(previaTexto.includes('Texto auxiliar externo SINTETICO, nao e fato confirmado.'), false, 'texto auxiliar do pacote não é promovido a fato/documento clínico');
    await previa.getByRole('button', { name: 'Confirmar e assinar conteúdo exibido', exact: true }).click();
    const historico = page.getByRole('region', { name: 'Histórico de documentos assinados', exact: true });
    await historico.getByText(TEXTO_ORIENTACAO_ASSINADA, { exact: false }).first().waitFor();
    const ids = assinados().map(e => e.eventId).sort(), hashDocumentos = sha(assinados());
    assert.ok(ids.length > 0 && ids.every(id => typeof id === 'string' && id.length)); assert.equal(new Set(ids).size, ids.length);
    log({ etapa, falhaRedePreservouOrientacao: true, documentos: ids.length, assinaturaExplicita: true });

    etapa = 'retorno';
    const agendaRetornoHttp = page.waitForResponse(r => r.url().endsWith('/medico/agenda'));
    await navegar('Agenda e pacientes');
    const agendaRetorno = await agendaRetornoHttp;
    assert.equal(agendaRetorno.status(), 200);
    assert.ok((await agendaRetorno.json()).retornos.some(t => t.patientId === contexto.patientId), 'retorno médico sem pedido de exame também deve aparecer para agendamento explícito');
    const retornos = page.getByRole('region', { name: 'Retornos a agendar', exact: true });
    await retornos.waitFor();
    const retorno = retornos.locator('li').filter({ hasText: PACIENTE });
    await retorno.getByRole('button', { name: 'Preparar agendamento do retorno', exact: true }).click();
    const dataRetorno = await page.getByLabel('Data do encontro', { exact: true }).inputValue();
    const esperadoRetorno = new Date(demo.manifesto.agora); esperadoRetorno.setUTCDate(esperadoRetorno.getUTCDate() + 14);
    assert.equal(dataRetorno, esperadoRetorno.toISOString().slice(0, 10), 'agenda preserva os 14 dias definidos pelo médico no cenário sintético');
    const agendamento = page.waitForResponse(r => r.url().endsWith('/medico/agenda/agendar'));
    await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
    assert.equal((await agendamento).status(), 201);
    assert.equal(eventos().filter(e => e.tipo === 'AgendaEntry').length, 2);
    await page.screenshot({ path: join(evidencias, 'agenda-retorno.png'), fullPage: true });
    await demo.app.close(); demo = await fixture.bootServidorDemoB2(dir);
    etapa = 'reabertura'; await entrar();
    await page.getByRole('button', { name: `Abrir consulta de ${PACIENTE}`, exact: true }).click();
    await historico.getByText(TEXTO_ORIENTACAO_ASSINADA, { exact: false }).first().waitFor();
    assert.deepEqual(assinados().map(e => e.eventId).sort(), ids); assert.equal(sha(assinados()), hashDocumentos);
    await navegar('Pré-consulta'); assert.equal(await page.getByLabel('História e sintomas relatados', { exact: true }).inputValue(), TEXTO_FONTE);
    await navegar('Orientações dietéticas'); assert.equal(await orientacao.inputValue(), TEXTO_NUTRICAO);
    await navegar('OncoAssist'); await page.getByText(/Histórico deste encontro \(3 turnos recentes\)/).waitFor();
    await navegar('Documentos e PDF'); await page.getByRole('combobox', { name: /^Documento 1/ }).selectOption(pacote.pacoteId);
    await documento.locator('canvas').waitFor();
    await documento.getByText('Texto extraído localmente do original', { exact: true }).click();
    assert.ok((await documento.innerText()).includes(TEXTO_FONTE));
    await navegar('Agenda e pacientes'); await page.getByLabel('Fim da agenda', { exact: true }).fill(dataRetorno);
    await page.getByRole('region', { name: 'Agenda médica', exact: true }).locator('li').filter({ hasText: `${dataRetorno} ·` }).filter({ hasText: PACIENTE }).waitFor();
    assert.deepEqual(errosPagina, []); assert.deepEqual(requisicoesExternas, []);
    const resultado = { codigo: 'M123_E2E_APROVADO', contexto, pacoteId: pacote.pacoteId, sourceId, documentos: ids.length,
      hashDocumentos, upstreamChamadas: chamadasModelo, dataRetorno, cancelamentoDuravel: true, navegacaoProtegida: true, originalReaberto: true, derivadoConferido: true, metadadoDivergenteRecusado: true, preConsultaReaberta: true,
      orientacaoReaberta: true, edicaoFlashPreservada: true, conversaReaberta: true, assinaturaExplicita: true, modulosAdiadosForaNavegacao: true };
    writeFileSync(join(evidencias, 'resumo.json'), JSON.stringify(resultado, null, 2));
    log({ etapa: 'concluida', evidencias, ...resultado });
    return resultado;
  } catch (erro) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: join(evidencias, 'falha.png'), fullPage: true }).catch(() => {});
      writeFileSync(join(evidencias, 'falha-ui.txt'), await page.locator('body').innerText().catch(() => 'UI indisponível'));
    }
    log({ etapa, falha: String(erro), evidencias }); throw erro;
  } finally {
    liberarModelo.resolver();
    await browser?.close();
    try { await demo?.app.close(); } catch { /* fixture já fechada no caminho de reinício */ }
    await vite?.close();
    if (modelo) await new Promise(ok => modelo.close(ok));
  }
}
