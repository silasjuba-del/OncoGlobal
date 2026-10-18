// playwright-cli run-code --filename; sessionStorage.s12KitDir aponta apenas ao kit da demo sintética.
async (page) => {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/oncoassist\.html/.test(page.url())) throw new Error("DEMO_LOCAL_OBRIGATORIA");
  const kitDir = await page.evaluate(() => sessionStorage.getItem("s12KitDir"));
  if (!kitDir || !/e2e-colon-f1-[^/\\]+[/\\]kit$/.test(kitDir)) throw new Error("KIT_SINTETICO_OBRIGATORIO");
  const contexto = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: ".s12-evidence/videos-colon" } });
  const p = await contexto.newPage(), video = p.video(), externas = [], fontes = [];
  p.on("request", r => { const u = new URL(r.url()); if (["http:", "https:"].includes(u.protocol) && u.hostname !== "127.0.0.1") externas.push(u.origin); });
  try {
    await p.goto(new URL("/oncoassist.html", page.url()).href);
    await p.getByLabel("Senha do servidor").fill("senha-sintetica-e2e-colon-01");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.getByLabel("Paciente da agenda").selectOption("encontro-e2e-colon-retorno-001");
    await p.getByLabel("Documento local", { exact: true }).waitFor();
    for (const [file, type, fatos, literal] of [["e2e-colon-historico.pdf", "medical_note", 1, true],
      ["e2e-colon-avaliacao.png", "nursing", 0, true], ["e2e-colon-laboratorio.pdf", "medical_note", 1, false]]) {
      await p.getByRole("combobox", { name: "Tipo da fonte", exact: true }).selectOption(type);
      await p.getByLabel("Documento local", { exact: true }).setInputFiles(`${kitDir}/${file}`);
      const pending = p.waitForResponse(r => r.url().endsWith("/consulta/upload"));
      await p.getByRole("button", { name: "Converter e revisar", exact: true }).click();
      const response = await pending, data = await response.json();
      if (response.status() !== 201 || data.conversionStatus !== "PRONTO") throw new Error("OCR_NAO_PRONTO");
      fontes.push({ file, draftId: data.draftId, fatos, literal, conversionStatus: data.conversionStatus });
      await p.getByRole("button", { name: "Converter e revisar", exact: true }).waitFor();
    }
    for (let i = 0; i < fontes.length; i++) {
      await p.getByRole("combobox", { name: "Trecho sem vínculo", exact: true }).selectOption({ index: 1 });
      const pending = p.waitForResponse(r => r.url().endsWith("/consulta/rascunho/revisar"));
      await p.getByRole("button", { name: "Confirmar vínculo deste trecho com Paciente Teste Cólon 01 · paciente-e2e-colon-001", exact: true }).click();
      if ((await pending).status() !== 200) throw new Error("VINCULO_NAO_CONFIRMADO");
      await p.getByRole("button", { name: /^Confirmar vínculo deste trecho/ }).waitFor({ state: "detached" });
    }
    for (const fonte of fontes) {
      const leitura = p.waitForResponse(r => r.url().endsWith('/consulta/rascunho')
        && r.request().postDataJSON()?.draftId === fonte.draftId);
      await p.getByRole("combobox", { name: "Fonte para revisão", exact: true }).selectOption(fonte.draftId);
      const selecionada = await (await leitura).json();
      // Aguarda a fonte selecionada; o checkbox anterior pode ainda estar no DOM durante a leitura HTTP.
      await p.getByRole("region", { name: "Fonte original vinculada", exact: true })
        .getByText(`Fonte ${selecionada.draft.payload.input.sourceId}`, { exact: true }).waitFor();
      const incluir = p.getByRole("checkbox", { name: "Incluir texto original deste trecho na evolução", exact: true });
      await incluir.waitFor(); if (fonte.literal) await incluir.check();
      const candidatos = p.getByRole("group", { name: "Achados para revisão", exact: true }).getByRole("checkbox");
      if (await candidatos.count() !== fonte.fatos) throw new Error("FATOS_DIVERGENTES");
      if (fonte.fatos) await candidatos.first().check();
      await p.getByRole("button", { name: "Preparar revisão", exact: true }).click();
      await p.getByRole("region", { name: "Conteúdo preparado para revisão", exact: true }).waitFor();
      const pending = p.waitForResponse(r => r.url().endsWith("/consulta/rascunho/revisar"));
      await p.getByRole("button", { name: "Confirmar revisão exibida", exact: true }).click();
      if ((await pending).status() !== 200) throw new Error("REVISAO_NAO_REGISTRADA");
      await p.getByText("Revisão registrada. Candidatos incertos conservam sua pendência.", { exact: true }).waitFor();
    }
    await p.getByRole("button", { name: "Consulta Flash", exact: true }).click();
    const flash = p.getByRole("region", { name: "Conteúdo da Consulta Flash", exact: true });
    const flashTexto = await flash.innerText();
    if (!flashTexto.includes("câncer de cólon metastático") || !flashTexto.includes("8.2 g/dL")) throw new Error("FLASH_DESATUALIZADA");
    if (await p.getByRole("checkbox", { name: "Liberar ciclo", exact: true }).isChecked()) throw new Error("LIBERACAO_PRESELECIONADA");
    await p.getByRole("button", { name: "Revisar documentos para assinatura", exact: true }).click();
    const preview = p.getByRole("region", { name: "Conteúdo para assinatura", exact: true });
    await preview.waitFor(); const texto = await preview.innerText();
    for (const trecho of ["FOLFIRI em curso", "não disponíveis no material apresentado", "diarreia CTCAE grau 2", "Neutropenia referida; paciente sem febre", "8.2 g/dL"])
      if (!texto.includes(trecho)) throw new Error(`TRECHO_AUSENTE:${trecho}`);
    const assinatura = p.waitForResponse(r => r.url().endsWith("/consulta/confirmar")), impressao = p.waitForResponse(r => r.url().endsWith("/acao"));
    await p.getByRole("button", { name: "Confirmar e assinar conteúdo exibido", exact: true }).click();
    const ar = await assinatura, pr = await impressao;
    if (ar.status() !== 200 || (await ar.json()).codigo !== "GRAVADA" || pr.status() !== 200 || (await pr.json()).decisao !== "EXECUTADA") throw new Error("FECHAMENTO_NAO_EXECUTADO");
    const hist = p.getByRole("region", { name: "Histórico de documentos assinados", exact: true });
    await hist.getByRole("button", { name: "Reimprimir versão 1 · Conjunto da Consulta Flash", exact: true }).waitFor();
    await p.screenshot({ path: ".s12-evidence/colon-assinado.png", fullPage: true });
    if (externas.length) throw new Error("EGRESSO_EXTERNO_NA_DEMO");
    const resultado = { caso: "colon-sintetico-aceito", fontes, flash: flashTexto, textoExibido: texto,
      documentos: await hist.locator("article").count(), chamadasExternasDaPagina: externas.length };
    await contexto.close(); return { ...resultado, video: await video.path() };
  } catch (erro) { await contexto.close(); throw erro; }
}
