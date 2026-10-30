# PDFForge (Browser IA OncoGlobal) — inventário funcional

Data: 2026-10-26. Pasta: `C:\Users\silas\Downloads\rea-main\pdfforge` (sem git, sem commit; versão = estado do disco
nesta data). Linha de base: `npm test` 46/46 verde em 2026-10-26.

Este documento é o **ponto de partida** para o levantamento funcional, não a prova final. Quem testar deve
confirmar cada linha.

## Legenda de status

| Status | Significado |
|---|---|
| **IMPLEMENTADO** | Existe no código (arquivo indicado). |
| **OBSERVADO** | Visto funcionando na interface ou no smoke do Electron durante a construção (2026-10-24/25), com provedor de IA **simulado**. |
| **PLANEJADO** | Aparece na interface como "em breve" ou só na documentação; não executa. |
| **NÃO VERIFICADO** | Implementado, mas nunca exercitado de ponta a ponta (depende de chave, hardware ou serviço externo). |

## 0. Modos de execução (diferenças que mudam o resultado esperado)

| Aspecto | Desktop (Electron: `npm start`, `npm run dev`) | Navegador (`npm run dev:web`) |
|---|---|---|
| Abrir/salvar arquivo | Diálogos nativos (`files:open`, `files:save`, `files:saveMany` em `electron/main.cjs`) | `<input type=file>` e download por link (`src/platform/platform.ts`) |
| Chamadas de IA | Processo principal (`electron/services/llm.cjs`), chaves cifradas com safeStorage | **Simuladas** se `localStorage['pdfforge-mock-llm']` estiver ligado; sem chave real |
| Abas web / NotebookLM / OncoGlobal | `<webview>` com partições `persist:*` | Não disponível (sem webview) |
| Captura de tela, Site→PDF, Word, pastas, WhatsApp | Disponível | Indisponível ou degradado |
| Preferências | `pdfforge-store.json` e `pdfforge-library.json` no userData do Electron | `localStorage` do navegador |

`npm run dev` fixa a porta 5199. Se ela estiver ocupada, usar `npm run build` + `npm start`, ou
`npm run dev:web -- --port 5201` (só interface).

## 1. Shell e navegação

| Tela/fluxo | Ação do usuário | Comportamento | Status | Evidência |
|---|---|---|---|---|
| Abas | Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+1…9, clique do meio | Abre, fecha, alterna abas; menu de contexto (fechar, outras, à direita, duplicar) | IMPLEMENTADO, OBSERVADO | `src/app/App.tsx`, `electron/main.cjs` (menu) |
| Barra lateral (drawer) | Clique ou Ctrl+B | Expande/recolhe; itens ocultáveis em Aparência | IMPLEMENTADO, OBSERVADO | `src/components/Drawer.tsx` |
| Grade de apps (launcher) | Ícone de grade no topo | Modal tipo Google com atalhos para telas e sites favoritos | IMPLEMENTADO, OBSERVADO | `src/components/Launcher.tsx` |
| Paleta de comandos | Ctrl+K | Busca telas, ferramentas, recentes, biblioteca, prompts; setas, Enter, Esc | IMPLEMENTADO, OBSERVADO | `src/components/CommandPalette.tsx`, `src/app/commands.ts` |
| Nova aba / omnibox | Ctrl+L ou nova aba | URL abre aba web; texto livre oferece busca na web, pergunta ao Claude, resultados locais | IMPLEMENTADO, OBSERVADO | `src/pages/StartPage.tsx` (ordenação `rankSuggestions` ainda provisória, com TODO) |
| Recentes e cartões de ferramentas | Clique no cartão | Abre ferramenta ou arquivo recente | IMPLEMENTADO, OBSERVADO | `src/pages/HomeView.tsx` |

## 2. Ferramentas de PDF (19 prontas + 10 planejadas)

Fonte única: `src/tools/catalog.ts`. Motor: `src/engine/ops.ts` (pdf-lib), `render.ts` (pdf.js), `compare.ts`,
`markdown.ts`. Testes de motor: `tests/engine.test.ts`.

