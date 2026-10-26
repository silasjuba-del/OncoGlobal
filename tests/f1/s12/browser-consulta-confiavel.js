import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const TEXTO_FONTE_CONFIAVEL = 'SINTETICO: nega febre. Achado pulmonar incerto, A CONFERIR.';
const TEXTO_MEDICO = 'Registro SINTETICO do medico: nega febre; achado incerto permanece A CONFERIR.';

function diferido() {
  let resolver;
  const promessa = new Promise(resolve => { resolver = resolve; });
  return { promessa, resolver };
}

async function dentroDoPrazo(promessa, codigo, ms = 30_000) {
  let timer;
  try {
    return await Promise.race([promessa, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(codigo)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** UI real + HTTP real + SQLite real. Rotas interceptadas somente para falha/latência de transporte. */
export async function jornadaConsultaConfiavel(page, { manifesto, pdf, lerEventos, reiniciar, evidenceDir }) {
  const ctx = manifesto.consultaConfiavel;
  const url = new URL('/oncoassist.html', page.url()).href;
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html$/);
  page.setDefaultTimeout(30_000);
  const errosPagina = [];
  page.on('pageerror', erro => errosPagina.push(erro.message));
  const entrar = async () => {
    await page.goto(url);
    await page.getByLabel('Senha do servidor').fill(manifesto.senhaDemo);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByLabel('Paciente da agenda').selectOption(ctx.encounterId);
    await page.getByRole('button', { name: 'Consulta Flash', exact: true }).waitFor();
  };
  const abrirGrupo = async (nome) => {
    const botao = page.getByRole('button', { name: nome });
    if (await botao.getAttribute('aria-expanded') === 'false') await botao.click();
  };
  const assinados = () => lerEventos().filter(e => e.tipo === 'DOCUMENTO' && e.revisao === 'ASSINADO');
  await entrar();
  assert.equal(assinados().length, 0);
  await abrirGrupo(/Captura & Entrada única/);
  await page.getByLabel('Documento local', { exact: true }).setInputFiles({ name: 'consulta-confiavel-SINTETICO.pdf', mimeType: 'application/pdf', buffer: pdf });
  const uploadPendente = page.waitForResponse(r => r.url().endsWith('/consulta/upload'));
  await page.getByRole('button', { name: 'Converter e revisar', exact: true }).click();
  const upload = await uploadPendente;
  assert.equal(upload.status(), 201);
  const convertido = await upload.json();
  assert.equal(convertido.conversionStatus, 'PRONTO');
  await abrirGrupo(/Revisão de fontes & Alertas RADS/);
  await page.getByLabel('Trecho sem vínculo', { exact: true }).selectOption(convertido.draftId);
  const vinculoPendente = page.waitForResponse(r => r.url().endsWith('/consulta/rascunho/revisar'));
  await page.getByRole('button', { name: `Confirmar vínculo deste trecho com ${ctx.nome} · ${ctx.patientId}`, exact: true }).click();
  assert.equal((await vinculoPendente).status(), 200);
  await page.getByRole('button', { name: /^Confirmar vínculo deste trecho/ }).waitFor({ state: 'detached' });
  const leituraPendente = page.waitForResponse(r => r.url().endsWith('/consulta/rascunho') && r.request().postDataJSON()?.draftId === convertido.draftId);
  await page.getByLabel('Fonte para revisão', { exact: true }).selectOption(convertido.draftId);
  const fonte = (await (await leituraPendente).json()).draft;
  const sourceId = fonte.payload.input.sourceId;
  await page.getByRole('region', { name: 'Fonte original vinculada', exact: true }).getByText(`Fonte ${sourceId}`, { exact: true }).waitFor();
  assert.ok((await page.getByRole('region', { name: 'Fonte original vinculada', exact: true }).innerText()).includes(TEXTO_FONTE_CONFIAVEL));
  await page.getByRole('checkbox', { name: 'Incluir texto original deste trecho na evolução', exact: true }).check();
  await page.getByRole('button', { name: 'Preparar revisão', exact: true }).click();
  await page.getByRole('region', { name: 'Conteúdo preparado para revisão', exact: true }).waitFor();
  const revisaoPendente = page.waitForResponse(r => r.url().endsWith('/consulta/rascunho/revisar'));
  await page.getByRole('button', { name: 'Confirmar revisão exibida', exact: true }).click();
  assert.equal((await revisaoPendente).status(), 200);
  await page.getByText('Revisão registrada. Candidatos incertos conservam sua pendência.', { exact: true }).waitFor();
  assert.equal(assinados().length, 0, 'revisar fonte não assina documentos');

  await page.getByRole('button', { name: 'Consulta Flash', exact: true }).click();
  await page.getByText('Encaminhamentos, laudos e orientações', { exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar laudo', exact: true }).click();
  const texto = page.getByLabel('Conteúdo do documento 1', { exact: true });
  await texto.fill(TEXTO_MEDICO);
  const salvar = page.getByRole('button', { name: 'SALVAR RASCUNHO', exact: true });
  await page.route('**/consulta/flash/rascunho', route => route.abort('connectionfailed'), { times: 1 });
  await salvar.click();
  await page.getByText(/Operação não concluída/).waitFor();
  assert.equal(await texto.inputValue(), TEXTO_MEDICO, 'falha de rede preserva edição');
  assert.equal(assinados().length, 0);

  const chegou = diferido(), liberar = diferido();
  let salvamentos = 0;
  const atrasarSalvamento = async route => {
    salvamentos++;
    const response = await route.fetch();
    chegou.resolver();
    await liberar.promessa;
    await route.fulfill({ response });
  };
  await page.route('**/consulta/flash/rascunho', atrasarSalvamento);
  try {
    await salvar.click();
    await dentroDoPrazo(chegou.promessa, 'SALVAMENTO_NAO_CHEGOU_AO_SERVIDOR');
    assert.equal(await salvar.isDisabled(), true, 'resposta atrasada mantém ação ocupada');
    // Tentativas repetidas no controle real enquanto a resposta HTTP está retida.
    await salvar.dispatchEvent('click');
    await salvar.dispatchEvent('click');
    liberar.resolver();
    await page.getByText('Rascunho salvo; sem assinatura.', { exact: true }).waitFor();
    assert.equal(salvamentos, 1, 'repetição não duplica salvamento em curso');
    assert.equal(await texto.inputValue(), TEXTO_MEDICO);
  } finally {
    liberar.resolver();
    await page.unroute('**/consulta/flash/rascunho', atrasarSalvamento);
  }

  await entrar();
  await page.getByRole('button', { name: 'Consulta Flash', exact: true }).click();
  await page.getByText('Encaminhamentos, laudos e orientações', { exact: true }).click();
  assert.equal(await page.getByLabel('Conteúdo do documento 1', { exact: true }).inputValue(), TEXTO_MEDICO);
  assert.equal(assinados().length, 0, 'reabrir rascunho não assina');
  await page.getByRole('button', { name: 'Revisar documentos para assinatura', exact: true }).click();
  const previa = page.getByRole('region', { name: 'Conteúdo para assinatura', exact: true });
  await previa.waitFor();
  const conteudoExibido = await previa.innerText();
  assert.ok(conteudoExibido.includes(TEXTO_FONTE_CONFIAVEL), 'negação e incerteza da fonte preservadas na prévia');
  assert.ok(conteudoExibido.includes(TEXTO_MEDICO), 'texto médico exibido antes de assinar');
  assert.equal(assinados().length, 0, 'preparar e exibir a prévia não assina documentos');
  const assinaturaChegou = diferido(), liberarAssinatura = diferido();
  let confirmacoes = 0;
  const atrasarAssinatura = async route => {
    confirmacoes++;
    const response = await route.fetch();
    assinaturaChegou.resolver();
    await liberarAssinatura.promessa;
    await route.fulfill({ response });
  };
  await page.route('**/consulta/confirmar', atrasarAssinatura);
  try {
    const respostaAssinatura = page.waitForResponse(r => r.url().endsWith('/consulta/confirmar'));
    const confirmar = previa.getByRole('button', { name: 'Confirmar e assinar conteúdo exibido', exact: true });
    await confirmar.click();
    await dentroDoPrazo(assinaturaChegou.promessa, 'ASSINATURA_NAO_CHEGOU_AO_SERVIDOR');
    assert.equal(await confirmar.isDisabled(), true);
    await confirmar.dispatchEvent('click');
    await confirmar.dispatchEvent('click');
    liberarAssinatura.resolver();
    const resposta = await respostaAssinatura;
    assert.equal(resposta.status(), 200);
    assert.equal((await resposta.json()).codigo, 'GRAVADA');
    assert.equal(confirmacoes, 1, 'dupla confirmação não repete a operação HTTP');
  } finally {
    liberarAssinatura.resolver();
    await page.unroute('**/consulta/confirmar', atrasarAssinatura);
  }
  const historico = page.getByRole('region', { name: 'Histórico de documentos assinados', exact: true });
  await historico.getByText(TEXTO_MEDICO, { exact: false }).first().waitFor();
  const eventosAntes = assinados();
  assert.ok(eventosAntes.length > 0);
  const idsAntes = eventosAntes.map(e => e.eventId).sort();
  assert.ok(idsAntes.every(id => typeof id === 'string' && id.length > 0));
  assert.equal(new Set(idsAntes).size, idsAntes.length);
  const hashAntes = createHash('sha256').update(JSON.stringify(eventosAntes)).digest('hex');
  assert.ok(JSON.stringify(lerEventos()).includes(sourceId), 'referência da fonte existe no ledger');
  await page.screenshot({ path: join(evidenceDir, 'consulta-confiavel-assinada.png'), fullPage: true });
  await reiniciar();
  await entrar();
  await historico.getByText(TEXTO_MEDICO, { exact: false }).first().waitFor();
  assert.ok((await historico.innerText()).includes(TEXTO_FONTE_CONFIAVEL));
  assert.deepEqual(assinados().map(e => e.eventId).sort(), idsAntes, 'reabertura não duplica assinatura');
  assert.equal(createHash('sha256').update(JSON.stringify(assinados())).digest('hex'), hashAntes, 'mesmos bytes lógicos após reinício SQLite');
  assert.ok(JSON.stringify(lerEventos()).includes(sourceId));
  await abrirGrupo(/Revisão de fontes & Alertas RADS/);
  await page.getByLabel('Fonte para revisão', { exact: true }).selectOption(convertido.draftId);
  const fonteReaberta = page.getByRole('region', { name: 'Fonte original vinculada', exact: true });
  await fonteReaberta.getByText(`Fonte ${sourceId}`, { exact: true }).waitFor();
  const textoFonteReaberta = await fonteReaberta.innerText();
  assert.ok(textoFonteReaberta.includes(TEXTO_FONTE_CONFIAVEL), 'texto original reabre pela interface');
  assert.ok(textoFonteReaberta.includes('data clinica 2026-10-09'), 'data clínica literal permanece visível na fonte original');
  assert.ok(textoFonteReaberta.includes('Trecho vinculado explicitamente:'), 'proveniência mantém o vínculo explícito após reinício');
  assert.deepEqual(errosPagina, []);
  return { paciente: ctx.patientId, fonte: sourceId, draftId: convertido.draftId, negacaoIncertezaPreservadas: true,
    falhaRedePreservouTexto: true, salvamentosDuranteReentrada: salvamentos, rascunhoReaberto: true,
    assinaturaExplicita: true, previaSemAssinatura: true, fonteReabertaComDataEVinculo: true,
    confirmacoesDuranteReentrada: confirmacoes, documentosReabertos: idsAntes.length, hashDocumentos: hashAntes, reinicioMesmoSqlite: true };
}
