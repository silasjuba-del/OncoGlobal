# Correções da auditoria clínica — T1 e D3

Data: 2026-10-16. Escritor: Codex. Pedido: “VA CORRIGINDO LACUNAS”.
Base publicada: `12f535d2bc0e9e05d533c7064fa88f227d58afed`.
Branch/worktree: `codex/fase2-lacunas-t1` / `C:\Users\silas\Projects\OncoGlobal-wt\codex-fase2-lacunas-t1`.

## Objetivo e limites

Corrigir ingestão local e apresentação do cálculo de redução de dose. Preservar original, páginas, pendências e revisão médica. Nenhuma promoção de corpus, decisão de tratamento, alteração de limiar clínico ou integração na main.

WRITE_SET: `src/leitura/caixa-unica.ts`, `src/kernel/extracao/pdfLocal.ts`, `src/server/upload.ts`, `src/server/rotas.ts`, `src/contracts/api/porta.ts`, `src/ui/api/http.ts`, `src/ui/consulta/UploadDocumentoLocal.tsx`, `src/ui/consulta/TranscricaoLocal.tsx`, `src/ui/telas/importar/BotaoVoz.tsx`, `src/ui/telas/importar/ImportarTexto.tsx`, `src/ui/OncoassistLocal.tsx`, `src/rules/dose.ts`, `src/ui/tratamento/CalculadoraDose.tsx`, testes correspondentes em `tests/f1/s11/`, `tests/ui-telas/`, `tests/rules/dose.test.ts`, `tests/ui/dose.test.tsx`, e este registro.

Aceite: PDF híbrido enumera páginas pendentes; replay não transforma pendência em sucesso; ditado só inicia mediante gesto e prova de processamento local, permanece editável e passa pela revisão existente; cálculo rejeita números inválidos e explicita sua natureza aritmética. Executar regressões, typecheck, fronteiras, corpus e build. Somente dados sintéticos.

Extensão necessária do WRITE_SET: `src/contracts/api/saidasHttp.ts`, para validar a resposta idempotente do ditado no contrato HTTP compartilhado. Sem afrouxar o contrato de extração nova.

## Revalidação inicial

- A1: `converterPdfLocal` já renderiza páginas escaneadas e usa OCR local. A auditoria citou o adaptador de imagem isoladamente. Há falhas na enumeração de páginas pendentes e no replay.
- A2: botão legado desabilitado; sem captura integrada na consulta.
- C7: `src/server/dutos.ts` já calcula antiglosa antes de persistir validação; a exportação consulta essa validação. O comentário em `modules/apac/emissao.ts` não descreve o caminho completo. Reexecutar prova HTTP antes de reclassificar.
- D3: a calculadora aplica percentual escolhido à dose administrada anterior; sem vínculo a recomendação específica de catálogo.
- I2/B2/C1: a auditoria não contém a definição dos 12 blocos de `tumor-pack-extract.v2`. Não inventar o schema nem promover packs clínicos por adaptação automática.

## Contexto do Codex

Verificado `model_context_window = 1000000` no config global. A sessão reportou `model_context_window: 828400` no evento de uso; configuração nominal e orçamento efetivo são evidências diferentes. Nenhuma alteração global.
Referências: https://learn.chatgpt.com/docs/config-file/config-reference e https://developers.openai.com/api/docs/models/gpt-6-astra.

## Resultado

### Mudanças verificáveis

| Item | Resultado desta fatia |
|---|---|
| A1 — ingestão | PDF passa por uma única varredura; limite de 40 páginas é verificado antes de extrair; total e páginas pendentes ficam registrados. Replay conserva status/motivo. UI não trata ausência de status como sucesso. |
| A2 — voz | Captura condicional em português com `processLocally=true` e idioma já instalado. Sem instalação automática, fallback remoto, comando de voz executável ou gravação automática. Transcrição original e edição são conservadas separadamente. |
| A4/H3 — revisão/proveniência | Nova entrada usa `/consulta/extrair`, fica sem paciente até vínculo humano e segue a revisão existente. Contexto divergente é recusado; retry não duplica rascunho. |
| C7 — antiglosa | Teste HTTP existente passou: servidor calcula antiglosa, recusa resultado forjado pelo cliente e invalida autorização de exportação quando muda a prescrição/SIGTAP. Corrigida a conclusão da auditoria sobre esse caminho; emissão interna ainda exige avaliação separada. |
| D3 — dose | Natureza aritmética, fórmula e fonte clínica ausente ficam explícitas. Dose negativa/não finita, peso não positivo/não finito e resultado fora da precisão inteira ficam PENDENTE, sem dose utilizável. Administração anterior zero conserva o zero documentado, com PENDENTE. Corrigido texto que dizia “mantida” mesmo após aplicar redução sem peso. |