Fluxo comum (`src/pages/ToolWorkspace.tsx`): escolher/arrastar arquivo(s) → opções → executar → lista de saídas
→ salvar (1 arquivo = diálogo; vários = pasta ou ZIP) → "mostrar na pasta". **O original nunca é sobrescrito:**
toda saída é um arquivo novo com nome derivado.

| Ferramenta | Entrada | Resultado | Status |
|---|---|---|---|
| Juntar PDF | vários PDFs | 1 PDF | IMPLEMENTADO, testado |
| Dividir PDF | PDF + intervalos | vários PDFs | IMPLEMENTADO, testado |
| Remover páginas | PDF + páginas | PDF | IMPLEMENTADO, testado |
| Organizar PDF | PDF | reordenar/girar/excluir em miniaturas (`OrganizeEditor.tsx`) | IMPLEMENTADO, OBSERVADO |
| Comprimir PDF | PDF | PDF menor | IMPLEMENTADO, testado |
| OCR PDF | PDF digitalizado | PDF/texto pesquisável (tesseract.js, local) | IMPLEMENTADO, OBSERVADO |
| Reparar PDF | PDF corrompido | PDF regravado | IMPLEMENTADO, testado |
| Imagem para PDF | imagens | PDF | IMPLEMENTADO, testado |
| Site → PDF (scraper) | URL | PDF da página (janela oculta + printToPDF) | IMPLEMENTADO (só desktop), OBSERVADO no smoke |
| PDF para JPG | PDF | imagens | IMPLEMENTADO, OBSERVADO |
| PDF → Markdown | PDF | `.md` por página | IMPLEMENTADO, testado |
| Girar PDF | PDF | PDF | IMPLEMENTADO, testado |
| Números de página | PDF | PDF | IMPLEMENTADO, testado |
| Marca d'água | PDF + texto | PDF | IMPLEMENTADO, testado |
| Recortar PDF | PDF + margens | PDF | IMPLEMENTADO, testado |
| Editar PDF | PDF | abre o editor visual (§3) | IMPLEMENTADO, OBSERVADO |
| Desbloquear PDF | PDF + senha | PDF sem senha (cópia das páginas) | IMPLEMENTADO, testado |
| Proteger PDF | PDF + senha | PDF cifrado | IMPLEMENTADO, testado |
| Comparar PDF | 2 PDFs | relatório HTML de diferenças | IMPLEMENTADO, testado |
| Digitalizar para PDF (celular → desktop); Word/PowerPoint/Excel → PDF; PDF → Word/PowerPoint/Excel; PDF/A; Assinar; Ocultar dados (tarja) | — | Cartão "em breve" com o motivo (`status: 'planned'`) | PLANEJADO |

## 3. Visualizador e editor

| Tela/fluxo | Ação | Comportamento | Status | Evidência |
|---|---|---|---|---|
| Visualizador | Abrir PDF | Páginas, zoom, navegação | IMPLEMENTADO, OBSERVADO | `src/pages/ViewerPage.tsx` |
| Anotações ao lado | Escrever nota por página | Notas gravadas na biblioteca local; editar/excluir; ficam fora do PDF | IMPLEMENTADO, OBSERVADO | `src/pages/ai/AnnotationsPanel.tsx`, `src/ai/library.ts` |
| Editor visual | Editar PDF | Inserir texto, nota, imagem, desenho livre (tinta), linha e retângulo; salvar como **novo** arquivo | IMPLEMENTADO, OBSERVADO | `src/pages/EditorPage.tsx`, `src/engine/edit.ts`, `tests/edit.test.ts` |

## 4. IA (todas as chamadas saem por `electron/services/llm.cjs`)

