import assert from 'node:assert/strict';

/** Fluxo real da interface; fonte e paciente exclusivamente sintéticos no servidor da demo. */
export async function jornadaReceitaNoNavegador(page,{senha,encounterId,lerAssinados}){
  page.setDefaultTimeout(30_000);
  const entrar=async()=>{
    await page.getByLabel('Senha do servidor').fill(senha);
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByLabel('Paciente da agenda').selectOption(encounterId);
    await page.getByRole('region',{name:'Consulta persistida',exact:true}).waitFor();
  };
  const abrir=()=>page.getByRole('button',{name:'Consulta Flash',exact:true}).click();
  await abrir();
  await page.getByLabel('Medicamento da receita',{exact:true}).fill('Medicamento sintético navegador');
  await page.getByLabel('Medicamento da receita',{exact:true}).press('Tab');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Dose da receita"]')?.value==='25 mg');
  assert.equal(lerAssinados().length,0);
  await page.getByRole('checkbox',{name:'Incluir receita digitada',exact:true}).check();
  await page.getByLabel('Dose da receita',{exact:true}).fill('PENDENTE');
  assert.equal(await page.getByRole('button',{name:'Revisar documentos para assinatura',exact:true}).isDisabled(),true);
  const salva=page.waitForResponse(r=>r.url().endsWith('/consulta/flash/rascunho'));
  await page.getByRole('button',{name:'SALVAR RASCUNHO',exact:true}).click();
  assert.equal((await salva).status(),201);
  await page.reload();await entrar();await abrir();
  assert.equal(await page.getByLabel('Dose da receita',{exact:true}).inputValue(),'PENDENTE');
  assert.equal(lerAssinados().length,0);
  await page.getByLabel('Medicamento da receita',{exact:true}).focus();
  await page.getByLabel('Medicamento da receita',{exact:true}).press('Tab');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Dose da receita"]')?.value==='25 mg');
  await page.getByRole('button',{name:'Revisar documentos para assinatura',exact:true}).click();
  const previa=page.getByRole('region',{name:'Conteúdo para assinatura',exact:true});await previa.waitFor();
  assert.match(await previa.textContent(),/Fonte sintética navegador/);
  assert.match(await previa.textContent(),/Condição sintética preservada/);
  assert.equal(lerAssinados().length,0);
  const assina=page.waitForResponse(r=>r.url().endsWith('/consulta/confirmar'));
  await previa.getByRole('button',{name:'Confirmar e assinar conteúdo exibido',exact:true}).click();
  assert.equal((await assina).status(),200);
  assert.ok(lerAssinados().length>0);
  await page.reload();await entrar();
  const historico=page.getByRole('region',{name:'Histórico de documentos assinados',exact:true});
  await historico.getByText(/25 mg/).first().waitFor();
  return {rascunhoPendenteReaberto:true,propostaComUnidade:true,assinaturaExplicita:true,historicoReaberto:true};
}
