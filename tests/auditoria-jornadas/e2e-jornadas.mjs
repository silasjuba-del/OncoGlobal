// Auditoria E2E das jornadas no perfil MEDICO: UI real (Vite) → HTTP real → SQLite isolado.
// Cenários declarados em CENARIOS.md. Cada prova registra PASSOU/FALHOU e o percurso continua.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer as criarSocket } from 'node:net';
import { mkdtempSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as criarVite } from 'vite';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { montarPacoteDocumental } = require('../../integrations/pdfforge/exportar-pacote.cjs');
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const A = 'Paciente SINTETICO A PULMAO', B = 'Paciente SINTETICO B ISOLAMENTO', C = 'Paciente SINTETICO C EMERGENCIA', D = 'Paciente SINTETICO D IMUNOTERAPIA';
const LINHAS = {
  [A]: ['LAUDO SINTETICO A - TC de torax 2026-10-09', 'Massa em lobo superior direito de 4,2 cm.', 'Nega hemoptise.',
    'Linfonodo mediastinal suspeito, A CONFERIR.', 'Anatomopatologico: adenocarcinoma de pulmao.', 'EGFR PENDENTE.'],
  [B]: ['LAUDO SINTETICO B - TC de torax 2026-10-09', 'Massa em lobo superior direito de 3,0 cm.',
    'RM coluna: sem sinais de massa epidural ou apagamento do saco dural.', 'EGFR PENDENTE.'],
  [C]: ['LAUDO SINTETICO C - RM coluna total 2026-10-10', 'Massa epidural em T10 com apagamento do saco dural.', 'Biomarcador PENDENTE.'],
  [D]: ['LAUDO SINTETICO D - TC torax 2026-10-11, em imunoterapia', 'Vidro fosco bilateral com padrao OP.',
    'TC abdome: espessamento mucoso continuo do colon com sinal do alvo.'],
};

async function portaLivre() {
  const s = criarSocket(); await new Promise((ok, f) => { s.once('error', f); s.listen(0, '127.0.0.1', ok); });
  const p = s.address().port; await new Promise(ok => s.close(ok)); return p;
}

