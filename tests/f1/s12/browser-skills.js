import assert from 'node:assert/strict';
import {join} from 'node:path';

/** Laudo já vinculado pela jornada anterior; UI, HTTP e SQLite reais. */
export async function jornadaSkillsNoNavegador(page,{manifesto,lerEventos,evidenceDir}) {
  const antes=lerEventos().map(e=>e.eventId).sort();
  await page.getByRole('button',{name:'Jornada por skills',exact:true}).click();
  const painel=page.getByRole('region',{name:'Jornada clínica por skills',exact:true});
  await painel.getByRole('group',{name:'Laudos e exames vinculados',exact:true}).getByRole('checkbox').first().check();
  await painel.getByLabel('Cenários de pulmão',{exact:true}).selectOption(['PUL-26']);
  await painel.getByLabel('Ações da jornada',{exact:true}).selectOption(['EX-08','EN-01']);
  const resposta=page.waitForResponse(r=>r.url().endsWith('/consulta/skills')&&r.request().postDataJSON()?.acao==='EXECUTAR');
  await painel.getByRole('button',{name:'Preparar rascunhos da jornada',exact:true}).click();
  const http=await resposta;assert.equal(http.status(),200);const r=await http.json();
  assert.equal(r.codigo,'SKILL_PREPARADA');assert.equal(r.execucao.jornada.cartoes[0].id,'PUL-26');
  assert.equal(r.execucao.jornada.autorizaTratamento,false);
  await painel.getByText('Rascunhos preparados — revisão médica pendente.',{exact:true}).waitFor();
  await painel.getByText('Pedidos de exames — preparação para revisão',{exact:true}).click();
  assert.ok((await painel.innerText()).includes('EX-08'));
  assert.deepEqual(lerEventos().map(e=>e.eventId).sort(),antes,'skill não escreve fatos, pedidos assinados ou administrações');
  const execucaoId=r.execucao.execucaoId;
  await page.goto(new URL('/oncoassist.html',page.url()).href);
  await page.getByLabel('Senha do servidor').fill(manifesto.senhaDemo);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByLabel('Paciente da agenda').selectOption(manifesto.consultaConfiavel.encounterId);
  await page.getByRole('button',{name:'Jornada por skills',exact:true}).click();
  const leitura=page.waitForResponse(r=>r.url().endsWith('/consulta/skills')&&r.request().postDataJSON()?.acao==='LER');
  await page.getByRole('button',{name:'Reabrir jornada',exact:true}).first().click();
  const rec=await(await leitura).json();assert.equal(rec.execucao.execucaoId,execucaoId);
  assert.deepEqual(rec.documentos,r.documentos);assert.equal(rec.validade,'ATUAL');
  await page.screenshot({path:join(evidenceDir,'jornada-skills-reaberta.png'),fullPage:true});
  return {primeiraConsulta:true,corpusComFonte:true,pedidosSomenteRascunho:true,reaberturaIdentica:true,semEventoClinico:true};
}
