async(page)=>{
 const checks=[];const ok=(v,m)=>{if(!v)throw Error(m);checks.push(m)};
 const f=action=>page.locator('form:has(input[name="action"][value="'+action+'"])').filter({visible:true});
 await page.goto('http://127.0.0.1:4180/?tab=pesquisa');
 await page.locator('#study-file').setInputFiles('C:/Users/silas/Projects/OncoGlobal-wt/w7-codex/docs/w7/exemplo-estudo.json');
 await page.locator('.file-status').filter({hasText:'Texto lido localmente'}).waitFor();
 await f('study-import').getByRole('button',{name:'Incorporar e resumir localmente'}).click();
 ok(await page.getByRole('heading',{name:'ESTUDO FICTÍCIO — demonstração local',exact:true}).isVisible(),'upload real pelo navegador e extração com fonte');
 const review=f('study-review');const ops=review.locator('select[name^="op:"]');
 for(let i=0;i<2;i++){await ops.nth(i).selectOption('EQUALS');await review.locator('input[name^="key:"]').nth(i).fill(i===0?'marcador':'impedimento');await review.locator('input[name^="value:"]').nth(i).fill('presente');}
 await review.locator('[name=confirm]').check();await review.getByRole('button',{name:/Confirmar critérios/}).click();
 ok((await page.locator('main').innerText()).includes('Versões médicas: 1'),'critérios revisados geram versão');
 for(const [key,value] of [['marcador','presente'],['impedimento','ausente']]){
  await page.locator('main details').filter({has:page.locator('summary').filter({hasText:'Dados do paciente para seleção'})}).locator('summary').click();
  const fact=f('patient-fact');await fact.locator('[name=factKey]').fill(key);await fact.locator('[name=factValue]').fill(value);await fact.locator('[name=factSource]').fill('Registro manual sintético');await fact.locator('[name=confirm]').check();await fact.getByRole('button',{name:'Confirmar dado no workspace'}).click();
 }
 ok((await page.locator('main').innerText()).includes('POSSIBLE_MATCH'),'cruzamento gera oportunidade sem elegibilidade automática');
 const enroll=f('enroll');await enroll.locator('[name=assignmentSource]').fill('Fonte fictícia da alocação');await enroll.locator('[name=confirm]').check();await enroll.getByRole('button',{name:'Registrar vínculo ao braço'}).click();
 const event=f('followup');await event.locator('[name=kind]').selectOption('IMAGING');await event.locator('[name=eventSource]').fill('Laudo fictício');await event.locator('[name=modality]').fill('TC');await event.locator('[name=description]').fill('Sem derrame; achado indeterminado descrito, sem conclusão automática.');await event.locator('[name=confirm]').check();await event.getByRole('button',{name:'Confirmar evento de seguimento'}).click();
 ok((await page.locator('.timeline-item').innerText()).includes('Sem derrame'),'imagem seriada preserva negação e fonte');
 await page.goto('http://127.0.0.1:4180/?tab=docs');const preview=f('preview-document');await preview.locator('[name=templateId]').selectOption('receita-sintomaticos');await preview.getByRole('button',{name:'Pré-visualizar documento'}).click();
 const selection=f('preview-document');ok(await selection.locator('[name=item]').count()>5,'receita tem itens individuais selecionáveis');await selection.locator('[name=item]').first().uncheck();await selection.getByRole('button',{name:'Abrir pré-visualização revisável'}).click();
 const frame=page.frameLocator('iframe');ok(await frame.getByText('RASCUNHO — NÃO VÁLIDO',{exact:true}).isVisible(),'receita não assinada é rascunho');ok(await frame.getByText('PANTOPRAZOL 20 mg',{exact:true}).count()===0,'item desmarcado não imprime');
 await page.goto('http://127.0.0.1:4180/?tab=docs');await f('preview-document').locator('[name=templateId]').selectOption('apac-laudo');await f('preview-document').getByRole('button',{name:'Pré-visualizar documento'}).click();await f('preview-document').getByRole('button',{name:'Abrir pré-visualização revisável'}).click();ok(await page.frameLocator('iframe').getByText('RASCUNHO — NÃO VÁLIDO',{exact:true}).isVisible(),'laudo APAC abre em pré-visualização');
 await page.goto('http://127.0.0.1:4180/?tab=cockpit');
 for(const width of [375,762,1041,1440]){await page.setViewportSize({width,height:1000});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'cockpit responsivo '+width)}
 await page.evaluate(r=>window.__browserChecks=r,checks);
}
