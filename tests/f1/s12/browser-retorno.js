// Executar pelo playwright-cli run-code --filename; apenas servidor-demo sintético local.
async (page) => {
  const browser = page.context().browser();
  if (!browser || !/^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html/.test(page.url())) throw new Error("DEMO_LOCAL_OBRIGATORIA");
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: ".s12-evidence/videos-retorno" } });
  const p = await contexto.newPage(), video = p.video(), externas = [];
  p.on("request", r => { const u = new URL(r.url()); if (["http:", "https:"].includes(u.protocol) && u.hostname !== "127.0.0.1") externas.push(u.origin); });
  try {
    await p.goto(new URL("/oncoassist.html", page.url()).href);
    await p.getByLabel("Senha do servidor").fill("senha-sintetica-e2e-colon-01");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.getByLabel("Paciente da agenda").selectOption("encontro-s12-retorno-001");
    await p.getByRole("button", { name: "Consulta Flash", exact: true }).waitFor();
    // Início da contagem: paciente/encontro já aberto, como retorno de rotina.
    await p.evaluate(() => { window.__cliquesS12 = []; document.addEventListener("click", e => {
      const el = e.target instanceof Element ? e.target.closest("button,a,input,select") : null;
      if (el) window.__cliquesS12.push(el.getAttribute("aria-label") || el.textContent || el.getAttribute("type"));
    }, true); });
    await p.getByRole("button", { name: "Consulta Flash", exact: true }).click();
    const digitacoes = [["Medicamento da receita", "Pantoprazol"], ["Dose da receita", "40 mg"],
      ["Orientação / posologia da receita", "pela manhã"], ["Duração da receita", "30 dias"],
      ["Outros LAB", "HMG; Cr"], ["Prazo do retorno em dias", "14"]];
    for (const [campo, valor] of digitacoes) await p.getByLabel(campo, { exact: true }).fill(valor);
    await p.getByRole("checkbox", { name: "Incluir receita digitada", exact: true }).check();
    await p.getByRole("button", { name: "Revisar documentos para assinatura", exact: true }).click();
    const preview = p.getByRole("region", { name: "Conteúdo para assinatura", exact: true });
    await preview.waitFor();
    const texto = await preview.innerText();
    for (const literal of ["Pantoprazol", "40 mg", "pela manhã", "30 dias", "HMG", "Cr", "14 dias", "Via: PENDENTE", "Quantidade: PENDENTE"])
      if (!texto.includes(literal)) throw new Error(`PREVIA_INCOMPLETA:${literal}`);
    const pedidos = preview.locator("article").filter({ has: p.getByRole("heading", { name: "Pedido de laboratório · versão 1", exact: true }) });
    if (await pedidos.count() !== 1) throw new Error("PEDIDO_LABORATORIAL_UNICO_AUSENTE");
    const exames = [...(await pedidos.innerText()).matchAll(/^Exame: (.+)$/gm)].map(m => m[1].trim());
    if (JSON.stringify(exames.sort()) !== JSON.stringify(["Cr", "HMG"])) throw new Error("PEDIDOS_LOGICOS_DIVERGENTES");
    const assinatura = p.waitForResponse(r => r.url().endsWith("/consulta/confirmar"));
    const impressao = p.waitForResponse(r => r.url().endsWith("/acao"));
    await p.getByRole("button", { name: "Confirmar e assinar conteúdo exibido", exact: true }).click();
    const assinaturaR = await assinatura, impressaoR = await impressao;
    const confirmacao = await assinaturaR.json(), impresso = await impressaoR.json();
    if (assinaturaR.status() !== 200 || confirmacao.codigo !== "GRAVADA" || impressaoR.status() !== 200 || impresso.decisao !== "EXECUTADA")
      throw new Error("ASSINATURA_OU_IMPRESSAO_NAO_EXECUTADA");
    await p.getByRole("button", { name: "Reabrir histórico", exact: true }).click();
    const historico = p.getByRole("region", { name: "Histórico de documentos assinados", exact: true });
    await historico.getByRole("button", { name: /Reimprimir versão 1.*Receita/i }).waitFor();
    const cliques = await p.evaluate(() => window.__cliquesS12);
    if (cliques.length > 5) throw new Error(`CLIQUE_EXCEDIDO:${cliques.length}`);
    if (externas.length) throw new Error("EGRESSO_EXTERNO_NA_DEMO");
    await p.screenshot({ path: ".s12-evidence/retorno-assinado.png", fullPage: true });
    const resultado = { caso: "retorno-canonico-sintetico", cliques, quantidadeCliques: cliques.length,
      escopoContagem: "consulta já aberta até reabrir histórico após assinatura; login e seleção de paciente fora da contagem",
      preenchimentosProgramaticos: digitacoes.length, metodoPreenchimento: "Playwright locator.fill; não mede esforço total de digitação", exames, textoExibido: texto, documentos: await historico.locator("article").count(),
      assinatura: confirmacao.codigo, impressao: impresso.decisao, chamadasExternasDaPagina: externas.length };
    await contexto.close();
    return { ...resultado, video: await video.path() };
  } catch (erro) { await contexto.close(); throw erro; }
}
