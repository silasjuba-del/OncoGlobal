// Verificação visual/geométrica complementar, sem confirmar fatos ou documentos.
async (page) => {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html/.test(page.url())) throw new Error("DEMO_LOCAL_OBRIGATORIA");
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(), medidas = [];
  try {
    await p.goto(new URL("/oncoassist.html", page.url()).href);
    await p.getByLabel("Senha do servidor").fill("senha-sintetica-e2e-colon-01");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.getByLabel("Paciente da agenda").selectOption("encontro-e2e-colon-retorno-001");
    await p.getByRole("button", { name: "Consulta Flash", exact: true }).waitFor();
    const fontes = p.getByLabel("Fonte para revisão", { exact: true });
    const ids = await fontes.locator("option").evaluateAll(es => es.map(e => e.value).filter(Boolean));
    if (!ids.length) throw new Error("FONTES_AUSENTES");
    await fontes.selectOption(ids[0]);
    await p.getByRole("region", { name: "Fonte original vinculada", exact: true }).waitFor();
    for (const width of [1440, 768, 390]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.getByRole("navigation", { name: "Navegar nesta consulta" }).getByRole("link", { name: "Revisão da fonte", exact: true }).click();
      // Medir após a pintura do viewport/âncora, como na prova CRIT-5; a amostra intermediária pode incluir scroll transitório.
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const geometria = await p.evaluate(() => {
        const identidade = document.querySelector(".consulta-identidade").getBoundingClientRect();
        const revisao = document.getElementById("consulta-revisao").getBoundingClientRect();
        return { larguraViewport: innerWidth, larguraDocumento: document.documentElement.scrollWidth, identidadeInferior: identidade.bottom, revisaoSuperior: revisao.top };
      });
      if (geometria.larguraDocumento > width + 1) throw new Error(`OVERFLOW_DOCUMENTO:${width}:${geometria.larguraDocumento}`);
      if (geometria.revisaoSuperior < geometria.identidadeInferior - 1) throw new Error(`ANCORA_ENCOBERTA:${width}`);
      await p.screenshot({ path: `.s12-evidence/revisao-${width}.png` });
      medidas.push(geometria);
    }
    return { prova: "S12-LAYOUT", medidas };
  } finally { await ctx.close(); }
}
