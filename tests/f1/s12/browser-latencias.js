// playwright-cli run-code --filename; mede DOM visível + oportunidade de pintura, sem provider.
async (page) => {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html/.test(page.url())) throw new Error("DEMO_LOCAL_OBRIGATORIA");
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  try {
    await p.goto(new URL("/oncoassist.html", page.url()).href);
    await p.getByLabel("Senha do servidor").fill("senha-sintetica-e2e-colon-01");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    const agenda = p.getByLabel("Paciente da agenda");
    const medir = async () => {
      await agenda.selectOption("");
      await p.getByRole("region", { name: "Consulta persistida", exact: true }).waitFor({ state: "detached" });
      const inicio = await p.evaluate(() => performance.now());
      await agenda.selectOption("encontro-e2e-colon-retorno-001");
      const resumo = p.getByRole("region", { name: "Visão clínica integrada", exact: true });
      await resumo.waitFor({ state: "visible" });
      if (!(await resumo.innerText()).includes("Hemoglobina: 8.2 g/dL")) throw new Error("RESUMO_CONFIRMADO_AUSENTE");
      await resumo.getByRole("heading", { name: "Resumo clínico principal", exact: true }).scrollIntoViewIfNeeded();
      const primeiroTextoMs = await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))))) - inicio;
      await p.getByRole("button", { name: "Consulta Flash", exact: true }).waitFor({ state: "visible" });
      await p.getByRole("region", { name: "Histórico de documentos assinados", exact: true }).locator("article").first().waitFor();
      await p.waitForLoadState("networkidle");
      const telaCompletaMs = await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))))) - inicio;
      return { primeiroTextoMs, telaCompletaMs };
    };
    const frio = await medir();
    for (let i = 0; i < 3; i++) await medir();
    const amostras = [];
    for (let i = 0; i < 30; i++) amostras.push(await medir());
    const p95 = campo => amostras.map(a => a[campo]).sort((a,b) => a-b)[Math.ceil(amostras.length * .95) - 1];
    const maxPrimeiroTextoMs = Math.max(frio.primeiroTextoMs, ...amostras.map(a => a.primeiroTextoMs));
    const maxTelaCompletaMs = Math.max(frio.telaCompletaMs, ...amostras.map(a => a.telaCompletaMs));
    if (maxPrimeiroTextoMs > 4000 || maxTelaCompletaMs > 20000) throw new Error(`CRIT_5_FALHOU:${maxPrimeiroTextoMs}:${maxTelaCompletaMs}`);
    return { prova: "S12-CHROME-DOM-FRAMES", escopo: "Seleção do encontro até resumo confirmado no DOM, título rolado ao viewport e dois frames; tela completa inclui histórico, controles e estado networkidle. Frio = primeira consulta após login, não startup do processo; sem streaming/provider",
      denominador: amostras.length, aquecimento: 3, frio, metodoPercentil: "nearest-rank", p95PrimeiroTextoMs: p95("primeiroTextoMs"), p95TelaCompletaMs: p95("telaCompletaMs"), maxPrimeiroTextoMs, maxTelaCompletaMs, amostras };
  } finally { await ctx.close(); }
}
