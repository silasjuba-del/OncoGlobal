# Engenharia reversa — iLovePDF Desktop 2.3.2.0 (Windows, MSIX)

Data: 2026-10-25. Alvo: `C:\Program Files\WindowsApps\ILOVEPDFS.L.iLovePDF-PDFReaderandEditor_2.3.2.0_x64__0q01bhdkqq106`.
Método: inventário do pacote, extração de strings do `iLovePDF.exe` (ASCII + UTF‑16), REA 6.5.0
(`analyze-javascript-application`) sobre o editor web embutido, e captura de tela do app em execução.

Legenda: **[O]** observado no artefato · **[I]** inferência · **[?]** não verificado.

## 1. Arquitetura

| Camada | Achado |
|---|---|
| Shell | **[O]** Qt 6 + QML (`Qt6Quick`, `Qt6QuickControls2*`, estilo próprio `LoveStyle`). Não é Electron. |
| UI | **[O]** 424 arquivos QML embutidos em texto no `.exe` (qrc não compilado): `general/`, `pages/`, `tools/`, `parameters/`, `reader/`, `dialogs/`, `signature/`, `print/`, `imports/Theme`. |
| Persistência | **[O]** SQLite (`Qt6Sql` + `sqldrivers`). Tabelas: `Tool`, `History`, `Job`, `Document`, `Library`, `LibraryCategory`, `Storage`, `Notification`, `Settings`, `User`, `Service`, `Current`, `Version`. |
| Motor PDF | **[O]** Apryse/PDFTron (`PDFNetC.dll`, plugins `pdftron_*`), PDF Tools AG (`Pdf2PdfAPI`, `PdfOptimizeAPI`, `PdfSecureAPI`, `PdfRepairAPI`, `PdfOcrAPI`, `PdfValidatorAPI`, `Pdf2ImgAPI`, `Img2PdfApi`, `PdfPrintAPI`), Solid Framework (conversão Office, `SolidFrameworkNative.dll`, filtros `*.flt`). |
| OCR | **[O]** Tesseract (`tesseract.dll`) + modelos baixados de `desktopupdate.ilovepdf.com/tessdata/%1.traineddata`. |
| Imagens | **[O]** ImageMagick (`CORE_RL_*`). |
| Editor "TrueEdit" | **[O]** Página web local (`web/editpdf.*.js`, `web/trueedit.*.js`) com Apryse WebViewer WASM, carregada em `Qt6WebEngine`. Ponte Qt↔JS via `QWebChannel`, objeto `channel.objects.backendApi` (classe `QTMessagePassing`; eventos `pageChanged`, `fileLoaded`, `zoomChanged`). REA Evidence `ev_a32df584f00147832927c8120257db5b4d3c551d82d31de409b048bb7718863b`. |
| Nuvem | **[O]** `api.ilovepdf.com/v1/start/{imagepdf,officepdf}`, `service.iloveapi.com/{auth,signup,user}`, telemetria `evt.ilovepdf.com`, Sentry (`sentry.dll`). **[I]** HTML→PDF e Scan usam nuvem (`internet=1` no catálogo). |
| Integração SO | **[O]** `iLovePdfContextMenu.dll` (menu de contexto do Explorer), `Qt6HttpServer` (**[I]** recebe scans do celular). |

## 2. Catálogo de ferramentas (tabela `Tool`, seed embutido)

Esquema **[O]**: `name, qml, category, icon, action_text, last_use, visibility, count, internet, premium, pdf_tool, img_tool, one_file_tool, suffix, tool_id, tooltip, cat_order`.

| Categoria | Ferramentas (QML) |
|---|---|
| Organize PDF | Merge (`merged`), Split, Remove Pages (`removed`), Organize (`organized`), Scan to PDF (internet) |
| Optimize PDF | OCR PDF, Compress (`compressed`), Repair (`repaired`) |
| Convert to PDF | Image→PDF, Word→PDF, PowerPoint→PDF, Excel→PDF, HTML→PDF (internet, oculto) |
| Convert from PDF | PDF→JPG, PDF→Word, PDF→PowerPoint, PDF→Excel, PDF→PDF/A |
| Edit PDF | Rotate (`rotated`), Page Numbers (`pagenumber`), Watermark (`watermark`), Edit PDF, Crop (`cropped`) |
| PDF security | Unlock (`unlocked`), Protect (`protected`), Sign, Redact, Compare |

Extras no QML sem linha no seed: `SummarizeTool`, `TrueEditTool`, `ChainedTasksPanel` (encadear tarefas).

## 3. Fluxo de UI (observado na tela + QML)

1. Janela: menu (Arquivo/Editar/Conta/Ajuda) → barra de abas (Página Inicial fixa + abas de documentos/ferramentas + `+`) → ações à direita (config., notificações, conta).
2. Barra lateral: **Recentes**, **Ferramentas**, **Histórico de Tarefas** (`RecentsPage`, `ToolsPage`, `LastTaskPage`).
3. Recentes: zona "Abrir arquivo / arraste e solte", carrossel **Arquivos Recentes** (miniatura + data, menu ⋮, "Limpar tudo"), **Ferramentas Recentes**.
4. Ferramenta: `Tool.qml` → página de parâmetros específica (`parameters/*ParameterPage.qml`) com grade de cartões de arquivo à esquerda e painel de opções à direita → `ProcessingPage` → resultado com ação (`action_text`) e sufixo no nome de saída.
5. Leitor: `PdfViewer`, miniaturas, marcadores, anexos, camadas, assinaturas, busca.

## 4. Paleta (SVGs/QML embutidos)

Vermelho marca `#E5322D` / `#E90003`; cinzas `#161616 #292931 #33333B #47474F #5C5C64 #707078 #ADADB6 #C2C2CC #D6D6DF #F5F5FA`; sucesso `#1D9D58`/`#4ACD86`; aviso `#FF9428`.

## 5. Limites desta análise

- **[?]** Lógica C++ do `iLovePDF.exe` não decompilada (sem Ghidra/IDA nesta sessão); o comportamento vem do QML e do seed SQL.
- **[?]** Scripts inline de `en.html`/`pt.html` não analisados pelo REA (limitação declarada na Evidence).
- Navegação por clique no app via computer-use não respondeu; apenas a tela inicial foi capturada.
- O vendor Apryse WebViewer (`trueedit_libpdf/`) foi excluído da análise REA por volume.

## 6. Consequência para o clone

Os motores (Apryse, PDF Tools AG, Solid) são SDKs comerciais licenciados — **não podem ser copiados**. O clone
reproduz a arquitetura funcional (catálogo de ferramentas, fluxo de UI, persistência de recentes/histórico) com
motores abertos: `pdf-lib`, `pdf.js`, `tesseract.js`. Marca, logotipo e textos proprietários não são reutilizados.
