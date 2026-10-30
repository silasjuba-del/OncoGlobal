# Lote 2 — IA, prompts, plugins e biblioteca

Data: 2026-10-25. Pedido: abas de LLM (Claude, GPT, Grok, Gemini, NotebookLM), skills de texto, biblioteca de
prompts, plugins (Word, Plaud, Google Drive, WhatsApp), anotações laterais, Memo-RAG, microfone, fotos→UI/UX,
YouTube→transcrição, Reels→prompt.

## Decisões (suposições declaradas)

| Tema | Decisão | Motivo |
|---|---|---|
| Acesso aos LLMs | Modo **API** (chave própria, integrado ao PDF/biblioteca) + modo **Site** (claude.ai, chatgpt.com, grok.com, gemini.google.com embutidos) | API permite injetar PDF, prompts e RAG; o site usa a assinatura sem chave |
| Chaves | Guardadas no processo principal com `safeStorage` (DPAPI no Windows); renderer só sabe se existe | Chave nunca trafega para a interface |
| Claude | `@anthropic-ai/sdk`, `claude-opus-5-5`, thinking adaptativo, esforço configurável, streaming, `fallbacks: "default"` | Padrões da referência oficial |
| GPT/Grok/Gemini | SDK `openai` com endpoint compatível de cada provedor; modelos listados pela API | IDs de modelo mudam; lista viva evita palpite |
| NotebookLM | Sem API pública: site embutido + gerador de "pacote de fontes" (.md) salvo no Drive | Fluxo real de importação |
| Transcrição (microfone, Reels, Plaud áudio) | API de transcrição da OpenAI (`whisper-1`, configurável) | Electron não tem reconhecimento de voz nativo |
| YouTube | Legendas públicas do vídeo (processo principal) | Sem download de vídeo; vídeo sem legenda → aviso |
| Instagram Reels | Importar o arquivo de vídeo baixado + legenda colada; URL tenta só metadados públicos | Download de Reels exige login e viola os termos |
| Google Drive | Pasta local do Google Drive para Desktop (configurável) | Sincroniza sem OAuth |
| Plaud | Importar exportações (txt/md/srt/docx) de uma pasta configurada | Sem API pública verificada |
| WhatsApp | Abrir o WhatsApp Desktop/Web com o texto preenchido | API não oficial viola termos; Cloud API exige conta Business |
| Memo-RAG | Biblioteca local (JSON no userData), trechos de ~1200 caracteres, busca BM25 local, resposta com citações | Funciona offline e sem custo de embeddings |
| Privacidade | Aviso fixo em cada aba de API: o conteúdo vai ao provedor | PDFs clínicos podem conter dados identificáveis |

## Contratos

- IPC `llm:chat` (stream por `llm:event`), `llm:abort`, `llm:models`, `secrets:*`, `transcribe`, `youtube:transcript`,
  `reels:meta`, `word:export|import`, `folder:list|read|write` (Drive/Plaud), `share:whatsapp`, `library:get|set`.
- `PromptTemplate { id, name, kind: 'prompt'|'skill', description, template }` com variáveis `{{documento}}`,
  `{{selecao}}`, `{{entrada}}`, `{{titulo}}`.

## Aceite

- Erro do worker do pdf.js corrigido (dev e build `app://`).
- Abas Claude/GPT/Grok/Gemini/NotebookLM abrem; modo API mostra configuração quando falta chave; modo Site carrega o site.
- 10 prompts operacionais + skills aplicáveis ao PDF aberto e a texto livre.
- Anotações por página persistem; "Gerar anotações (IA)" usa o texto da página.
- Biblioteca: adicionar PDF/transcrição/resposta, buscar, perguntar com citações.
- Testes de BM25/chunking/templates; build; smoke Electron.
- Chamadas reais aos provedores: **não verificáveis nesta sessão** (sem chaves) — validadas com provedor simulado.

## Resultado (2026-10-25)

| Item | Evidência |
|---|---|
| Erro do worker do pdf.js | Reproduzido (Vite parado com a página aberta) e corrigido: worker na inicialização, `dev` sem `-k`, build servido por `app://`. PDF real de 26 páginas abre com o servidor derrubado; smoke `app://` abre PDF |
| Chat por API (streaming) | Smoke Electron: 23 trechos via IPC com provedor simulado |
| Prompts/skills | 13 prompts + 8 skills; preenchimento de `{{documento}}` conferido na interface; editar/restaurar/criar validados |
| Memo-RAG | PDF de 26 páginas → 49 trechos; busca e pergunta com citações; persistência após recarga |
| Anotações | Manual + IA (3 itens extraídos de lista) na página 1; persistem |
| YouTube | Legenda PT de vídeo real (295 linhas) pelo processo principal |
| Word / Plaud | .docx gerado e relido; .srt convertido em texto com tempo |
| Testes | `npm test` 27/27; `npm run build` ok |

### Não verificado nesta sessão

- Respostas reais de Claude/GPT/Grok/Gemini e transcrição de áudio: sem chaves no ambiente. Erros de chave/modelo têm mensagens tratadas, mas não foram exercitados contra os provedores.
- Login nos sites embutidos (webview) — depende da sua conta; Google pode bloquear login em janela embutida.
- Microfone (permissão concedida só à origem do app; não testado com áudio real).
- Reels por URL: o Instagram exige login; o caminho suportado é arquivo de vídeo + legenda.