| Tela/fluxo | Ação | Comportamento | Status |
|---|---|---|---|
| Abas Claude / GPT / Grok / Gemini | Modo API ou modo site | API: chat com streaming, cancelamento, anexos de PDF; site: abre o site oficial em webview | IMPLEMENTADO; OBSERVADO só com simulação; **chamada real NÃO VERIFICADA** |
| IA-Round | 1 pergunta → 4 modelos → reconciliação | Respostas lado a lado + síntese pela skill "reconciliar" | IMPLEMENTADO, OBSERVADO (simulado) |
| Prompts e skills | Biblioteca de 16 prompts + 8 skills | Variáveis `{{documento}} {{selecao}} {{entrada}} {{titulo}}`; criar/editar os próprios | IMPLEMENTADO, OBSERVADO (`src/ai/prompts.ts`) |
| Biblioteca Memo-RAG | Indexar documentos | Busca BM25 local com citação [n]; documentos, anotações e prompts | IMPLEMENTADO, OBSERVADO (`src/ai/rag.ts`) |
| NotebookLM | Preparar fontes | Gera material e abre o NotebookLM em webview | IMPLEMENTADO, login NÃO VERIFICADO |
| Transcrição | Microfone, arquivo, Plaud (pasta), YouTube, Reels | Whisper (`whisper-1`) com léxico oncológico como `prompt`; YouTube via legendas | IMPLEMENTADO; YouTube OBSERVADO; microfone/Whisper reais NÃO VERIFICADOS |
| Captura | Foto, vídeo, frames 10–20 s | Escolhe janela/tela; frames rotulados "apoio, não laudo"; foto→prompt | IMPLEMENTADO; fontes listadas no smoke; gravação real NÃO VERIFICADA |
| Configurações | Chaves, modelos, esforço, léxico, pastas | Chaves cifradas no processo principal; status por provedor | IMPLEMENTADO, OBSERVADO |
| **Desidentificação antes da LLM** | — | **Não existe.** Decisão de 2026-10-26 exige; `PROMPT-CODEX-PDF-DOMINIO.md` especifica | PLANEJADO |

## 5. Plugins e saída

| Plugin | Comportamento | Status |
|---|---|---|
| Word | Exportar texto/markdown para `.docx`; importar `.docx` | IMPLEMENTADO, OBSERVADO no smoke |
| Google Drive / Plaud | Pasta local sincronizada (detecta Drive; lê/escreve; converte `.srt`) | IMPLEMENTADO; Drive real NÃO VERIFICADO |
| WhatsApp | Abre deep link com o texto (o usuário envia) | IMPLEMENTADO; envio NÃO VERIFICADO |
| Compartilhar/Exportar | Salva `.md`/`.txt` | IMPLEMENTADO |

## 6. Navegador interno e aba OncoGlobal

| Tela/fluxo | Comportamento | Status |
|---|---|---|
| Abas web | Navegação, voltar/avançar, título da aba, URLs favoritas para exames | IMPLEMENTADO, OBSERVADO (título "Example Domain" no smoke) |
| Aba OncoGlobal | **Só exibe** a interface do OncoGlobal (URL padrão `http://127.0.0.1:5173/`, configurável) num webview `persist:oncoglobal` | IMPLEMENTADO; com o OncoGlobal rodando NÃO VERIFICADO |
| Envio de documento ao OncoGlobal | **Não existe.** O OncoGlobal já aceita `POST /consulta/upload` (ver `PROMPT-CLAUDE-TESTE-INTEGRACAO.md`) | PLANEJADO |

## 7. Aparência e estados

| Item | Comportamento | Status |
|---|---|---|
| Tema | Escuro (padrão) / claro | IMPLEMENTADO, OBSERVADO |
| Aparência editável | Nome do app, cor de destaque (padrão `#E5322D`), densidade, raio, fonte, tamanho de cartão, itens ocultos | IMPLEMENTADO, OBSERVADO (`AppearanceSection.tsx`) |
| Estados de erro/carregamento | Mensagens por ferramenta; IA mostra erro de chave ausente | IMPLEMENTADO; catálogo completo de estados NÃO VERIFICADO |
| Alinhamento ao sistema visual OncoGlobal | Especificado em `PROMPT-UI-UX-PDFFORGE.md` | PLANEJADO |

## 8. Lacunas que impedem definir resultado esperado

1. Comportamento com chave real de cada LLM (erros, limites, cancelamento no meio do streaming).
2. Gravação real de tela/áudio e permissão do Windows.
3. Login dentro dos webviews (sites de LLM, NotebookLM, OncoGlobal).
4. Qual consulta/paciente de destino quando existir "Enviar ao OncoGlobal" (ainda não há fluxo).
5. Onde ficam os dados no modo navegador ao limpar o `localStorage` (perda esperada ou não).
