# PROMPT PERSISTENTE — CODEX · ONDA W7 · 10 FATIAS (app de pé: leitura, impressão, executores, raiz de composição)

> Primeiro leia e obedeça `docs/ondas/W2-CABECALHO-COMUM.md` (vale integralmente; onde diz W2, leia W7). EXECUTOR = `CODEX`.
> **Pasta:** `C:\Users\silas\Projects\OncoGlobal-wt\w7-codex` · **Branch:** `f0/w7-codex`
> **Progresso/retomada:** `docs/progresso/W7-CODEX.md`. Se a sessão cair, leia e continue da primeira fatia não FEITA.
> **Testes sempre em série** (pouca RAM): `npx vitest run --no-file-parallelism`. Feche cada fatia com `npm run verify` verde.
> **Se o sandbox bloquear `git commit`** (o `.git` fica fora do worktree): deixe os arquivos da fatia em `git add`, registre `COMMIT_PENDENTE_SANDBOX` no progresso e siga. O tech lead commita.

## Por que esta onda existe
O sistema tem núcleo, regras, módulos e componentes, mas **ainda não sobe como aplicativo**: não há raiz de composição, rotas de leitura, executores reais do Action Gateway, nem impressão. Você coloca o app de pé **no PC do Dr. Silas**, sem tocar no que outros executores estão corrigindo agora.

## ⚠️ Três ondas em paralelo: respeite as faixas
- **W5 · Fugu Ultra** é dono de tudo que **já existe** em `src/kernel/**`, `src/server/**`, `src/orchestration/**`, `src/rules/**`, `src/modules/**`, `src/ui/**`, `corpus/**` e das pastas de teste correspondentes.
- **W6 · Cursor** cria `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**`. A interface `PortaConsulta` dele (em `src/ui/api/porta.ts`, branch `f0/w6-cursor`) lista os métodos marcados `[SERVIDOR_PENDENTE]` que **você** implementa no servidor de leitura.
- **Você (W7) só CRIA arquivos novos**, e só nestes caminhos:
  `src/app/**`, `src/leitura/**`, `src/impressao/**`, `bench/**`, `tests/{app,leitura,impressao,sistema}/**`, `scripts/{iniciar,gerar-sinteticos}.mjs`, `docs/w7/**`, `docs/progresso/W7-CODEX.md`.
- **Não edite** nenhum arquivo existente, `src/contracts/**`, `package.json`, `tsconfig.json`, `scripts/check-boundaries.mjs` nem `.github/**`. Precisa mudar arquivo de outra faixa? Gere um **patch** em `docs/w7/patches/<nome>.patch` com justificativa; o tech lead aplica na integração.

## Fronteiras já configuradas pelo tech lead (o `check:boundaries` cobra)
- `src/leitura/**`: **puro**. Pode importar `src/contracts`, `src/rules`, `src/modules`, `src/kernel/projections` e a si mesmo. **Não** importa ledger, servidor nem `node:fs`. Eventos e projeções entram **por parâmetro**.
- `src/impressao/**`: **puro**. Pode importar `src/contracts`, `src/modules` e a si mesmo. Documento entra, HTML sai.
- `src/app/**`: raiz de composição. Pode importar qualquer camada e subir servidor de **entrada** em `127.0.0.1` (`node:http`). **Nunca** rede de saída (`fetch`, `node:https`, `node:net`, `http.request`).
- Rede de saída continua **só** em `src/kernel/gateway` e `src/kernel/llm`.

## Invariantes (reprovam a fatia)
IA não assina, não prescreve, não envia. Ausente = PENDENTE (nunca VERDE). Dado de paciente não sai do PC. O app alerta e nunca bloqueia o clínico. Conflito nunca é resolvido em silêncio. Efeito externo **só** pelo Action Gateway (`criarGateway` com executores injetados). Validar não imprime. Sem valor clínico, layout oficial ou texto inventado: `[VERIFICAR]`. Teto de 5 estados. Sem dependência nova.

