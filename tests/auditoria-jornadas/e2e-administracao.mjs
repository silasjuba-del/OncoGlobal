// S1.2 — prescrito ≠ administrado, no perfil MEDICO. Continua do estado assinado da S1.1
// (mesmo backend, mesmo SQLite) e procura a administração efetiva pela entrada operacional.
import assert from 'node:assert/strict';
import { executar } from './e2e-prescricao.mjs';

await executar({
  prefixo: 'auditoria-administracao-evid-',
  aposAssinatura: async ({ page, prova, ctx, administracoes, b2 }) => {
    const nav = () => page.getByRole('navigation', { name: 'Áreas clínicas', exact: true });

    await prova('S1.2.prescricao_assinada_nao_vira_administracao', async () => {
      const setores = page.getByRole('region', { name: 'Setores da clínica', exact: true });
      await setores.waitFor();
      await setores.getByText('Nenhuma administração efetiva registrada nesta consulta.', { exact: true }).waitFor();
      assert.equal(administracoes().length, 0, 'ledger sem TreatmentAdministration');
      return { administracoes: 0 };
    }, ['assinadas']);

    await prova('S1.2.salao_abre_com_o_paciente_da_prescricao', async () => {
      await nav().getByRole('button', { name: 'Salão', exact: true }).click();
      const salao = page.getByRole('region', { name: 'Salão', exact: true });
      await salao.waitFor();
      const opcoes = await page.getByLabel('Paciente em triagem', { exact: true }).locator('option').allTextContents();
      assert.ok(opcoes.some(o => o.includes(b2.patientId)), `paciente fora do salão: ${opcoes}`);
      ctx.salaoAberto = true;
      return { pacientes: opcoes.length };
    }, ['assinadas']);

    await prova('S1.2.administracao_efetiva_registravel_pela_entrada_operacional', async () => {
      // Esperado: uma ação explícita do profissional registra a administração, distinta da prescrição.
      const controles = await page.getByRole('button', { name: /administra/i }).allTextContents();
      assert.ok(controles.length > 0,
        'nenhum controle de administração efetiva no Salão; a rota /salao/registrar-administracao existe só no servidor');
      return { controles };
    }, ['salaoAberto']);
  },
});
