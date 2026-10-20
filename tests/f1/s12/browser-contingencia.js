import assert from 'node:assert/strict';
import {join} from 'node:path';

/** Caso sintético no app real: folha operacional não libera nem administra QT. */
export async function jornadaContingenciaNoNavegador(page,{manifesto,efeitos,contarEventosClinicos,evidenceDir}){
 const antes=efeitos(),clinicosAntes=contarEventosClinicos();
 async function abrirSalao(){
  await page.getByRole('button',{name:'Salão',exact:true}).click();
  await page.getByLabel('Paciente em triagem',{exact:true}).selectOption(manifesto.b2.patientId);
  await page.getByLabel('Resumo operacional informado pelo médico',{exact:true}).waitFor();
 }
 await abrirSalao();
 await page.getByLabel('Resumo operacional informado pelo médico',{exact:true}).fill('Resumo exclusivamente sintético para contingência local.');
 const salvo=page.waitForResponse(r=>r.url().endsWith('/consulta/salao/contingencia/gerar'));
 await page.getByRole('button',{name:'Conferir e gravar folha operacional',exact:true}).click();
 const resposta=await salvo;assert.equal(resposta.status(),200);
 const {folha}=await resposta.json();
 assert.match(folha.folhaId,/^folha-[a-f0-9]{64}$/);
 assert.equal(folha.patientId,manifesto.b2.patientId);assert.equal(folha.encounterId,manifesto.b2.encounterId);
 const frame=()=>page.frameLocator('iframe[title="Folha operacional persistida"]');
 await frame().getByText(`Identificador: ${manifesto.b2.patientId}`,{exact:true}).waitFor();
 await frame().getByText(`Encontro: ${manifesto.b2.encounterId}`,{exact:true}).waitFor();
 assert.equal(await page.locator('iframe[title="Folha operacional persistida"]').getAttribute('srcdoc'),folha.htmlImprimivel);
 await page.getByRole('button',{name:'Canal',exact:true}).click();
 await page.getByRole('region',{name:'Caixa do canal'}).waitFor();
 await abrirSalao();
 await page.locator(`[data-folha-id="${folha.folhaId}"]`).click();
 await frame().getByText(`Identificador: ${manifesto.b2.patientId}`,{exact:true}).waitFor();
 assert.equal(await page.locator('iframe[title="Folha operacional persistida"]').getAttribute('srcdoc'),folha.htmlImprimivel);
 assert.equal(efeitos(),antes);
 assert.equal(contarEventosClinicos(),clinicosAntes);
 await page.screenshot({path:join(evidenceDir,'f3-contingencia-local.png'),fullPage:true});
 return {identidadeDoServidor:true,folhaPersistida:true,previewLocal:true,reabertaNaInterface:true,semEnvioExterno:true,naoLiberaTratamento:true};
}
