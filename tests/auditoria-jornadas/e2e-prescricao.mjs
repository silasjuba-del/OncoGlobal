// S1.1 — E2E da prescrição de QT no perfil MEDICO: UI real (Vite) → HTTP real → SQLite isolado.
// Cenário declarado em CENARIOS.md (paciente B2 sintético, ficha CUP carboplatina + paclitaxel 21/21).
// Pré-requisitos clínicos (lote tumoral e hemograma) entram pela mesma porta de confirmação do produto.
import assert from 'node:assert/strict';
import { createServer as criarSocket } from 'node:net';
import { mkdtempSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as criarVite } from 'vite';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE_ID = 'FICHA.primario-desconhecido-cup.carboplatina-paclitaxel-21-21-dias__nao-especificado@1.0.0';
const LOTE = 'lote-s11-rx-sintetico';

async function portaLivre() {
  const s = criarSocket(); await new Promise((ok, f) => { s.once('error', f); s.listen(0, '127.0.0.1', ok); });
  const p = s.address().port; await new Promise(ok => s.close(ok)); return p;
}

export async function executar() {
  const evid = mkdtempSync(join(tmpdir(), 'auditoria-prescricao-evid-')), dir = mkdtempSync(join(tmpdir(), 'e2e-b2-f1-'));
  const resultados = [], ctx = {};
  const log = v => { const l = JSON.stringify({ t: new Date().toISOString(), ...v }); appendFileSync(join(evid, 'log.jsonl'), l + '\n'); console.log(l); };
  let page;
  const prova = async (id, fn, requer = []) => {
    const faltam = requer.filter(k => ctx[k] === undefined);
    if (faltam.length) { resultados.push({ id, resultado: 'BLOQUEADO', erro: `depende de ${faltam}` }); log({ id, resultado: 'BLOQUEADO', faltam }); return; }
    try { const ev = await fn(); resultados.push({ id, resultado: 'PASSOU', evidencia: ev ?? null }); log({ id, resultado: 'PASSOU', ev }); }
    catch (e) {
      const erro = String(e?.message ?? e).slice(0, 900); resultados.push({ id, resultado: 'FALHOU', erro }); log({ id, resultado: 'FALHOU', erro });
      try { await page.screenshot({ path: join(evid, `${id}.png`), fullPage: true }); writeFileSync(join(evid, `${id}.txt`), await page.locator('body').innerText()); } catch { /* sem página */ }
    }
  };
  process.on('unhandledRejection', e => log({ rejeicaoNaoTratada: String(e?.message ?? e).slice(0, 300) }));
  process.env.VITE_ONCOGLOBAL_PERFIL = 'MEDICO';
  process.env.ONCOGLOBAL_API_PORT = String(await portaLivre());
  const uiPort = await portaLivre();
  let vite, demo, browser, fixture;
  try {
    vite = await criarVite({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), cacheDir: join(dir, 'vite-cache'), server: { host: '127.0.0.1', port: uiPort, strictPort: true } });
    await vite.listen();
    fixture = await vite.ssrLoadModule('/tests/f1/s12/fixtures/servidor-demo-b2.ts');
    demo = await fixture.bootServidorDemoB2(dir);
    const { listarEventos } = await vite.ssrLoadModule('/src/kernel/ledger/ledger.ts');
    const { executarConfirmacao } = await vite.ssrLoadModule('/src/kernel/comandos/index.ts');
    const { salvarDraft } = await vite.ssrLoadModule('/src/kernel/comandos/portas.ts');
    const { fonteSintetica, presente } = await vite.ssrLoadModule('/tests/fixtures/triagem.ts');
    // Paciente sem exames prévios na fixture: evita a creatinina só com data civil do paciente B2.
    const b2 = demo.manifesto.consultaConfiavel, AGORA = demo.manifesto.agora, DATA = AGORA.slice(0, 10);
    const eventos = () => listarEventos(demo.app.db, b2.patientId);
    let n = 0;
    const confirmar = (tipo, payload, tumorLotId) => {
      const id = `s11-rx-${tipo.toLowerCase()}-${++n}`;
      salvarDraft(demo.app.db, { draftId: id, patientId: b2.patientId, sourceId: id, rawRef: 'referencia-local-sintetica', payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
      const r = executarConfirmacao(demo.app.db, { patientId: b2.patientId, encounterId: b2.encounterId, tumorLotId, operationId: `op-${id}`,
        reviewDecisionId: `review-${id}`, sessao: demo.app.sessoes.obter(demo.app.token), em: AGORA,
        registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload, fontes: [fonteSintetica(payload.sourceId ?? id)], revisao: 'CONFIRMADO', supersedesEventId: null }] });
      assert.equal(r.estado, 'GRAVADA', `semeadura ${tipo}: ${JSON.stringify(r)}`);
    };
    confirmar('TumorLot', { patientId: b2.patientId, tumorLotId: LOTE, cid: presente('C80'), topografia: presente('Primário desconhecido SINTETICO'),
      histologia: presente('Carcinoma SINTETICO'), estadiamentos: [], finalidadeApac: presente('PALIATIVA'), marcos: [] }, LOTE);
    const COLETA = `${DATA}T08:00:00-03:00`;
    confirmar('Weight', { kg: 70, origem: 'MEDIDO', data: DATA, sourceId: 'medida-s11-peso' }, null);
    confirmar('FATO', { campo: 'alturaCm', valor: 170, unidade: 'cm', data: DATA, dataClinica: DATA, sourceId: 'medida-s11-altura' }, null);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    page.setDefaultTimeout(20_000);
    await page.clock.setFixedTime(new Date(AGORA));
    const errosPagina = [], externas = [];
    page.on('pageerror', e => errosPagina.push(e.message));
    page.on('request', r => { const u = new URL(r.url()); if (['http:', 'https:'].includes(u.protocol) && u.hostname !== '127.0.0.1') externas.push(u.origin); });
    const editor = () => page.getByRole('region', { name: 'Editor de prescrição executável', exact: true });
    const administracoes = () => eventos().filter(e => /administra/i.test(e.tipo) || /administra/i.test(JSON.stringify(e.payload?.data?.kind ?? '')));
    const prescricoesAssinadas = () => eventos().filter(e => e.revisao === 'ASSINADO' && /prescri/i.test(`${e.tipo} ${JSON.stringify(e.payload).slice(0, 400)}`));

    const abrirEditor = async () => {
      await page.goto(`http://127.0.0.1:${uiPort}/oncoassist.html`);
      await page.getByLabel('Senha do servidor').fill(demo.manifesto.senhaDemo);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('button', { name: `Abrir consulta de ${b2.nome}`, exact: true }).first().click();
      await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
      await page.getByLabel('Lote tumoral', { exact: true }).selectOption(LOTE);
      await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Prescrição estruturada', exact: true }).click();
      await page.getByRole('region', { name: 'Editor da prescrição desta consulta', exact: true }).waitFor();
    };
    const cartaoFicha = () => page.getByRole('region', { name: 'Catálogo de fichas de prescrição', exact: true })
      .getByRole('article').filter({ hasText: 'Primário desconhecido (CUP)' }).filter({ hasText: 'Carboplatina + Paclitaxel 21/21 dias' });
    const usarFicha = async () => {
      const sumario = page.getByText('Fichas de protocolo: conferir e usar na prescrição', { exact: true });
      if (!(await page.getByRole('region', { name: 'Catálogo de fichas de prescrição', exact: true }).count())) await sumario.click();
      await page.getByLabel('Buscar por nome, tumor ou cenário', { exact: true }).fill('Carboplatina + Paclitaxel 21/21');
      const cartao = cartaoFicha(); await cartao.waitFor();
      return cartao;
    };
    const preencherPlanejamento = async () => {
      const ed = editor(); await ed.waitFor();
      const substituir = page.getByRole('button', { name: 'Substituir itens pela ficha selecionada', exact: true });
      if (await substituir.count()) await substituir.click();
      // Trocar para Nova linha zera os itens no produto; um clique real no valor já selecionado não dispara mudança.
      const modo = ed.getByLabel('Modo do ciclo', { exact: true });
      if (await modo.inputValue() !== 'NOVA_LINHA') throw new Error(`modo inicial ${await modo.inputValue()}: cenário espera paciente sem episódio`);
      await ed.getByLabel('Linha terapêutica', { exact: true }).fill('1');
      await ed.getByLabel('Intenção terapêutica', { exact: true }).selectOption('PALIATIVA');
      await ed.getByLabel('Número do ciclo', { exact: true }).fill('1');
      await ed.getByLabel('Data prevista', { exact: true }).fill(DATA);
      await ed.getByLabel('Motivo da prescrição', { exact: true }).fill('Prescrição SINTETICA de auditoria E2E; decisão médica simulada.');
    };
    const prepararPrevia = async () => {
      const botao = editor().getByRole('button', { name: 'Preparar prévia exata', exact: true });
      if (!(await botao.isEnabled())) return { status: 'BOTAO_DESABILITADO', body: { erros: await editor().getByRole('alert').allTextContents() } };
      const r = page.waitForResponse(x => x.url().endsWith('/consulta/prescricao-executavel/preparar'), { timeout: 5000 });
      await botao.click();
      const resp = await r.catch(() => null);
      if (!resp) return { status: 'SEM_REQUISICAO', body: { erros: await editor().getByRole('alert').allTextContents() } };
      return { status: resp.status(), body: await resp.json() };
    };

    await prova('S1.1.ficha_conferida_pelo_medico_no_banco_sintetico', async () => {
      await abrirEditor();
      const cartao = await usarFicha();
      await cartao.getByText('Conteúdo completo da versão 1.0.0', { exact: true }).click();
      await cartao.getByRole('checkbox', { name: 'Confirmo a conferência integral da ficha', exact: true }).check();
      await cartao.getByRole('textbox', { name: 'Motivo da revisão', exact: true }).fill('Conferência SINTETICA para auditoria E2E; não é aprovação clínica.');
      const rev = page.waitForResponse(x => x.url().endsWith('/consulta/fichas-prescricao/revisar') || x.url().includes('fichas') && x.request().method() === 'POST');
      await cartao.getByRole('button', { name: 'Conferir e registrar versão', exact: true }).click();
      const resp = await rev; assert.equal(resp.status(), 200, `revisar ficha: ${resp.status()} ${await resp.text()}`);
      await cartao.getByRole('button', { name: 'Usar ficha em rascunho', exact: true }).waitFor();
      ctx.conferida = true;
      return { revisao: (await resp.json()).revisao?.decisao };
    });
    await prova('S1.1.negativo_sem_creatinina_dose_AUC_pendente_nao_assina', async () => {
      const inst = page.waitForResponse(x => x.url().includes('instanciar'));
      ctx.basesAposInstanciar = 0;
      page.on('response', x => { if (x.url().endsWith('/consulta/prescricao-executavel/base')) ctx.basesAposInstanciar++; });
      await cartaoFicha().getByRole('button', { name: 'Usar ficha em rascunho', exact: true }).click();
      const ri = await inst; assert.equal(ri.status(), 200, `instanciar: ${await ri.text()}`);
      ctx.instanciacao = await ri.json();
      const linhaTempo = [];
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(500);
        linhaTempo.push({ ms: (i + 1) * 500, itens: await editor().getByRole('group', { name: /^Item da prescrição/ }).count(), bases: ctx.basesAposInstanciar });
      }
      ctx.linhaTempo = linhaTempo;
      writeFileSync(join(evid, 'linha-do-tempo-ficha.json'), JSON.stringify(linhaTempo, null, 2));
      assert.ok(linhaTempo.every(p => p.itens > 0), `itens da ficha somem do editor sem ação do médico: ${JSON.stringify(linhaTempo)}`);
      const itensEditor = await editor().getByRole('group', { name: /^Item da prescrição/ }).count();
      const origemVisivel = await editor().getByRole('region', { name: 'Origem da prescrição', exact: true }).count();
      ctx.fichaAplicadaNoEditor = { itensEditor, origemVisivel, basesRecarregadas: ctx.basesAposInstanciar ?? null };
      assert.ok(itensEditor > 0 && origemVisivel > 0,
        `ficha instanciada (${ctx.instanciacao.itens?.length} itens) não aparece no editor: ${JSON.stringify(ctx.fichaAplicadaNoEditor)}`);
      await preencherPlanejamento();
      const p = await prepararPrevia();
      writeFileSync(join(evid, 'preparar-sem-creatinina.json'), JSON.stringify(p, null, 2));
      assert.ok(!['SEM_REQUISICAO', 'BOTAO_DESABILITADO'].includes(p.status), `prévia não chegou ao servidor: ${JSON.stringify(p.body)}`);
      const previa = editor().getByRole('region', { name: 'Prévia da prescrição', exact: true });
      const assinar = editor().getByRole('button', { name: 'Confirmar e assinar prescrição', exact: true });
      const temPrevia = p.status === 200 && await previa.count();
      if (temPrevia) {
        const r = page.waitForResponse(x => x.url().endsWith('/consulta/prescricao-executavel/confirmar'));
        if (await assinar.isEnabled()) { await assinar.click(); const c = await r; assert.notEqual(c.status(), 200, 'sem função renal a carboplatina por AUC não pode ser assinada'); ctx.recusaSemHemograma = c.status(); }
        else ctx.recusaSemHemograma = 'BOTAO_DESABILITADO';
      } else ctx.recusaSemHemograma = p.body?.codigo ?? p.status;
      assert.equal(prescricoesAssinadas().length, 0, 'nada assinado sem função renal');
      if (p.status !== 200) assert.equal(p.body?.codigo, 'SEGURANCA_FICHA_PENDENTE', `recusa esperada pelo SafetyEngine: ${JSON.stringify(p.body)}`);
      return { preparar: p.status, codigo: p.body?.codigo ?? null, recusa: ctx.recusaSemHemograma,
        avisos: p.body?.avisos ?? p.body?.seguranca ?? null };
    }, ['conferida']);

    await prova('S1.1.borda_doses_calculadas_pelas_regras', async () => {
      const itens = ctx.instanciacao?.itens ?? ctx.instanciacao?.edicao?.itens ?? [];
      writeFileSync(join(evid, 'instanciacao.json'), JSON.stringify(ctx.instanciacao, null, 2));
      const achar = nome => itens.map(i => i.item ?? i).find(i => i.drug === nome);
      const pacli = achar('Paclitaxel'), carbo = achar('Carboplatina');
      assert.ok(pacli && carbo, `itens instanciados: ${itens.map(i => (i.item ?? i).drug)}`);
      // Mosteller (70 kg, 170 cm) = 1,82 m² × 200 mg/m² = 364 mg (D-F1-52 não altera inteiro).
      assert.equal(pacli.calculatedDose, 364, `paclitaxel calculado ${pacli.calculatedDose}`);
      // Sem creatinina não há ClCr: dado ausente não vira dose e a pendência fica explícita.
      assert.equal(carbo.calculatedDose, null, `carboplatina sem ClCr: ${carbo.calculatedDose}`);
      assert.ok((ctx.instanciacao.pendencias ?? []).some(p => /clearance|clcr/i.test(p)), 'pendência renal explícita');
      return { paclitaxel: pacli.calculatedDose, carboplatina: carbo.calculatedDose, unidades: [pacli.unit, carbo.unit] };
    }, ['instanciacao']);

    await prova('S1.1.positivo_com_exames_assina_e_reabre_apos_reinicio', async () => {
      confirmar('LabResult', { campo: 'creatinina', valor: 1.0, unidade: 'mg/dL', data: COLETA, sourceId: 'lab-s11-creatinina' }, null);
      confirmar('LabResult', { campo: 'neutrofilos', valor: 3000, unidade: '/µL', data: COLETA, sourceId: 'lab-s11-neutrofilos' }, null);
      confirmar('LabResult', { campo: 'plaquetas', valor: 200000, unidade: '/µL', data: COLETA, sourceId: 'lab-s11-plaquetas' }, null);
      await abrirEditor();
      await usarFicha();
      const inst = page.waitForResponse(x => x.url().includes('instanciar'));
      await cartaoFicha().getByRole('button', { name: 'Usar ficha em rascunho', exact: true }).click();
      const ri2 = await inst; assert.equal(ri2.status(), 200);
      const inst2 = await ri2.json(); writeFileSync(join(evid, 'instanciacao-com-exames.json'), JSON.stringify(inst2, null, 2));
      const carbo2 = inst2.itens.map(i => i.item ?? i).find(i => i.drug === 'Carboplatina');
      // Cockcroft-Gault (56 a, F, 70 kg, Cr 1,0) = 69,42 mL/min; Calvert AUC 6 × (69,42 + 25) = 566,5 mg; D-F1-52 mantém 0,5.
      ctx.carboplatina = carbo2?.calculatedDose ?? null;
      assert.equal(carbo2?.calculatedDose, 566.5, `carboplatina com ClCr: ${carbo2?.calculatedDose} ${JSON.stringify(inst2.pendencias)}`);
      await page.waitForTimeout(1000);
      await preencherPlanejamento();
      const p = await prepararPrevia();
      writeFileSync(join(evid, 'preparar-com-exames.json'), JSON.stringify(p, null, 2));
      assert.equal(p.status, 200, `preparar: ${JSON.stringify(p.body).slice(0, 400)}`);
      const previa = editor().getByRole('region', { name: 'Prévia da prescrição', exact: true });
      await previa.waitFor();
      assert.equal(prescricoesAssinadas().length, 0, 'prévia não assina');
      // Adversarial: o hash enviado na assinatura difere do conteúdo exibido.
      await page.route('**/consulta/prescricao-executavel/confirmar', async route => {
        const corpo = route.request().postDataJSON();
        await route.continue({ postData: JSON.stringify({ ...corpo, conteudoHash: '0'.repeat(64) }) });
      }, { times: 1 });
      const adulterada = page.waitForResponse(x => x.url().endsWith('/consulta/prescricao-executavel/confirmar'));
      await editor().getByRole('button', { name: 'Confirmar e assinar prescrição', exact: true }).click();
      const ra = await adulterada; ctx.adversarial = { status: ra.status(), corpo: await ra.json().catch(() => null) };
      assert.notEqual(ra.status(), 200, 'hash diferente do exibido deve ser recusado');
      assert.equal(prescricoesAssinadas().length, 0, 'adulteração não assina');
      const antesAdm = administracoes().length;
      let botao = editor().getByRole('button', { name: 'Confirmar e assinar prescrição', exact: true });
      if (!(await botao.count()) || !(await botao.isEnabled())) { await prepararPrevia(); botao = editor().getByRole('button', { name: 'Confirmar e assinar prescrição', exact: true }); }
      const real = page.waitForResponse(x => x.url().endsWith('/consulta/prescricao-executavel/confirmar'));
      await botao.click();
      const rr = await real; assert.equal(rr.status(), 200, `assinatura: ${await rr.text()}`);
      ctx.assinadas = eventos().filter(e => e.revisao === 'ASSINADO').map(e => `${e.tipo}:${e.eventId}`).sort();
      assert.ok(ctx.assinadas.length > 0, 'prescrição assinada no ledger');
      assert.equal(administracoes().length, antesAdm, 'assinar não cria administração');
      await demo.app.close(); demo = await fixture.bootServidorDemoB2(dir);
      assert.deepEqual(eventos().filter(e => e.revisao === 'ASSINADO').map(e => `${e.tipo}:${e.eventId}`).sort(), ctx.assinadas, 'mesmo ledger após reinício');
      await abrirEditor();
      const modoReaberto = await editor().getByLabel('Modo do ciclo', { exact: true }).inputValue();
      assert.equal(modoReaberto, 'CICLO_ATUAL', 'ciclo assinado é a base do editor após reinício');
      const itensReabertos = await editor().getByRole('group', { name: /^Item da prescrição/ }).count();
      assert.equal(itensReabertos, 8, 'os 8 itens assinados voltam na reabertura');
      assert.equal(administracoes().length, 0, 'reabrir não cria administração');
      return { adversarial: ctx.adversarial.status, carboplatina: ctx.carboplatina, assinados: ctx.assinadas, modoReaberto, itensReabertos, administracoes: administracoes().length };
    }, ['conferida']);

    await prova('S1.1.sem_erros_de_pagina_nem_requisicoes_externas', async () => {
      assert.deepEqual(externas, []); assert.deepEqual(errosPagina, []); return true;
    });
  } finally {
    writeFileSync(join(evid, 'resultados.json'), JSON.stringify({ evidencias: evid, sqlite: dir, resultados }, null, 2));
    console.log(JSON.stringify({ RESUMO: resultados.map(r => `${r.resultado} ${r.id}`), evidencias: evid }));
    if (resultados.some(r => r.resultado !== 'PASSOU')) process.exitCode = 1;
    await browser?.close();
    try { await demo?.app.close(); } catch { /* já fechado */ }
    await vite?.close();
  }
}
executar().catch(e => { console.error(e); process.exitCode = 1; });