---

## CDX-01 · Gerador de dados sintéticos determinístico
**Arquivos:** `src/app/sinteticos/gerador.ts`, `scripts/gerar-sinteticos.mjs`, `tests/app/sinteticos.test.ts`
**Objetivo:** `gerarSinteticos({ semente, pacientes, hoje })` → eventos **válidos pelos contratos** (`ClinicalEvent`, `TreatmentAdministration`, `Triagem` etc.) gravados por `confirmar()` num SQLite temporário. PRNG próprio com semente (nada de `Math.random`). Cobertura obrigatória: rotina verde; vermelho no salão; pendente (hemograma vencido); E1; multitumor (2 lotes); contato de WhatsApp não vinculado e telefone compartilhado; APAC em D84, D85, D89 e D90; administração duplicada com quantidades diferentes; correção com `supersedesEventId`.
**Regras:** nomes "Paciente Teste NNN"; CPF/CNS **com dígito verificador propositalmente inválido**; nenhum dado real.
**Aceite:** mesma semente → banco byte a byte igual (compare hash dos eventos); todo evento passa no schema; o script grava só em pasta indicada por argumento.

## CDX-02 · Leitura: fila do salão e agenda do dia
**Arquivos:** `src/leitura/salao.ts`, `src/leitura/agenda.ts`, `src/leitura/tipos.ts`, `tests/leitura/salao-agenda.test.ts`
**Objetivo:** funções puras `filaSalao(eventos, ruleset, hoje)` (triagens confirmadas → `avaliarTriagem` → `ordenarFila`; FRENTE · FILA DO MÉDICO · SALÃO; E1 como badge sem reordenar) e `agendaDoDia(eventos, hoje)` (semáforo, completude, contatos desde a última consulta, E1). **Reuse** as funções de `src/rules`; nunca reimplemente corte ou ordem.
**Tipos:** alinhe `src/leitura/tipos.ts` aos tipos de retorno da `PortaConsulta` do Cursor. Se ainda não existirem, defina a partir de `src/contracts` e registre em `docs/w7/ALINHAMENTO-PORTA.md` o que o Cursor precisa ajustar.
**Aceite:** ordem idêntica a `ordenarFila`; triagem só RAW/rascunho não entra; campo ausente vira PENDENTE; paciente com pendência nunca VERDE.

## CDX-03 · Leitura: caixa do canal e lotes APAC
**Arquivos:** `src/leitura/canal.ts`, `src/leitura/apac.ts`, `tests/leitura/canal-apac.test.ts`
**Objetivo:** `caixaCanal(eventos, cadastro)` (mensagens desde a última consulta agrupadas por paciente; contato não vinculado ou telefone compartilhado → fila de vínculo via `resolverVinculo`; nome sozinho nunca liga) e `lotesApac(eventos, hoje)` (via `montarApacBatch` + prazo de `src/rules/apac.ts`; D85 aviso; D90 vencida fora da exportação; finalidade herdada ou PENDENTE; APAC negada preservada com motivo).
**Aceite:** telefone de 2 pacientes → vínculo pendente; vencida não aparece como exportável; nenhuma finalidade derivada da intenção (G-12).

## CDX-04 · Leitura: consulta pronta
**Arquivos:** `src/leitura/consulta.ts`, `tests/leitura/consulta.test.ts`
**Objetivo:** `carregarConsulta(eventos, patientId, tumorLotId, encounterId, rulesets)` → cabeçalho, alertas E1, delta desde o último CONFIRMED, evidências com fonte, bundle sugerido, cumulativos. Use `projetarSnapshot`, séries, `cumulativos` e `delta`.
**Dependência:** o Fugu (W5, trilha KERNEL) está criando `src/kernel/projections/vistas.ts`. Se já existir na sua base, **use**. Se não, faça a montagem mínima em `src/leitura/consulta.ts` e registre `DUPLICIDADE_TEMPORARIA` no progresso.
**Aceite:** proposta CURRENT nunca aparece como fato; conflito de cumulativo aparece como pendência, não como número; multitumor: trocar o lote não troca alergias/comorbidades do paciente.

