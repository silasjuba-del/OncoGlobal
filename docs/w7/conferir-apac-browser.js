async(page)=>{
 await page.goto('http://127.0.0.1:4180/?tab=docs');
 const form=()=>page.locator('form:has(input[value="preview-document"])').filter({visible:true});
 await form().locator('[name=templateId]').selectOption('apac-laudo');
 await form().getByRole('button',{name:'Pré-visualizar documento'}).click();
 await form().getByRole('button',{name:'Abrir pré-visualização revisável'}).click();
 const path=await page.locator('iframe').getAttribute('src');
 await page.goto('http://127.0.0.1:4180'+path);
 await page.setViewportSize({width:900,height:1200});
 await page.screenshot({path:'docs/w7/kit-preview/apac-html.png',fullPage:true});
}