### Cobertura documental

- PDF digital, bitmap e híbrido: caminho real local; testes existentes exercitam OCR Tesseract de PNG e PDF bitmap. Um PDF ilegível, página sem OCR/baixa confiança ou limite excedido conserva o original e fica pendente.
- Imagem: PNG sintético exercitado. Isso não comprova todos os formatos de imagem, todos os scanners ou precisão clínica de reconhecimento.
- Texto: colagem/ditado revisado passam pela mesma extração local. DOCX continua no conversor existente; esta fatia não cria upload DOCX pela interface clínica.
- O tipo clínico da fonte continua uma seleção explícita. Nenhum resultado de OCR confirma identidade, estadiamento, biomarcador ou dose.

### Prova no navegador

Playwright CLI, servidor HTTP real e SQLite sintético da fixture `tests/f1/s12/fixtures/servidor-demo.ts`:

1. Entrar e selecionar paciente sintético.
2. Colar nota sintética com negação; salvar só após revisar o texto.
3. Ver a fonte entre os trechos sem vínculo; conferir texto e vincular explicitamente.
4. Incluir o texto literal na evolução; preparar conteúdo e confirmar a revisão exibida.
5. Recarregar a página, autenticar e abrir a mesma consulta: evolução revisada preservada, incluindo negação e pendências. Nenhum documento assinado automaticamente.

Respostas observadas: extração 201; vínculo, preparação e revisão 200. Requisições HTTP da jornada observadas apenas em loopback. Evidências locais: `%TEMP%\oncoglobal-fase2-browser\` (capturas); snapshots em `%TEMP%\.playwright-cli\`. Reabertura após reload comprovada; reinício do processo não foi exercitado nesta prova.

O navegador retornou **`downloadable`** para `SpeechRecognition.available({langs:["pt-BR"],processLocally:true})`: pacote de idioma ainda não instalado. Ditado real pelo microfone **não comprovado neste ambiente**; controles e falhas foram exercitados com implementações sintéticas da API. A2 permanece parcial operacionalmente. Referência técnica: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static.

### Lacunas que permanecem abertas

| IDs | Próxima evidência/decisão necessária |
|---|---|
| I2/B2/C1 | Documento que define os 12 blocos de `tumor-pack-extract.v2`; solicitado no chat. Não encontrado no código/corpus/docs pesquisados. |
| F1 | Lista clínica dos sinais, ações/urgências e revisão médica do corpus antes da ativação. |
| D3 — recomendação | Protocolo, fonte, cenário e revisão para recomendações de ajuste; a calculadora desta fatia não as produz. |
| G1–G3 | Contrato de seguimento e decisão sobre fallback `NAO_TUMOR_ESPECIFICO`; sem intervalos inventados. |
| A3/B1/B3/B4/C3–C6/D1/D2/D4/D5/E1–E3/H1/I1/I3 | Permanecem no backlog da auditoria; sem declaração de fechamento nesta fatia. |

I1: conservar semânticas específicas de revisão/assinatura e ativação de biblioteca; não substituir por enum transversal sem contrato.

### Verificação e entrega

- Typecheck e build final: PASS.
- Fronteiras: PASS, 427 arquivos e 0 exceções. Corpus: PASS, 211 arquivos.
- `npm run verify`: executou 456 arquivos / 3.643 testes, com 3.640 PASS e 3 falhas (scanner antes de preparar o índice; dois casos de dose na execução iniciada antes do ajuste final do zero). Log: `%TEMP%\oncoglobal-fase2-lacunas-verify.log`.
- Após corrigir o zero e selecionar explicitamente os arquivos no índice, processo novo com `tests/f0-fecha/phi-repo.test.ts`, `tests/rules-prescricao/instanciarProtocolo.test.ts`, `tests/rules/dose.test.ts` e `tests/ui/dose.test.tsx`: **45/45 PASS**, incluindo todos os casos falhos. Log: `%TEMP%\oncoglobal-fase2-lacunas-recheck.log`.
- A suíte integral não foi repetida após o ajuste final; a rechecagem cobre os testes falhos e a UI dependente. Não declarar uma execução única de `verify` inteiramente verde.
- Prova Playwright do fluxo de texto/revisão/reabertura: PASS, com as limitações de voz e reinício descritas acima.
- Diff selecionado explicitamente, sem alterações no checkout principal. Commit local para revisão; sem merge/push, aprovação clínica ou fechamento da Fase 2.