## CDX-05 · Impressão: documento → HTML A4 imprimível
**Arquivos:** `src/impressao/html.ts`, `src/impressao/estilo.ts`, `tests/impressao/html.test.ts`
**Objetivo:** `paraHtmlImprimivel(documentoRenderizado, assinatura | null)` → HTML completo com CSS `@media print` (A4, margens, quebra de página por seção). Cabeçalho institucional `[VERIFICAR]`. Rodapé: id, versão e hash do conteúdo. **Sem assinatura → marca d'água "RASCUNHO — NÃO VÁLIDO"**. Campo PENDENTE aparece escrito "PENDENTE", nunca em branco. Seção de origem `ALERTA` só na folha operacional do salão (INV-09). Todo texto escapado (sem HTML injetado vindo de laudo).
**Aceite:** laudo com `<script>` sai escapado; documento sem assinatura nunca sai sem a marca; mesmo documento → mesmo HTML.

## CDX-06 · Executores locais do Action Gateway
**Arquivos:** `src/app/executores/{imprimir,exportarApac,backupLocal,desabilitados}.ts`, `tests/app/executores.test.ts`
**Objetivo:**
- `IMPRIMIR`: grava o HTML de CDX-05 em `<dataDir>/impressao/<data>/<documentId>@<versao>.html` e devolve EXECUTADA com o caminho (abrir a impressora do sistema fica para depois: `[VERIFICAR]`). Recusa documento não ASSINADO.
- `EXPORTAR_APAC`: grava arquivo local do lote; o **layout oficial do SIA/SUS é `[VERIFICAR]`** e entra como parâmetro (como no importador SIGTAP); teste com layout sintético.
- `BACKUP_LOCAL`: chama a lógica de `scripts/backup.mjs` com destino local; senha lida na hora, nunca guardada.
- `ENVIAR_WHATSAPP`, `ENVIAR_EMAIL`, `AGENDAR`: executor **desabilitado** que devolve FALHOU com motivo `CAPACIDADE_DESABILITADA`, **sem rede**.
**Aceite:** com o gateway real (`criarGateway`) e a mesma `idempotencyKey`: imprimir 2× = **um** arquivo; imprimir em paralelo 2× = um arquivo; executor que lança erro → OUTCOME_UNKNOWN e nenhum reenvio automático.

## CDX-07 · Servidor de leitura + arquivos da UI
**Arquivos:** `src/app/servidor.ts`, `src/app/rotasLeitura.ts`, `tests/app/servidor.test.ts`
**Objetivo:** servidor de **entrada** em `127.0.0.1` que (a) atende as rotas de leitura da `PortaConsulta` (`/leitura/agenda`, `/leitura/salao`, `/leitura/canal`, `/leitura/apac`, `/leitura/consulta`) chamando `src/leitura`; (b) serve os arquivos de `dist/` (UI) com `Content-Type` correto, sem listar diretório e sem sair de `dist/` (path traversal); (c) delega `/login`, `/consulta/*` e `/acao` para `rotear()` de `src/server/rotas.ts`, **sem reimplementar**. Toda leitura exige sessão (`Bearer`). Recusa bind fora do loopback. Logs por lista positiva (rota, código, status), nunca corpo (N18). Cabeçalhos: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, CSP restritiva, **sem CORS**.
**Aceite:** sem token → 401; `GET /../../package.json` → 404; origem externa não recebe cabeçalho CORS; nenhum identificador sintético aparece no log.