export async function executar() {
  const evid = mkdtempSync(join(tmpdir(), 'auditoria-jornadas-evid-')), dir = mkdtempSync(join(tmpdir(), 'e2e-b2-f1-'));
  const resultados = [];
  const log = v => { const l = JSON.stringify({ t: new Date().toISOString(), ...v }); appendFileSync(join(evid, 'log.jsonl'), l + '\n'); console.log(l); };
  const prova = async (id, fn, requer = []) => {
    const faltam = requer.filter(k => ctx[k] === undefined);
    if (faltam.length) { resultados.push({ id, resultado: 'BLOQUEADO', erro: `depende de ${faltam}` }); log({ id, resultado: 'BLOQUEADO', faltam }); return; }
    try { const ev = await fn(); resultados.push({ id, resultado: 'PASSOU', evidencia: ev ?? null }); log({ id, resultado: 'PASSOU', ev }); }
    catch (e) {
      resultados.push({ id, resultado: 'FALHOU', erro: String(e?.message ?? e).slice(0, 900) }); log({ id, resultado: 'FALHOU', erro: String(e?.message ?? e).slice(0, 900) });
      try { await page.screenshot({ path: join(evid, `${id}.png`), fullPage: true }); writeFileSync(join(evid, `${id}.txt`), await page.locator('body').innerText()); } catch { /* sem página */ }
    }
  };
  // Espera de resposta abandonada por uma prova que falhou não derruba as provas seguintes.
  process.on('unhandledRejection', e => log({ rejeicaoNaoTratada: String(e?.message ?? e).slice(0, 300) }));
  process.env.VITE_ONCOGLOBAL_PERFIL = 'MEDICO';
  process.env.ONCOGLOBAL_API_PORT = String(await portaLivre());
  const uiPort = await portaLivre();
  let vite, demo, browser, page, fixture, listarEventos;
  const ctx = {};
  try {
    vite = await criarVite({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), cacheDir: join(dir, 'vite-cache'), server: { host: '127.0.0.1', port: uiPort, strictPort: true } });
    await vite.listen();
    fixture = await vite.ssrLoadModule('/tests/f1/s12/fixtures/servidor-demo-b2.ts');
    demo = await fixture.bootServidorDemoB2(dir);
    const { pdfDigital } = await vite.ssrLoadModule('/tests/f0-fecha/fixtures/colon-e2e.ts');
    ({ listarEventos } = await vite.ssrLoadModule('/src/kernel/ledger/ledger.ts'));
    const pacote = (nome, chave) => montarPacoteDocumental({ autor: `Autor SINTETICO ${chave}`,
      original: { name: `laudo-${chave}-SINTETICO.pdf`, bytes: pdfDigital(LINHAS[nome]) }, anotacoes: [], paginasExtraidas: [] },
      { pacoteId: `pacote-auditoria-${chave}`, agora: demo.manifesto.agora });
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    page.setDefaultTimeout(20_000);
    await page.clock.setFixedTime(new Date(demo.manifesto.agora));
    const errosPagina = [], externas = [];
    page.on('pageerror', e => errosPagina.push(e.message));
    page.on('request', r => { const u = new URL(r.url()); if (['http:', 'https:'].includes(u.protocol) && u.hostname !== '127.0.0.1') externas.push(u.origin); });
    const nav = () => page.getByRole('navigation', { name: 'Áreas clínicas', exact: true });
    const navegar = nome => nav().getByRole('button', { name: nome, exact: true }).click();
    const eventos = pid => listarEventos(demo.app.db, pid);
    const clinicos = pid => eventos(pid).filter(e => !['ReviewDecision'].includes(e.tipo)).map(e => e.eventId).sort();
    const entrar = async () => {
      await page.goto(`http://127.0.0.1:${uiPort}/oncoassist.html`);
      await page.getByLabel('Senha do servidor').fill(demo.manifesto.senhaDemo);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('region', { name: 'Agenda médica', exact: true }).waitFor();
    };
    const abrir = async nome => {
      await navegar('Agenda e pacientes').catch(() => {});
      await page.getByRole('region', { name: 'Agenda médica', exact: true }).waitFor();
      await page.getByRole('button', { name: `Abrir consulta de ${nome}`, exact: true }).first().click();
      await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
    };
    const cadastrar = async (nome, pront) => {
      await navegar('Agenda e pacientes').catch(() => {});
      await page.getByLabel('Cadastrar novo paciente', { exact: true }).check();
      await page.getByLabel('Nome do paciente', { exact: true }).fill(nome);
      await page.getByLabel('Nascimento', { exact: true }).fill('1970-01-01');
      await page.getByRole('combobox', { name: /^Sexo cadastral/ }).selectOption('F');
      await page.getByLabel('Identificador (opcional)', { exact: true }).fill(pront);
      const r = page.waitForResponse(x => x.url().endsWith('/medico/paciente/cadastrar'));
      await page.getByRole('button', { name: 'Cadastrar e agendar', exact: true }).click();
      const resp = await r; assert.equal(resp.status(), 201); return (await resp.json()).contexto;
    };
    const importarEVincular = async (nome, pac, tipoFonte = null) => {
      await navegar('Documentos e PDF');
      if (tipoFonte) await page.getByRole('combobox', { name: /^Classificação da fonte/ }).selectOption(tipoFonte);
      await page.getByLabel('Pacote documental PDFForge', { exact: true }).setInputFiles({ name: 'fonte.oncoglobal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pac)) });
      const r = page.waitForResponse(x => x.url().endsWith('/consulta/documental/importar'));
      await page.getByRole('button', { name: 'Importar pacote documental', exact: true }).click();
      const resp = await r; assert.equal(resp.status(), 201, `importar ${nome}: ${resp.status()}`);
      const { draftId, sourceId } = (await resp.json()).documento;
      await page.getByRole('combobox', { name: /^Documento 1/ }).selectOption(pac.pacoteId);
      const docArt = page.getByRole('article', { name: `Documento ${pac.original.nome}`, exact: true });
      await docArt.getByRole('button', { name: 'Revisar fonte na consulta', exact: true }).click();
      const grupo = page.getByRole('button', { name: /Revisão de fontes & Alertas RADS/ });
      if (await grupo.getAttribute('aria-expanded') === 'false') await grupo.click();
      await page.getByLabel('Trecho sem vínculo', { exact: true }).selectOption(draftId);
      const v = page.waitForResponse(x => x.url().endsWith('/consulta/rascunho/revisar'));
      await page.getByRole('button', { name: new RegExp(`^Confirmar vínculo deste trecho com ${nome}`) }).click();
      assert.equal((await v).status(), 200);
      await page.getByLabel('Fonte para revisão', { exact: true }).selectOption(draftId);
      await page.getByRole('checkbox', { name: 'Incluir texto original deste trecho na evolução', exact: true }).check();
      await page.getByRole('button', { name: 'Preparar revisão', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar revisão exibida', exact: true }).click();
      await page.getByText('Revisão registrada. Candidatos incertos conservam sua pendência.', { exact: true }).waitFor();
      return { draftId, sourceId };
    };
    const painel = () => page.getByRole('region', { name: 'Jornada clínica por skills', exact: true });
    const abrirPainel = async () => {
      await navegar('Consulta');
      const btn = painel().getByRole('button', { name: 'Jornada por skills', exact: true });
      if (await btn.getAttribute('aria-expanded') !== 'true') await btn.click();
    };
    const prepararSkill = async ({ skill = 'primeira-consulta', cartoes = [], acoes = [] } = {}) => {
      await abrirPainel();
      await painel().getByLabel('Tipo de jornada', { exact: true }).selectOption(skill);
      const caixas = painel().getByRole('group', { name: 'Laudos e exames vinculados', exact: true }).getByRole('checkbox');
      for (let i = 0; i < await caixas.count(); i++) await caixas.nth(i).check();
      if (cartoes.length) await painel().getByLabel('Cenários de pulmão', { exact: true }).selectOption(cartoes);
      if (acoes.length) await painel().getByLabel('Ações da jornada', { exact: true }).selectOption(acoes);
      const r = page.waitForResponse(x => x.url().endsWith('/consulta/skills') && x.request().postDataJSON()?.acao === 'EXECUTAR');
      await painel().getByRole('button', { name: 'Preparar rascunhos da jornada', exact: true }).click();
      const resp = await r; return { status: resp.status(), body: await resp.json() };
    };

    // ===== Jornada 1: primeira consulta (A) =====
    await entrar();
    await prova('J1.cadastro_A', async () => { ctx.A = await cadastrar(A, 'PRONT-SINT-A'); return ctx.A; });
    await prova('J1.documento_A_importado_vinculado_revisado', async () => { await abrir(A); ctx.fonteA = await importarEVincular(A, pacote(A, 'a')); return ctx.fonteA; }, ['A']);
    await prova('J1.skills_primeira_consulta_A', async () => {
      const antes = clinicos(ctx.A.patientId);
      await abrirPainel();
      const fontes = await painel().getByRole('group', { name: 'Laudos e exames vinculados', exact: true }).getByRole('checkbox').count();
      assert.equal(fontes, 1, `encontro A lista só a própria fonte (obs.: ${fontes})`);
      const opcoes = await painel().getByLabel('Cenários de pulmão', { exact: true }).locator('option').allTextContents();
      assert.ok(opcoes.length > 0, 'corpus de pulmão disponível no perfil médico');
      const r = await prepararSkill({ cartoes: ['PUL-26'], acoes: ['EX-08', 'EN-01'] });
      assert.equal(r.status, 200); assert.equal(r.body.codigo, 'SKILL_PREPARADA');
      ctx.skillA = r.body;
      assert.notEqual(r.body.execucao.jornada.estado, 'URGENTE', 'negação de hemoptise não gera urgência');
      assert.equal(r.body.execucao.jornada.autorizaTratamento, false);
      assert.deepEqual(clinicos(ctx.A.patientId), antes, 'skill não cria fato, pedido assinado ou administração');
      const tipos = r.body.documentos.map(d => d.tipo);
      const texto = r.body.documentos.map(d => d.texto).join('\n');
      for (const t of ['Nega hemoptise', 'A CONFERIR', 'PENDENTE']) assert.ok(texto.includes(t) || texto.toLowerCase().includes(t.toLowerCase()), `rascunho preserva "${t}"`);
      return { tipos, cartao: r.body.execucao.jornada.cartoes.map(c => c.id), etapas: r.body.execucao.jornada.etapas.map(e => `${e.id}:${e.estado}`) };
    }, ['fonteA']);
    await prova('J1.skills_rascunhos_ate_assinatura_e_reinicio', async () => {
      const titulos = await painel().getByRole('article', { name: 'Resultado da jornada' }).locator('details summary').allTextContents();
      const usados = [];
      for (const titulo of titulos) {
        await abrirPainel();
        let det = painel().locator('details').filter({ has: page.locator('summary', { hasText: titulo }) }).first();
        if (!(await det.count())) { await painel().getByRole('button', { name: 'Reabrir jornada', exact: true }).first().click(); det = painel().locator('details').filter({ has: page.locator('summary', { hasText: titulo }) }).first(); }
        await det.locator('summary').click();
        const usar = det.getByRole('button', { name: 'Revisar documento no Flash', exact: true });
        if (!(await usar.count())) continue;
        await usar.click(); usados.push(titulo);
        await page.getByRole('region', { name: 'Conteúdo da Consulta Flash', exact: true }).waitFor();
        // A região já pode estar aberta: aguardar a adoção deste documento, não somente o contêiner.
        await page.waitForFunction(t => [...document.querySelectorAll('input[aria-label^="Título do documento"]')].some(el => el.value === t), titulo);
        // Fluxo do médico: salvar o rascunho do Flash antes de trazer o próximo documento.
        const destinosAbertos = page.getByRole('textbox', { name: /^Destino do encaminhamento/ });
        const conteudos = page.getByRole('textbox', { name: /^Conteúdo do documento/ });
        if (!(await conteudos.count())) await page.getByText('Encaminhamentos, laudos e orientações', { exact: true }).click();
        assert.equal(await conteudos.count(), usados.length, 'cada documento adotado deve estar no editor antes de salvar');
        for (let i = 0; i < await destinosAbertos.count(); i++) if (!(await destinosAbertos.nth(i).inputValue())) await destinosAbertos.nth(i).fill('Pneumologia SINTETICA');
        const salvo = page.waitForResponse(x => x.url().endsWith('/consulta/flash/rascunho'));
        await page.getByRole('button', { name: 'SALVAR RASCUNHO', exact: true }).click();
        ctx.statusRascunhoFlash = [...(ctx.statusRascunhoFlash ?? []), (await salvo).status()];
        await page.getByText('Rascunho salvo; sem assinatura.', { exact: true }).waitFor();
      }
      assert.ok(usados.length > 0, 'algum rascunho da skill pode seguir ao Flash');
      const flash = page.getByRole('region', { name: 'Conteúdo da Consulta Flash', exact: true });
      ctx.docsNoFlash = await flash.getByRole('textbox', { name: /^Conteúdo do documento/ }).count();
      await page.getByLabel('Prazo do retorno em dias', { exact: true }).fill('14');
      await page.getByRole('button', { name: 'Revisar documentos para assinatura', exact: true }).click();
      const previa = page.getByRole('region', { name: 'Conteúdo para assinatura', exact: true });
      await previa.waitFor();
      const assinadosA = () => eventos(ctx.A.patientId).filter(e => e.tipo === 'DOCUMENTO' && e.revisao === 'ASSINADO');
      assert.equal(assinadosA().length, 0, 'prévia não assina');
      await previa.getByRole('button', { name: 'Confirmar e assinar conteúdo exibido', exact: true }).click();
      await page.getByRole('region', { name: 'Histórico de documentos assinados', exact: true }).waitFor();
      await page.waitForFunction(() => true);
      const docs = assinadosA().map(e => e.payload.data?.data ?? e.payload.data ?? {});
      const comSkill = docs.filter(d => JSON.stringify(d).includes('origemSkill'));
      assert.ok(comSkill.length > 0, 'documento assinado conserva proveniência da skill');
      ctx.hashAssinadosA = sha(assinadosA().map(e => e.eventId).sort());
      ctx.tiposAssinadosA = docs.map(d => d.tipoDocumento ?? d.tipo ?? '?');
      assert.equal(ctx.tiposAssinadosA.filter(t => t === 'FLASH_EVOLUCAO').length, 1, 'uma evolução por finalização, sem cópia automática concorrente');
      assert.ok(ctx.tiposAssinadosA.includes('FLASH_RESUMO_CASO'), 'resumo tem tipo próprio, não LAUDO');
      await demo.app.close(); demo = await fixture.bootServidorDemoB2(dir);
      await entrar(); await abrir(A);
      assert.equal(sha(assinadosA().map(e => e.eventId).sort()), ctx.hashAssinadosA, 'mesmos documentos após reinício');
      const hist = page.getByRole('region', { name: 'Histórico de documentos assinados', exact: true });
      await hist.waitFor(); const txt = await hist.innerText();
      assert.ok(txt.length > 0);
      return { usados, docsNoFlash: ctx.docsNoFlash, rascunhos: ctx.statusRascunhoFlash, assinados: ctx.tiposAssinadosA, comProvenienciaSkill: comSkill.length };
    }, ['skillA']);
    await prova('J1.skill_reaberta_apos_reinicio_e_assinatura', async () => {
      await abrirPainel();
      const leitura = page.waitForResponse(x => x.url().endsWith('/consulta/skills') && x.request().postDataJSON()?.acao === 'LER');
      await painel().getByRole('button', { name: 'Reabrir jornada', exact: true }).first().click();
      const r = await (await leitura).json();
      assert.equal(r.execucao.execucaoId, ctx.skillA.execucao.execucaoId);
      return { validadeAposAssinatura: r.validade };
    }, ['skillA']);
    await prova('J1.relatorio_pericia_acessivel_na_entrada_operacional', async () => {
      const botoes = await nav().getByRole('button').allTextContents();
      const txt = (await page.locator('body').innerText()).toLowerCase();
      assert.ok(botoes.some(b => /per[ií]cia/i.test(b)) || txt.includes('perícia') || txt.includes('pericial'), `nenhuma entrada de perícia; navegação: ${botoes.join(' | ')}`);
    });

    // ===== Isolamento (B) e resposta tardia =====
    await prova('ISO.cadastro_e_documento_B', async () => { ctx.B = await cadastrar(B, 'PRONT-SINT-B'); await abrir(B); ctx.fonteB = await importarEVincular(B, pacote(B, 'b')); return ctx.B; });
    await prova('ISO.fontes_de_B_fora_do_encontro_A', async () => {
      await abrir(A); await abrirPainel();
      const rotulos = await painel().getByRole('group', { name: 'Laudos e exames vinculados', exact: true }).locator('label').allTextContents();
      assert.ok(!rotulos.some(l => l.includes(ctx.fonteB.sourceId)), `fonte de B listada em A: ${rotulos}`);
      await navegar('Documentos e PDF');
      const opcoes = await page.getByRole('combobox', { name: /^Documento 1/ }).locator('option').allTextContents();
      assert.ok(!opcoes.some(o => o.includes('pacote-auditoria-b')), `pacote de B visível em A: ${opcoes}`);
      return { fontesA: rotulos };
    }, ['fonteA', 'fonteB']);
    await prova('ISO.negacao_B_nao_urgente', async () => {
      await abrir(B); const r = await prepararSkill();
      assert.equal(r.status, 200); assert.notEqual(r.body.execucao.jornada.estado, 'URGENTE', 'negação anula o elo (D-W9-51)');
      return { estado: r.body.execucao.jornada.estado };
    }, ['fonteB']);
    await prova('FALHA.resposta_tardia_de_A_nao_aparece_em_B', async () => {
      await abrir(A); await abrirPainel();
      let liberar; const portao = new Promise(ok => { liberar = ok; });
      await page.route('**/consulta/skills', async route => { if (route.request().postDataJSON()?.acao === 'EXECUTAR') await portao; await route.continue(); }, { times: 1 });
      await painel().getByLabel('Tipo de jornada', { exact: true }).selectOption('retorno');
      const resp = page.waitForResponse(x => x.url().endsWith('/consulta/skills') && x.request().postDataJSON()?.acao === 'EXECUTAR');
      await painel().getByRole('button', { name: /Preparar rascunhos da jornada|Preparando/ }).click();
      await abrir(B); liberar(); await resp; await page.waitForTimeout(500);
      const ativo = await page.getByLabel('Contexto médico ativo').innerText();
      assert.ok(ativo.includes(B), `contexto ativo: ${ativo}`);
      const resultadoVisivel = await painel().getByRole('article', { name: 'Resultado da jornada' }).count();
      const corpo = resultadoVisivel ? await painel().getByRole('article', { name: 'Resultado da jornada' }).innerText() : '';
      assert.ok(!corpo.includes('LAUDO SINTETICO A'), 'resposta de A não renderiza no encontro de B');
      return { resultadoNoPainelB: resultadoVisivel };
    }, ['fonteA', 'fonteB']);
    await prova('FALHA.duplo_clique_mesma_operacao', async () => {
      await abrir(B); await abrirPainel();
      await painel().getByLabel('Tipo de jornada', { exact: true }).selectOption('follow-up');
      const ops = [];
      page.on('request', r => { if (r.url().endsWith('/consulta/skills') && r.postDataJSON()?.acao === 'EXECUTAR') ops.push(r.postDataJSON().operationId); });
      const btn = painel().getByRole('button', { name: 'Preparar rascunhos da jornada', exact: true });
      await btn.dblclick(); await painel().getByRole('article', { name: 'Resultado da jornada' }).waitFor(); await page.waitForTimeout(300);
      assert.ok(new Set(ops).size <= 1, `operações distintas no duplo clique: ${ops}`);
      return { requisicoes: ops.length, operacoes: new Set(ops).size };
    }, ['fonteB']);

    // ===== Emergência (C) =====
    await prova('EMG.compressao_medular_interrompe_eletivas', async () => {
      ctx.C = await cadastrar(C, 'PRONT-SINT-C'); await abrir(C); ctx.fonteC = await importarEVincular(C, pacote(C, 'c'));
      const antes = clinicos(ctx.C.patientId);
      const r = await prepararSkill({ cartoes: ['PUL-26'], acoes: ['EX-08'] });
      assert.equal(r.status, 200);
      const j = r.body.execucao.jornada;
      assert.equal(j.estado, 'URGENTE', `estado ${j.estado}; alertas ${JSON.stringify(j.alertas)}`);
      assert.equal(j.cartoes.length, 0, 'cartões eletivos interrompidos');
      assert.ok(j.alertas.some(a => a.sourceId === ctx.fonteC.sourceId), 'alerta conserva a fonte');
      await painel().getByRole('alert').filter({ hasText: 'Suspeita urgente' }).waitFor();
      assert.deepEqual(clinicos(ctx.C.patientId), antes, 'sem prescrição, administração ou fato automático');
      return { alertas: j.alertas.map(a => a.texto) };
    });

    await prova('EMG.pneumonite_e_colite_imunomediadas', async () => {
      ctx.D = await cadastrar(D, 'PRONT-SINT-D'); await abrir(D); ctx.fonteD = await importarEVincular(D, pacote(D, 'd'));
      const r = await prepararSkill({ cartoes: ['PUL-26'] });
      assert.equal(r.status, 200);
      const j = r.body.execucao.jornada, nomes = j.alertas.map(a => a.texto);
      assert.equal(j.estado, 'URGENTE', `estado ${j.estado}`);
      for (const n of ['Pneumonite imunomediada/actínica', 'Colite imunomediada']) assert.ok(nomes.includes(n), `alerta ${n}: ${nomes}`);
      return { alertas: nomes };
    });

    // ===== Jornadas 2 e 3: retorno e follow-up de A =====
    await prova('J2.agendar_e_abrir_encontro_de_retorno_A', async () => {
      await navegar('Agenda e pacientes');
      const retornos = page.getByRole('region', { name: 'Retornos a agendar', exact: true });
      await retornos.waitFor();
      await retornos.locator('li').filter({ hasText: A }).getByRole('button', { name: 'Preparar agendamento do retorno', exact: true }).click();
      const data = await page.getByLabel('Data do encontro', { exact: true }).inputValue();
      const ag = page.waitForResponse(x => x.url().endsWith('/medico/agenda/agendar'));
      await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
      const resp = await ag; assert.equal(resp.status(), 201); const corpo = await resp.json();
      ctx.retornoA = corpo; ctx.dataRetorno = data;
      await page.getByLabel('Fim da agenda', { exact: true }).fill(data);
      const item = page.getByRole('region', { name: 'Agenda médica', exact: true }).locator('li').filter({ hasText: `${data} ·` }).filter({ hasText: A });
      await item.getByRole('button', { name: `Abrir consulta de ${A}`, exact: true }).click();
      await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
      const ativo = await page.getByLabel('Contexto médico ativo').innerText();
      return { data, ativo, resposta: Object.keys(corpo) };
    }, ['hashAssinadosA']);
    await prova('J2.historico_do_encontro_anterior_recuperado', async () => {
      const hist = page.getByRole('region', { name: 'Histórico de documentos assinados', exact: true });
      const n = await hist.count(); const txt = n ? await hist.innerText() : '';
      await abrirPainel();
      await painel().getByRole('group', { name: 'Laudos e exames vinculados', exact: true }).getByRole('checkbox').first().waitFor();
      const fontes = await painel().getByRole('group', { name: 'Laudos e exames vinculados', exact: true }).locator('label').allTextContents();
      assert.ok(n > 0 && txt.length > 0, 'documentos assinados do encontro anterior visíveis no retorno');
      assert.ok(fontes.some(f=>f.includes(ctx.fonteA.sourceId)), 'laudo anterior de A disponível para seleção no retorno');
      return { fontesNoRetorno: fontes, historicoVisivel: n > 0 };
    }, ['retornoA']);
    for (const [skill, etapa] of [['retorno', 'S06'], ['follow-up', 'S09']]) {
      await prova(`J${skill === 'retorno' ? 2 : 3}.skill_${skill}_sem_QT_automatica`, async () => {
        const r = await prepararSkill({ skill, acoes: skill === 'follow-up' ? ['FU-02'] : ['EX-08'] });
        assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
        const etapas = r.body.execucao.jornada.etapas.map(e => e.id);
        assert.equal(etapas.includes('S08'), false, 'sem pedido de discussão não abre QT');
        assert.equal(etapas.includes(etapa), true);
        const texto = r.body.documentos.map(d => d.texto).join('\n');
        writeFileSync(join(evid, `${skill}-documentos.txt`), texto);
        return { etapas, citaHistorico: /anterior|hist[oó]rico/i.test(texto), documentos: r.body.documentos.map(d => d.tipo) };
      }, ['retornoA']);
    }

    await prova('J2.retorno_recupera_decisao_e_fontes_do_encontro_anterior', async () => {
      const { readFileSync } = await import('node:fs');
      const texto = readFileSync(join(evid, 'retorno-documentos.txt'), 'utf8');
      const secao = texto.split('Histórico documentado (não é administração presumida)')[1]?.split('Avaliações de segurança')[0]?.trim() ?? '';
      assert.ok(secao.length > 0, 'histórico documentado do retorno vazio: não cita a evolução/pedidos/encaminhamento assinados no encontro anterior');
      assert.ok(/adenocarcinoma|Pneumologia SINTETICA/i.test(texto), 'retorno não recupera diagnóstico documentado nem encaminhamento assinado do encontro anterior');
      return { secao: secao.slice(0, 200) };
    }, ['retornoA']);

    // ===== Regras de dose pela implementação real (D-F1-52) =====
    await prova('DOSE.D-F1-52_mg', async () => {
      const { arredondarDoseMg } = await vite.ssrLoadModule('/src/contracts/doseReducao.ts');
      const casos = [[7.2, 7], [7.5, 7.5], [5.8, 6], [0.3, 0.3], [0.7, 1]];
      for (const [x, y] of casos) assert.equal(arredondarDoseMg(x), y, `${x} → ${arredondarDoseMg(x)}`);
      return casos;
    });
    await prova('DOSE.D-F1-52_ug_positiva_pequena_nao_zera', async () => {
      const { calcularDosePorBase } = await vite.ssrLoadModule('/src/rules/prescricao/index.ts');
      const r = calcularDosePorBase({ basis: 'MCG_KG', mcgKg: 0.005, pesoKg: 70 });
      assert.ok(!(r.estado === 'PRONTO' && r.dose === 0), `0,005 µg/kg × 70 kg = 0,35 µg → ${JSON.stringify(r)}`);
      return r;
    });

    // Provas adicionais: não substituem nem enfraquecem as 22 provas originais.
    const abrirRetornoA = async () => {
      await navegar('Agenda e pacientes');
      await page.getByLabel('Fim da agenda', { exact: true }).fill(ctx.dataRetorno);
      const item = page.getByRole('region', { name: 'Agenda médica', exact: true }).locator('li').filter({ hasText: `${ctx.dataRetorno} ·` }).filter({ hasText: A });
      await item.getByRole('button', { name: `Abrir consulta de ${A}`, exact: true }).click();
      await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
    };
    await prova('J2.pedido_resultado_revisao_reinicio', async () => {
      await abrirRetornoA();
      const pac = montarPacoteDocumental({ autor:'Médico SINTETICO', original:{name:'resultado-A-retorno-SINTETICO.pdf',
        bytes:pdfDigital(['RESULTADO LABORATORIAL SINTETICO A', 'Hemoglobina 12 g/dL. Plaquetas 220000 por microlitro.', 'Documento exclusivamente sintético para vínculo de resultado.'])}, anotacoes:[],paginasExtraidas:[] },
        {pacoteId:'pacote-resultado-a-retorno',agora:demo.manifesto.agora});
      ctx.fonteResultadoA = await importarEVincular(A,pac,'lab_feed');
      const sec = page.getByRole('region',{name:'Pedidos e resultados do retorno',exact:true});
      const ler = async () => {
        const r=page.waitForResponse(x=>x.url().endsWith('/tarefas/resultados')&&x.request().postDataJSON()?.acao==='LISTAR');
        await sec.getByRole('button',{name:'Recarregar pedidos e resultados',exact:true}).click();
        const resposta=await r;assert.equal(resposta.status(),200);return {dados:await resposta.json(),headers:await resposta.request().allHeaders()};
      };
      let atual=await ler();assert.ok(atual.dados.tarefas.length>0,'pedido assinado tem acompanhamento');
      const semVinculos = () => eventos(ctx.A.patientId).filter(e=>!['Tarefa','ReviewDecision'].includes(e.tipo)).map(e=>[e.eventId,sha(e)]);
      const fatosAntes=semVinculos();
      const t=atual.dados.tarefas.find(t=>t.pedidos.length>0),pedido=t.pedidos[0],contexto=atual.dados.contexto;
      const linha=sec.getByRole('article',{name:`Acompanhamento ${pedido.titulo}`,exact:true}).first();
      assert.ok((await linha.innerText()).includes('SOLICITADO'));
      await linha.getByLabel('Data de realização do exame',{exact:true}).fill(demo.manifesto.agora.slice(0,10));
      let r=page.waitForResponse(x=>x.url().endsWith('/tarefas/resultados')&&x.request().postDataJSON()?.acao==='REALIZADO');
      await linha.getByRole('button',{name:'Registrar realização',exact:true}).click();let rr=await r;assert.equal(rr.status(),200,await rr.text());
      atual=await ler();const tarefa=atual.dados.tarefas.find(x=>x.tarefa.tarefaId===t.tarefa.tarefaId);
      const {lerDraft}=await vite.ssrLoadModule('/src/kernel/comandos/portas.ts');
      const fonteRef = id => { const d=lerDraft(demo.app.db,id),l=d.payload.patientLinkReview; return {draftId:id,revision:d.revision,sourceId:d.sourceId,hash:l.sourceHash,encounterId:l.encounterId}; };
      const antes=clinicos(ctx.A.patientId),antesB=clinicos(ctx.B.patientId);
      for(const id of [ctx.fonteB.draftId,ctx.fonteA.draftId]){
        const negado=await page.request.post(`http://127.0.0.1:${uiPort}/tarefas/resultados`,{headers:{Authorization:atual.headers.authorization},data:{
          acao:'RESULTADO_DISPONIVEL',contexto,tarefaId:t.tarefa.tarefaId,pedido:{documentId:pedido.documentId,documentVersion:pedido.documentVersion},expectedEventId:tarefa.eventId,operationId:`negado-${id}`,fonte:fonteRef(id)}});
        assert.equal(negado.status(),409);assert.equal((await negado.json()).codigo,'RESULTADO_FORA_CONTEXTO_OU_ALTERADO');
      }
      assert.deepEqual(clinicos(ctx.A.patientId),antes);assert.deepEqual(clinicos(ctx.B.patientId),antesB);
      await linha.getByRole('combobox',{name:/^Documento do resultado/}).selectOption(ctx.fonteResultadoA.draftId);
      r=page.waitForResponse(x=>x.url().endsWith('/tarefas/resultados')&&x.request().postDataJSON()?.acao==='RESULTADO_DISPONIVEL');
      await linha.getByRole('button',{name:'Vincular resultado disponível',exact:true}).click();rr=await r;assert.equal(rr.status(),200,await rr.text());
      await linha.getByText('Conferir fonte do resultado',{exact:true}).click();
      await linha.getByText('Documento exclusivamente sintético para vínculo de resultado.',{exact:false}).waitFor();
      r=page.waitForResponse(x=>x.url().endsWith('/tarefas/resultados')&&x.request().postDataJSON()?.acao==='REVISADO');
      await linha.getByRole('button',{name:'Confirmar vínculo revisado',exact:true}).click();rr=await r;assert.equal(rr.status(),200,await rr.text());
      const gravado=await rr.json();ctx.resultadoRevisado=gravado.tarefas.find(x=>x.tarefa.tarefaId===t.tarefa.tarefaId).tarefa.acompanhamentoPedidos[0];
      assert.equal(ctx.resultadoRevisado.estado,'REVISADO');assert.equal(ctx.resultadoRevisado.resultado.sourceId,ctx.fonteResultadoA.sourceId);
      assert.deepEqual(semVinculos(),fatosAntes,'vínculo revisado não cria nem altera fatos clínicos');
      const antesReplay=eventos(ctx.A.patientId).map(e=>e.eventId);
      const pedidoReplay=rr.request().postDataJSON();const replay=await page.request.post(`http://127.0.0.1:${uiPort}/tarefas/resultados`,{headers:{Authorization:atual.headers.authorization},data:pedidoReplay});assert.equal(replay.status(),200);
      assert.deepEqual(eventos(ctx.A.patientId).map(e=>e.eventId),antesReplay,'replay não cria eventos duplicados');
      await demo.app.close();demo=await fixture.bootServidorDemoB2(dir);await entrar();await abrirRetornoA();
      atual=await ler();assert.deepEqual(atual.dados.tarefas.find(x=>x.tarefa.tarefaId===t.tarefa.tarefaId).tarefa.acompanhamentoPedidos[0],ctx.resultadoRevisado);
      return {estado:'REVISADO',sourceId:ctx.resultadoRevisado.resultado.sourceId,hash:ctx.resultadoRevisado.resultado.hash,reaberto:true,isolamento:true};
    },['retornoA','fonteB']);
    await prova('DOC.pericia_edicao_assinatura_reabertura',async()=>{
      await abrirRetornoA();
      await nav().getByRole('button',{name:'Relatório para perícia',exact:true}).click();
      const flash=page.getByRole('region',{name:'Conteúdo da Consulta Flash',exact:true});await flash.waitFor();
      if(!(await flash.getByRole('textbox',{name:'Conteúdo do documento 1',exact:true}).count()))await flash.getByText('Encaminhamentos, laudos e orientações',{exact:true}).click();
      assert.equal(await flash.getByRole('textbox',{name:'Título do documento 1',exact:true}).inputValue(),'Relatório médico para perícia');
      const texto='RELATORIO PERICIAL SINTETICO A. Finalidade: subsidiar avaliação pericial. Atividade profissional e limitações avaliadas pelo médico neste cenário sintético. Sem prazo de afastamento presumido.';
      await flash.getByRole('textbox',{name:'Conteúdo do documento 1',exact:true}).fill(texto);
      const antes=eventos(ctx.A.patientId).filter(e=>e.tipo==='DOCUMENTO'&&e.revisao==='ASSINADO').length;
      await flash.getByRole('button',{name:'Revisar documentos para assinatura',exact:true}).click();
      const previa=page.getByRole('region',{name:'Conteúdo para assinatura',exact:true});await previa.waitFor();
      assert.equal(eventos(ctx.A.patientId).filter(e=>e.tipo==='DOCUMENTO'&&e.revisao==='ASSINADO').length,antes);
      await previa.getByRole('button',{name:'Confirmar e assinar conteúdo exibido',exact:true}).click();
      await page.getByRole('region',{name:'Histórico de documentos assinados',exact:true}).waitFor();
      const pericias=eventos(ctx.A.patientId).filter(e=>e.tipo==='DOCUMENTO'&&e.revisao==='ASSINADO'&&(e.payload.data?.data??e.payload.data??{}).tipoDocumento==='FLASH_RELATORIO_PERICIAL');
      assert.equal(pericias.length,1);assert.ok(JSON.stringify(pericias[0]).includes(texto));
      const hash=sha(pericias[0]);await demo.app.close();demo=await fixture.bootServidorDemoB2(dir);await entrar();await abrirRetornoA();
      const reaberto=eventos(ctx.A.patientId).find(e=>e.eventId===pericias[0].eventId);assert.equal(sha(reaberto),hash);
      const hist=page.getByRole('region',{name:'Histórico de documentos assinados',exact:true});assert.ok((await hist.innerText()).includes('Relatório médico para perícia'));
      return {edicao:true,assinaturaExplicita:true,reabertura:true,tipo:'FLASH_RELATORIO_PERICIAL'};
    },['retornoA']);

    await prova('FALHA.modulo_que_falha_ao_carregar', async () => {
      const contexto2 = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
      const p2 = await contexto2.newPage(); p2.setDefaultTimeout(20_000);
      await p2.clock.setFixedTime(new Date(demo.manifesto.agora));
      await p2.route(/DocumentosMedicos/, r => r.abort('connectionfailed'));
      await p2.goto(`http://127.0.0.1:${uiPort}/oncoassist.html`);
      await p2.getByLabel('Senha do servidor').fill(demo.manifesto.senhaDemo);
      await p2.getByRole('button', { name: 'Entrar', exact: true }).click();
      await p2.getByRole('button', { name: `Abrir consulta de ${A}`, exact: true }).first().click();
      const nav2 = p2.getByRole('navigation', { name: 'Áreas clínicas', exact: true });
      await nav2.getByRole('button', { name: 'Documentos e PDF', exact: true }).click();
      await p2.getByRole('alert').filter({ hasText: 'Não foi possível abrir este módulo' }).waitFor();
      await nav2.getByRole('button', { name: 'Orientações dietéticas', exact: true }).click();
      await p2.getByRole('textbox', { name: /^Orientação dietética para revisão/ }).waitFor();
      await contexto2.close();
      return { alertaDeModulo: true, restoDoAppUtilizavel: true };
    }, ['A']);
    await prova('GERAL.sem_erros_de_pagina_nem_requisicoes_externas', async () => {
      assert.deepEqual(externas, []); assert.deepEqual(errosPagina, []); return true;
    });
  } finally {
    if (resultados.some(r => r.resultado !== 'PASSOU')) process.exitCode = 1;
    writeFileSync(join(evid, 'resultados.json'), JSON.stringify({ evidencias: evid, sqlite: dir, resultados }, null, 2));
    console.log(JSON.stringify({ RESUMO: resultados.map(r => `${r.resultado} ${r.id}`), evidencias: evid }));
    await browser?.close();
    try { await demo?.app.close(); } catch { /* já fechado */ }
    await vite?.close();
  }
}
executar().catch(e => { console.error(e); process.exitCode = 1; });
