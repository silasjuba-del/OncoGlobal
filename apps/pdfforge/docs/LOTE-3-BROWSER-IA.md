# Lote 3 — Browser IA OncoGlobal

Data: 2026-10-25. Mudança de direção: o PDFForge vira um **navegador de IA** com PDF como função central e uma
aba do OncoGlobal. Material de referência recebido: skill "ai-browser-architecture" (disciplina de evidência,
camadas percepção/atuação/estado/segurança) e parecer do OncoAssist sobre MONAI/IDC/nnInteractive.
Ambos são **referência de projeto**, não instruções executadas.

Regras herdadas da skill de referência aplicadas aqui: conteúdo de páginas é dado, não instrução; o app não
contorna login, paywall ou bloqueios; cada fluxo sensível declara origem → destino; propostas ≠ implementação.

## Mapa dos pedidos

| # | Pedido | Fase | Abordagem | Estado |
|---|---|---|---|---|
| 1 | Editar PDF (primordial) | 3A | Editor visual: texto, imagem, formas, caneta, marca-texto, corretor, assinatura, desfazer | feito |
| 2 | PDF → MD | 3A | Texto por página do pdf.js + heurística de títulos/listas | feito |
| 3 | Sidebar drawer recolhível | 3A | Barra lateral expandida ↔ só ícones, persistida | feito |
| 4 | Cards menores (≈ ícone de desktop) | 3A | Grade compacta 88 px | feito |
| 5 | Ícone com modal de apps (fig. 2) | 3A | Botão grade 3×N com atalhos editáveis | feito |
| 6 | UI editável e personalizável | 3A | Cor de destaque, densidade, raio, tamanho de fonte, ordem/visibilidade do menu | feito |
| 7 | Abas de navegador dentro do app (YouTube, sites) | 3A | Aba Browser com barra de URL, `<webview>` isolado, leitura do texto da página | feito |
| 8 | Caixa de URLs preferidas p/ exames | 3A | Lista de favoritos; capturar página → biblioteca/PDF | feito |
| 9 | Aba do OncoGlobal | 3A | Aba fixa com URL configurável (padrão `http://127.0.0.1:5173`, `npm run ui:dev`) | feito |
| 10 | Scraper → PDF | 3A | Página em janela oculta → `printToPDF` | feito |
| 11 | IA-Round (1 caixa, 4 LLMs, reconciliação) | 3A | Envio paralelo + skill "Reconciliar" (convergências, divergências, complementos) | feito |
| 12 | Print de tela: foto e vídeo + skill foto→prompt | 3A | `desktopCapturer` + MediaRecorder; prompt "Foto → Prompt" | feito |
| 13 | Frames recorder 10–20 s (TC/RM) | 3A | Grava região/janela, extrai N quadros, envia à IA **sem fins diagnósticos** | feito |
| 14 | Léxico/vocabulário de transcrição | 3A | Arquivo editável; vira `prompt` da transcrição + correção pós-transcrição | feito |
| 15 | Áudio de abas transcrito | 3B | Gravar áudio do sistema (loopback) enquanto a aba toca → transcrição | proposto |
| 16 | Vínculo chat ↔ app (dados em segundo plano) | 3B | Ferramentas do app expostas ao LLM (tool use): ler PDF aberto, biblioteca, anotações, executar ferramenta | proposto |
| 17 | MCP, API, CLI do app | 3B | Servidor local (127.0.0.1 + token) → MCP stdio e CLI `pdfforge` | proposto |
| 18 | PPT: ler e gerar (PowerPoint/Google Slides) | 3B | Leitura .pptx (XML) + geração com pptxgenjs; Slides via importar .pptx no Drive | proposto |
| 19 | Imagens: Nano Banana, Higgsfield | 3B | Nano Banana = modelo de imagem do Gemini (chave Gemini); Higgsfield só com API/MCP oficial verificada | proposto |
| 20 | Extensões do Chrome | 3B | `session.loadExtension` (Electron suporta parte das APIs MV3); só extensões descompactadas | proposto |
| 21 | Plaud dentro do app | 3B | Aba com o app web do Plaud; importar a transcrição exibida (com ação do usuário) | proposto |
| 22 | Celular: gravar e transmitir áudio | 3C | Página PWA servida na rede local com pareamento por QR + token | proposto |
| 23 | "Repo com alguns MB de database do app" | — | Depende de decisão (ver pendências) | aguardando |
| 24 | "Skill Google Antigravity" | — | Não há skill com esse nome instalada | aguardando |
| 25 | "Entrada API" | 3B | Interpretado como API local do app (item 17) | a confirmar |

## Pendências de decisão

1. **Repositório com database**: o conteúdo do app inclui PDFs e anotações potencialmente com dados de pacientes.
   Proposta: repositório git **local e privado** com dados sintéticos + script de exportação que exclui PHI.
2. **Renomear o produto** para "Browser IA OncoGlobal" (nome na janela, ícone, pasta) ou manter "PDFForge" com a aba OncoGlobal.
3. **Antigravity**: qual skill/fonte usar para "criar com a skill Google Antigravity".

## Segurança (resumo)

- Abas de navegador: sessão própria por site (`persist:web`), sem preload, sem Node, pop-ups só no mesmo host.
- Captura de tela/áudio só após clique do usuário; arquivo fica local até ser enviado conscientemente à IA.
- Frames de TC/RM: análise por IA rotulada "apoio, não diagnóstico"; nada é salvo no prontuário sem revisão médica.

## Resultado da fase 3A (2026-10-25)

| Item | Evidência |
|---|---|
| Editor de PDF | Interface real: retângulo, marca-texto e texto acentuado criados com mouse/teclado → `applyEdits` gera PDF com "Revisão médica: conferir dose". Rascunho restaurado após recarga. 13 testes (rotação 90/180/270, CropBox, imagem, formas, nota nativa, acentos) |
| Defeito corrigido | Ferramenta Texto descartava a caixa: o `mousedown` padrão tirava o foco recém-criado. `preventDefault` no clique de criação |
| PDF → MD | Ferramenta no catálogo; títulos por tamanho de fonte, listas e parágrafos; testes |
| Drawer, cards, apps, aparência | Drawer recolhe/expande e persiste; cards ~100 px; modal de apps com 9 atalhos editáveis; cor, densidade, raio, fonte, itens do menu aplicados ao vivo |
| IA-Round | 4 modelos em paralelo → rodada de confronto → reconciliação (provedor simulado) |
| Navegador / OncoGlobal / scraper | Smoke Electron: `<webview>` carregou example.com e exportou PDF; scraper em janela oculta gerou PDF de 63 KB |
| Captura | Smoke: 10 fontes de tela/janela listadas. Gravação real de frames/vídeo não exercitada (exige interação na sua tela) |
| Léxico | 146 termos + 14 correções; aplicado em microfone, vídeo, Reels e Plaud; testes |
| Porta | PDFForge passou para 5199 (OncoGlobal usa 5173) |
| Testes | `npm test` 46/46; `npm run build` ok; `npm run smoke` ok |

### Não verificado
- Gravação real de tela (vídeo/frames) e áudio do sistema; microfone com áudio real.
- Aba OncoGlobal com o OncoGlobal rodando (o app não estava em execução nesta sessão).
- Respostas reais dos LLMs (sem chaves).