## CDX-08 · Raiz de composição e "iniciar"
**Arquivos:** `src/app/main.ts`, `src/app/config.ts`, `scripts/iniciar.mjs`, `tests/app/main.test.ts`
**Objetivo:** `iniciar({ dataDir, porta, senha, offset: "-03:00" })` abre o ledger (WAL), cria o store de idempotência **persistente**, os executores (CDX-06), o gateway, as sessões e o servidor (CDX-07). A senha vem de variável de ambiente ou prompt e **não é gravada**. Offset de produção `-03:00` (D-W5-01). `scripts/iniciar.mjs` sobe tudo e imprime só `http://127.0.0.1:<porta>`.
**Dependência:** o store SQLite de idempotência está sendo criado pelo Fugu (`src/kernel/ledger/idempotencia.ts`). Se não existir na sua base: **não** suba com store em memória em produção; `iniciar` recusa com erro claro `STORE_PERSISTENTE_AUSENTE` e o teste usa uma implementação de teste injetada. Registre `BLOQUEADO_DEPENDENCIA` parcial.
**Aceite:** iniciar → login → leitura → encerrar → reiniciar no mesmo `dataDir` → dados presentes; senha não aparece em arquivo nenhum do `dataDir`.

## CDX-09 · Latência (critério 5: baixa latência)
**Arquivos:** `bench/*.bench.ts`, `docs/w7/LATENCIA.md`
**Objetivo:** com o gerador de CDX-01 (500 pacientes, 12 meses): medir p50/p95 de `carregarConsulta`, `filaSalao` (60 triagens), `agendaDoDia`, `reconstruir()` completo, `confirmar()` de um bloco e abertura do ledger. Rode com `npx vitest bench --run` (sem paralelismo). Metas **propostas** (não reprovam): consulta pronta p95 < 150 ms; fila do salão p95 < 50 ms; confirmar p95 < 100 ms.
**Aceite:** relatório com a máquina, os números reais e os 3 gargalos maiores, cada um com uma proposta de correção **sem overengineering** (índice SQLite, cache de projeção já existente etc.). Você não otimiza código de outra faixa: escreve o patch em `docs/w7/patches/`.

## CDX-10 · Teste de sistema ponta a ponta + relatório
**Arquivos:** `tests/sistema/consulta-real.test.ts`, `docs/progresso/W7-CODEX.md`
**Objetivo:** com `iniciar()` num `dataDir` temporário e dados de CDX-01, via HTTP real em `127.0.0.1`: login → agenda → consulta pronta → bundle (`/consulta/bundle`; se a rota ainda não existir, marque o passo `BLOQUEADO_DEPENDENCIA` e siga) → confirmar → imprimir com clique duplo (**um** arquivo) → **reiniciar o processo** → mesma chave = replay, **nenhum** arquivo novo → salão → APAC → canal. Depois rode os testes de `tests/w3/auditoria-regressao.test.ts` e confirme que continuam verdes.
**Aceite e relatório final:** tabela das 10 fatias (estado · commit ou `COMMIT_PENDENTE_SANDBOX` · saída resumida do verify), arquivos criados, patches propostos em `docs/w7/patches/`, `[VERIFICAR]` (cabeçalho institucional, layout APAC, impressora), dependências do Fugu e do Cursor, e a **saída real** do último `npm run verify`.

---

## Stop conditions
- Precisaria editar arquivo existente, contrato, `package.json` ou o check de fronteiras → `BLOQUEADO_ESCOPO` + patch em `docs/w7/patches/`, siga.
- Precisaria de layout oficial, texto clínico ou valor não decidido → `[VERIFICAR]`, nunca invente.
- `tests/w3/auditoria-regressao.test.ts` ficou vermelho → **pare tudo e reporte**.
**Nunca:** `git push`, `--no-verify`, enfraquecer teste, rede de saída fora do gateway/llm, dado real. Commit por fatia: `W7-CODEX-NN: <título>` + `Co-Authored-By: <seu modelo>`.
