// Executar após reiniciar servidor-demo no MESMO diretório SQLite, sem semear novamente.
async (page) => {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html/.test(page.url())) throw new Error("DEMO_LOCAL_OBRIGATORIA");
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: ".s12-evidence/videos-reabertura" } });
  const p = await ctx.newPage(), video = p.video(), resultados = [];
  try {
    await p.goto(new URL("/oncoassist.html", page.url()).href);
    await p.getByLabel("Senha do servidor").fill("senha-sintetica-e2e-colon-01");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    for (const [encontro, nome, quantidade] of [["encontro-e2e-colon-retorno-001", "Paciente Teste Cólon 01", 3], ["encontro-s12-retorno-001", "Paciente Sintético Retorno S12", 5]]) {
      await p.getByLabel("Paciente da agenda").selectOption(encontro);
      await p.getByRole("button", { name: "Consulta Flash", exact: true }).waitFor();
      const historico = p.getByRole("region", { name: "Histórico de documentos assinados", exact: true });
      const artigos = historico.locator("article");
      if (await artigos.count() !== quantidade) throw new Error("CONTAGEM_DOCUMENTOS_DIVERGENTE");
      for (const artigo of await artigos.all()) if (!(await artigo.innerText()).includes(nome)) throw new Error("IDENTIDADE_DOCUMENTAL_DIVERGENTE");
      const retorno = p.waitForResponse(r => r.url().endsWith("/acao"));
      await historico.getByRole("button", { name: "Reimprimir versão 1 · Conjunto da Consulta Flash", exact: true }).click();
      const r = await retorno, resposta = await r.json();
      if (r.status() !== 200 || resposta.decisao !== "EXECUTADA") throw new Error("REIMPRESSAO_NAO_EXECUTADA");
      resultados.push({ encontro, documentos: quantidade, reimpressao: resposta.decisao });
    }
    await ctx.close();
    return { prova: "S12-REABERTURA-REIMPRESSAO", resultados, video: await video.path(), limite: "Geração HTML local; não comprova papel físico. Comparar ledger e hashes dos HTML fora do navegador." };
  } catch (erro) { await ctx.close(); throw erro; }
}
