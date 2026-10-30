> Aplicativo original do Claude incorporado ao OncoGlobal. Consulte [a integração](../../integrations/pdfforge/README.md) para iniciar e transferir pacotes. O texto abaixo documenta a versão recebida; recursos de IA/sites podem acessar serviços externos quando configurados. A ponte OncoGlobal é local.

# PDFForge

Clone funcional do iLovePDF Desktop (Windows), reconstruído a partir de engenharia reversa com REA
(ver [docs/ENGENHARIA-REVERSA.md](docs/ENGENHARIA-REVERSA.md)). Processamento 100% local; só o OCR baixa
modelos de idioma na primeira execução.

Stack: Electron 33 · React 18 · Vite 5 · TypeScript · `@cantoo/pdf-lib` (edição/criptografia) · `pdf.js`
(renderização/texto) · `tesseract.js` (OCR) · `diff` (comparação) · `jszip`.

## Comandos

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

| Script | Função |
|---|---|
| `npm run dev` | Vite + Electron com recarga a quente (fechar a janela não derruba o Vite) |
| `npm run dev:electron` | Reabre só a janela do Electron com o Vite já rodando |
| `npm run dev:web` | Só a interface no navegador (fallback sem Electron; salva por download) |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm start` | Electron carregando `dist/` |
| `npm test` | 46 testes: motor PDF, editor, PDF→MD, léxico, RAG, prompts e anexos |
| `npm run smoke` | Electron real (build `app://`): ponte, PDF, IA simulada, biblioteca, Word, Plaud, YouTube |

## Estrutura

| Caminho | Responsabilidade |
|---|---|
| `electron/main.cjs` | Janela, menu nativo, IPC de arquivos e store JSON (`userData/pdfforge-store.json`) |
| `electron/preload.cjs` | Ponte mínima `window.pdfforge` (contextIsolation + sandbox, sem Node no renderer) |
| `src/platform/` | Abstração Electron ↔ navegador |
| `src/engine/ops.ts` | Operações PDF puras (testáveis em Node) |
| `src/engine/render.ts` | Operações com canvas: miniaturas, PDF→imagem, compressão rasterizada, OCR, texto |
| `src/engine/compare.ts` | Diff de texto e relatório HTML |
| `src/tools/catalog.ts` | **Catálogo de ferramentas** — metadados, campos de opções e `run()` |
| `src/store/` | Recentes, uso de ferramentas e histórico (espelha tabelas Document/Tool/History do original) |
| `src/pages/` | Início (Recentes/Ferramentas/Histórico), área da ferramenta, visualizador |

## Estado das ferramentas

Prontas (19, inclui Editar PDF, PDF→Markdown e Site→PDF): Juntar, Dividir, Remover páginas, Organizar, Comprimir, OCR, Reparar, Imagem→PDF, PDF→JPG,
Girar, Números de página, Marca d’água, Recortar, Desbloquear, Proteger, Comparar — além do visualizador
e do encadeamento "Continuar com outra ferramenta".

Em breve (12): Word/PowerPoint/Excel→PDF, PDF→Word/PowerPoint/Excel, PDF/A, HTML→PDF, Editar, Assinar,
Tarja, Digitalizar. Motivos e plano em [docs/ROADMAP.md](docs/ROADMAP.md).

Para criar uma ferramenta nova: [docs/ADICIONAR-FERRAMENTA.md](docs/ADICIONAR-FERRAMENTA.md).

## IA, prompts e plugins (Lote 2)

Detalhes e decisões em [docs/LOTE-2-IA.md](docs/LOTE-2-IA.md).

| Recurso | Onde |
|---|---|
| Abas Claude, GPT, Grok, Gemini | Barra lateral → Inteligência artificial. Modo **API** (integrado aos PDFs) ou **Site** (sua assinatura, embutido) |
| NotebookLM | Prepara fontes (texto bruto ou reescrito por IA) → Drive/.md/Word; modo Site embutido |
| Biblioteca de prompts (13) e skills de texto (8) | Aba Prompts & Skills; no chat: seletor de prompt e botão "Skill de texto" |
| Biblioteca Memo-RAG | Indexa PDFs, transcrições, respostas e anotações; busca BM25 local e pergunta com citações [n] |
| Anotações ao lado do PDF | Visualizador → "Anotações & IA": manuais ou geradas por IA, por página; exporta Word/biblioteca |
| Fontes no chat | PDF, foto/imagem (UI-UX), Word, YouTube (legenda), Reels (vídeo + legenda), Plaud, Google Drive, biblioteca, texto |
| Microfone | Botão "Ditado" no chat (transcrição pela API da OpenAI) |
| Saídas | Copiar, Word (.docx), Drive, WhatsApp, + Biblioteca, prévia e download de apps HTML gerados |

Chaves: Configurações → Provedores (cifradas pelo Windows) ou variáveis `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`XAI_API_KEY`, `GEMINI_API_KEY`. Para testar a interface sem chaves: `PDFFORGE_LLM_MOCK=1` (Electron) ou
`localStorage.setItem('pdfforge-mock-llm','1')` (navegador).

## Browser IA OncoGlobal (Lote 3)

Plano completo, decisões e evidências: [docs/LOTE-3-BROWSER-IA.md](docs/LOTE-3-BROWSER-IA.md).

- **Editar PDF** (Ferramentas → Editar PDF): texto, imagem, formas, caneta, marca-texto, corretor, assinatura, nota; desfazer/refazer; rascunho automático.
- **Barra lateral recolhível**, **modal de apps** (ícone de grade, editável) e **Aparência** em Configurações.
- **Navegador interno** (botão + na barra de abas): ler página → IA/biblioteca, página → PDF, print → IA, sites preferidos.
- **OncoGlobal**: aba própria; rode `npm run ui:dev` no repositório do OncoGlobal (porta 5173). O PDFForge usa a porta 5199.
- **IA-Round**: uma pergunta, quatro modelos, rodada de confronto e reconciliação.
- **Captura de tela**: foto (→ prompt / UI-UX), vídeo com áudio do sistema (→ transcrição) e frames de 10–20 s para rolagem de TC/RM (apoio, não laudo).
- **Léxico de transcrição**: `src/ai/lexico-oncologia.txt`, editável em Configurações.
