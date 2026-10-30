# Roadmap e estado — PDFForge

Atualizado: 2026-10-25.

## Lote 1 — concluído

| Item | Evidência |
|---|---|
| Engenharia reversa (REA + inventário + strings) | `docs/ENGENHARIA-REVERSA.md`; REA Evidence `ev_a32df584…863b` |
| Shell Electron seguro + store em disco | `npm run smoke` → `bridge:true, nodeLeak:false, storeRoundTrip:true` |
| Motor PDF (13 operações) | `npm test` → 19/19 |
| UI clone (abas, Recentes, Ferramentas, Histórico, ferramenta, resultado, visualizador) | Jornada no navegador: 16 ferramentas executadas com PDFs sintéticos; persistência após recarga (18 recentes, 18 tarefas) |
| OCR | PDF só-imagem → texto extraível "Relatorio de teste OCR…", página 595×842 preservada |

Correção feita durante a validação: o `render` do pdf.js em modo display usa `requestAnimationFrame` e
congelava com a janela sem pintar; processamento passou a usar `intent: 'print'` e o Electron
`backgroundThrottling: false`.

## Limitações conhecidas

- Juntar/Desbloquear/Reparar/Organizar copiam páginas para um documento novo: marcadores, formulários e
  metadados do documento não são preservados.
- Compressão "Recomendada/Extrema" rasteriza páginas (texto deixa de ser selecionável); se não reduzir,
  mantém o original.
- Comparar avalia só o texto extraível, página a página (sem realinhar páginas inseridas).
- OCR baixa worker/modelos de CDN (jsDelivr / tessdata) na primeira execução.
- `npm audit`: alertas em dependências de desenvolvimento (vite/vitest/esbuild) e Electron 33 (ASAR
  integrity). Atualizar Electron antes de empacotar para distribuição.
- Não há instalador (`electron-builder`) nem assinatura de código ainda.
- Neste ambiente de CI/sandbox o Electron precisou de `--disable-gpu --no-sandbox`; não verificado
  visualmente na área de trabalho do usuário.

## Lote 2 — IA, prompts, plugins e biblioteca: concluído (ver docs/LOTE-2-IA.md)

## Lote 3 — proposto

| Frente | Abordagem |
|---|---|
| Office ↔ PDF (6 ferramentas) | Detectar LibreOffice (`soffice --headless --convert-to`) no processo principal; IPC `convert:office`; ferramentas ficam "Requer LibreOffice" quando ausente |
| HTML→PDF | `BrowserWindow` oculta + `webContents.printToPDF` |
| Editar PDF | Camada de anotações sobre o visualizador (texto, imagem, formas, desenho) → aplicar com pdf-lib |
| Assinar | Assinatura desenhada/imagem posicionada no visualizador; PAdES com certificado como etapa seguinte |
| Tarja | Selecionar áreas → rasterizar só as páginas afetadas com a área preenchida (remoção real do conteúdo) |
| PDF/A | Ghostscript (`-dPDFA`) quando disponível + validação |
| Empacotamento | `electron-builder` (NSIS), atualização do Electron, ícone próprio |

## Prompt de continuidade

```text
<objetivo>
Executar o Lote 3 do PDFForge: conversões Office↔PDF via LibreOffice headless e HTML→PDF via printToPDF,
mantendo o catálogo em src/tools/catalog.ts como fonte única.
</objetivo>
<contexto>
Projeto: C:\Users\silas\Downloads\rea-main\pdfforge (Electron 33 + React 18 + Vite 5 + TS).
Leia README.md, docs/ADICIONAR-FERRAMENTA.md e docs/ROADMAP.md. Lote 1 concluído: npm test 19/19,
npm run smoke OK, 16 ferramentas validadas no navegador.
</contexto>
<restricoes>
Sem Node no renderer: conversões rodam no processo principal via IPC exposto no preload.
Não alterar o contrato ToolDef sem atualizar docs/ADICIONAR-FERRAMENTA.md.
Ferramentas indisponíveis ficam status 'planned' com motivo explícito, nunca falham silenciosamente.
</restricoes>
<aceite>
- Word/Excel/PowerPoint→PDF e PDF→Word funcionando com LibreOffice instalado; mensagem clara quando ausente.
- HTML→PDF a partir de URL digitada.
- Testes novos para a camada IPC (mock do soffice) + npm test e npm run build verdes.
- Jornada validada no app: arquivo Office real → PDF aberto no visualizador.
</aceite>
```
