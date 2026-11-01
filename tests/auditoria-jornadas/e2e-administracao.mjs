// S1.2/S1.3 — prescrito → administrado no perfil MEDICO. Continua do estado assinado da S1.1
// (mesmo backend, mesmo SQLite): registro explícito, administração parcial com reação infusional
// e justificativa, reinício, e semáforo vermelho com o motivo no encontro seguinte.
import assert from 'node:assert/strict';
import { executar } from './e2e-prescricao.mjs';

const JUSTIFICATIVA = 'SINTETICO: reação infusional aos 40 min; infusão suspensa; conduta médica registrada.';
const ENCONTRO_SEGUINTE = 'encontro-s13-retorno-sintetico';

await executar({
  prefixo: 'auditoria-administracao-evid-',
  aposAssinatura: async ({ page, demo, reiniciar, confirmar, DATA, prova, ctx, eventos, administracoes, abrirEditor, b2 }) => {
    const regiao = () => page.getByRole('region', { name: 'Administração do ciclo', exact: true });
    const registradas = () => eventos().filter(e => e.tipo === 'TreatmentAdministration').map(e => e.payload?.data?.data ?? e.payload?.data ?? e.payload);

    await prova('S1.2.prescricao_assinada_nao_vira_administracao', async () => {
      const setores = page.getByRole('region', { name: 'Setores da clínica', exact: true });
      await setores.getByText('Nenhuma administração efetiva registrada nesta consulta.', { exact: true }).waitFor();
      assert.equal(administracoes().length, 0, 'ledger sem TreatmentAdministration');
      return { administracoes: 0 };
    }, ['assinadas']);

    await prova('S1.3.parcial_com_reacao_exige_justificativa_e_registra', async () => {
      await regiao().getByRole('button', { name: 'Registrar administração de Paclitaxel', exact: true }).click();
      const f = regiao().getByRole('group', { name: 'Administração de Paclitaxel', exact: true });
      await f.getByLabel('Situação da administração', { exact: true }).selectOption('PARCIAL');
      await f.getByLabel('Quantidade administrada (mg)', { exact: true }).fill('200');
      await f.getByLabel('Início da administração', { exact: true }).fill(`${DATA}T09:00`);
      await f.getByLabel('Fim da administração', { exact: true }).fill(`${DATA}T09:40`);
      await f.getByLabel('Reação infusional', { exact: true }).check();
      const confirmarBtn = f.getByRole('button', { name: 'Confirmar administração registrada', exact: true });
      assert.equal(await confirmarBtn.isDisabled(), true, 'sem justificativa não registra');
      await f.getByLabel('Justificativa da administração', { exact: true }).fill(JUSTIFICATIVA);
      const resp = page.waitForResponse(x => x.url().endsWith('/salao/registrar-administracao'));
      await confirmarBtn.click();
      const r = await resp; assert.ok([200, 201].includes(r.status()), `registro: ${r.status()} ${await r.text()}`);
      const setores = page.getByRole('region', { name: 'Setores da clínica', exact: true });
      await setores.getByText(/PARCIAL · Paclitaxel: 200 mg efetivamente administrados. Reação infusional./).waitFor();
      const p = registradas().find(a => a.droga === 'Paclitaxel');
      assert.equal(p?.status, 'PARCIAL'); assert.equal(p?.reacaoInfusional, true); assert.equal(p?.motivo, JUSTIFICATIVA);
      assert.equal(p?.quantidadeEfetivaMg, 200, 'quantidade administrada é a informada, não a prescrita');
      ctx.parcial = true;
      return { status: p.status, reacao: p.reacaoInfusional, mg: p.quantidadeEfetivaMg };
    }, ['assinadas']);

    await prova('S1.3.completa_sem_justificativa_registra', async () => {
      await regiao().getByRole('button', { name: 'Registrar administração de Carboplatina', exact: true }).click();
      const f = regiao().getByRole('group', { name: 'Administração de Carboplatina', exact: true });
      await f.getByLabel('Situação da administração', { exact: true }).selectOption('COMPLETA');
      await f.getByLabel('Quantidade administrada (mg)', { exact: true }).fill('566,5');
      await f.getByLabel('Início da administração', { exact: true }).fill(`${DATA}T10:00`);
      await f.getByLabel('Fim da administração', { exact: true }).fill(`${DATA}T11:00`);
      const resp = page.waitForResponse(x => x.url().endsWith('/salao/registrar-administracao'));
      await f.getByRole('button', { name: 'Confirmar administração registrada', exact: true }).click();
      assert.ok([200, 201].includes((await resp).status()));
      await page.getByRole('region', { name: 'Setores da clínica', exact: true }).getByText(/COMPLETA · Carboplatina: 566.5 mg/).waitFor();
      const c = registradas().find(a => a.droga === 'Carboplatina');
      assert.equal(c?.status, 'COMPLETA'); assert.equal(c?.quantidadeEfetivaMg, 566.5);
      return { status: c.status, mg: c.quantidadeEfetivaMg };
    }, ['parcial']);

    await prova('S1.3.reinicio_recupera_e_nao_alerta_no_mesmo_encontro', async () => {
      const antes = registradas().map(a => a.adminId).sort();
      await reiniciar(); await abrirEditor();
      assert.deepEqual(registradas().map(a => a.adminId).sort(), antes, 'mesmas administrações após reinício');
      const setores = page.getByRole('region', { name: 'Setores da clínica', exact: true });
      await setores.getByText(/Paclitaxel/).first().waitFor();
      assert.equal(await page.getByRole('button', { name: /Intercorrência na administração anterior/ }).count(), 0,
        'o semáforo é para o encontro seguinte, não para o próprio');
      ctx.reiniciado = true;
      return { administracoes: antes.length };
    }, ['parcial']);

    await prova('S1.3.encontro_seguinte_semaforo_vermelho_modal_com_motivo', async () => {
      confirmar('AgendaEntry', { patientId: b2.patientId, encounterId: ENCONTRO_SEGUINTE, data: DATA, horario: '16:30' }, null, ENCONTRO_SEGUINTE);
      await page.goto(new URL('/oncoassist.html', page.url()).href);
      await page.getByLabel('Senha do servidor').fill(demo().manifesto.senhaDemo);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      const agenda = page.getByRole('region', { name: 'Agenda médica', exact: true });
      await agenda.waitFor();
      await agenda.locator('li').filter({ hasText: '16:30' }).filter({ hasText: b2.nome })
        .getByRole('button', { name: `Abrir consulta de ${b2.nome}`, exact: true }).click();
      await page.getByRole('region', { name: 'Consulta persistida', exact: true }).waitFor();
      const ativo = await page.getByLabel('Contexto médico ativo').innerText();
      assert.ok(ativo.includes(ENCONTRO_SEGUINTE), `encontro ativo: ${ativo}`);
      const semaforo = page.getByRole('button', { name: /Intercorrência na administração anterior \(1\)/ });
      await semaforo.waitFor();
      await semaforo.click();
      const modal = page.getByRole('dialog', { name: 'Motivo da intercorrência na administração', exact: true });
      await modal.waitFor();
      const texto = await modal.innerText();
      assert.ok(texto.includes(JUSTIFICATIVA), 'modal mostra a justificativa registrada');
      assert.ok(texto.includes('Paclitaxel') && /reação infusional/i.test(texto) && texto.includes('Parcial'));
      assert.ok(!texto.includes('Carboplatina'), 'administração completa sem reação não alerta');
      await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
      await modal.waitFor({ state: 'detached' });
      return { encontro: ENCONTRO_SEGUINTE, semaforo: true };
    }, ['reiniciado']);
  },
});
