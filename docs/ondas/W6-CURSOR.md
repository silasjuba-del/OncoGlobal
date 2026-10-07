# PROMPT PERSISTENTE — CURSOR · ONDA W6 · 10 FATIAS (telas completas da consulta)

> Primeiro leia e obedeça `docs/ondas/W2-CABECALHO-COMUM.md` (vale integralmente; onde diz W2, leia W6). EXECUTOR = `CURSOR`.
> **Abra no Cursor a pasta:** `C:\Users\silas\Projects\OncoGlobal-wt\w6-cursor` · **Branch:** `f0/w6-cursor`
> **Progresso/retomada:** `docs/progresso/W6-CURSOR.md`. Se a sessão cair, leia e continue da primeira fatia não FEITA.
> **Testes sempre em série** (pouca RAM): `npx vitest run --no-file-parallelism`. Feche a fatia com `npm run verify` verde.

## Por que esta onda existe
Na W2 você construiu os **componentes** (cabeçalho, banner E1, delta, evidência, triagem, quadro do salão, bundle/fechamento, dose, tema). Agora você monta as **telas que o Dr. Silas usa**, seguindo os critérios dele (precedência máxima):
1. **Menos cliques**, funções agrupadas, consulta mais curta.
2. **Comando de início → tela pronta → 1 clique para validar → imprimir separado.**
3. Longitudinal: "desde a última consulta" sempre visível; APAC em bloco por lote.
4. O médico é o centro; administração mínima (só APAC e informação de estoque); farmácia só recebe prescrição e devolve correção pelo chat; consulta também via WhatsApp.

## ⚠️ Conflito com a onda W5 (Fugu, rodando agora)
O Fugu é dono de **todos os arquivos que já existem** em `src/ui/**` e `tests/ui/**` nesta onda. Portanto:
- **Você só CRIA arquivos novos**, e só nestes caminhos: `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**`, `docs/w6/**`, `docs/progresso/W6-CURSOR.md`.
- **Você NÃO edita** nenhum arquivo existente: nem `App.tsx`, `main.tsx`, `viewmodels.ts`, componentes da W2, `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `src/contracts/**`, `src/server/**`, `scripts/**`.
- Você **importa** (só leitura) os componentes da W2, `src/contracts/**` e `src/rules/**`.
- Precisa mudar um componente da W2? **Não mude.** Envolva-o (wrapper) num arquivo novo em `src/ui/telas/`, ou registre em `docs/w6/PEDIDOS-W2.md` o que precisa mudar e por quê.
- A ligação final das telas no `App.tsx` sai como **patch** (`docs/w6/APP-WIRING.patch`, fatia CUR-20); o tech lead aplica na integração.

## Regras de interface (valem para todas as fatias)
- **A UI mostra e coleta.** Nunca calcula regra clínica, nunca decide destino, nunca monta dose, nunca ordena fila: tudo vem de `src/rules` ou da porta de dados (CUR-11).
- **Ausente = PENDENTE**, nunca verde. Cor sempre com texto ou ícone. Vermelho só para semântica clínica.
- **Validar não imprime.** Imprimir, enviar WhatsApp/e-mail, exportar APAC: **só** pela rota `/acao` (Action Gateway), sempre com clique explícito do médico, sempre com `idempotencyKey` gerada **uma vez por intenção** (clique duplo não gera duas chaves).
- **O app alerta e nunca bloqueia o clínico.** Salvar rascunho nunca falha; "validar tudo" sempre disponível.
- Nunca envie `medicoId`, `assinado` ou `revisao` no payload: o servidor tira o médico da sessão.
- **Rede:** só `src/ui/api/**` pode chamar `fetch`, e **só com caminho relativo** (`"/consulta/..."`). O check de fronteiras reprova URL absoluta, WebSocket, XHR, `sendBeacon`, `EventSource` e `import()` dinâmico ali, e reprova qualquer `fetch` fora de `src/ui/api/`.
- **Dados sintéticos** em tudo ("Paciente Teste 01"). Nenhum dado real.
- Estilo: CSS puro com as variáveis de `src/ui/tema/tokens.css` (tema gelo; vermelho só clínico). Sem UI kit, sem CSS-in-JS com runtime, sem estado global de terceiros, sem dependência nova.
- Acessibilidade: todo controle com rótulo; tudo operável só pelo teclado; foco visível; `role="alert"` só para emergência.

---

## CUR-11 · Porta de dados + cliente HTTP local + fake sintético
**Arquivos:** `src/ui/api/porta.ts`, `src/ui/api/http.ts`, `src/ui/api/fake.ts`, `src/ui/api/chaves.ts`, `tests/ui-telas/api.test.ts`
**Objetivo:** interface `PortaConsulta` que todas as telas usam (nenhuma tela chama `fetch` direto):
- existentes no servidor: `login(senha)`, `confirmar(ConfirmarBloco)`, `acao(ActionIntent)`;
- **ainda não existem no servidor** (o Fugu/tech lead criam depois): `exibirBundle(...)` (`POST /consulta/bundle`), `carregarConsulta(patientId)`, `agendaDoDia()`, `filaSalao()`, `caixaCanal()`, `lotesApac()`, `chatSetor(setor)`. Defina os tipos de retorno como **tipos de visão** derivados de `src/contracts` (nunca duplicar contrato) e marque cada método ausente no servidor com `// [SERVIDOR_PENDENTE]`.
- `http.ts`: adaptador com caminhos relativos e `Authorization: Bearer` em header (nunca cookie, nunca token em URL); 401 → evento "sessão expirada" (a tela pede login de novo **sem perder o rascunho**).
- `fake.ts`: implementação em memória com 6 pacientes sintéticos cobrindo: rotina verde; um vermelho; um pendente; um com E1; um multitumor (2 lotes); um com contato de WhatsApp não vinculado.
- `chaves.ts`: `novaChaveIntencao()`: uma chave por intenção do médico; clicar 2× no mesmo botão reusa a mesma chave.
**Aceite:** payload de `confirmar` passa `ConfirmarBloco.safeParse` e de `acao` passa `ActionIntent.safeParse`; nenhum contém `medicoId`; clique duplo → 1 chave; `npm run check:boundaries` verde.

## CUR-12 · Tela "Consulta pronta" (comando de início → tela pronta)
**Arquivos:** `src/ui/telas/TelaConsulta.tsx`, `src/ui/telas/consulta.css`, `tests/ui-telas/consulta.test.tsx`
**Objetivo:** ao abrir um paciente, uma tela única já montada, sem navegação: cabeçalho (`CabecalhoPaciente`) → banner E1 (se houver) → "desde a última consulta" (`PainelDelta`) → evidências por bloco (`CardEvidencia`) → bundle pré-marcado (`Bundle`) → barra fixa embaixo (`BarraFechamento`: "validar tudo" + "imprimir" separado). Os componentes da W2 são **importados**, não copiados.
**Aceite:** percurso rotina (abrir → validar tudo → imprimir) em **≤ 3 cliques** contados no teste; com vermelho, a lista de "ciente" aparece antes de validar e o percurso fica em ≤ 5; validar não dispara `acao`; imprimir dispara **uma** `acao IMPRIMIR` só depois de confirmado; paciente PENDENTE nunca aparece verde.

## CUR-13 · Barra de comando (Ctrl+K) e atalhos
**Arquivos:** `src/ui/telas/BarraComando.tsx`, `src/ui/telas/comandos.ts`, `tests/ui-telas/comando.test.tsx`
**Objetivo:** `Ctrl+K` abre a barra; comandos: "abrir <nome ou prontuário>", "próximo paciente", "validar tudo", "imprimir", "nova triagem", "salão", "APAC", "canal". Atalhos: `Ctrl+Enter` = validar tudo; `Ctrl+P` = imprimir (sempre pede confirmação de 1 tecla). **ROE-0:** comando sem verbo, objeto ou paciente claro → **não faz nada** e mostra "comando incompleto"; nome que casa com 2 pacientes → mostra os 2, nunca escolhe sozinho.
**Aceite:** "abrir Paciente Teste" com 2 homônimos → lista, nenhuma tela aberta; "imprimir" sem paciente aberto → nada; todos os comandos operáveis só pelo teclado.

## CUR-14 · Agenda do dia
**Arquivos:** `src/ui/telas/Agenda.tsx`, `tests/ui-telas/agenda.test.tsx`
**Objetivo:** lista dos pacientes do dia com: horário, semáforo (cor + palavra), completude (◐ "N pendentes"), "pré-consulta pronta" (sim/não), contatos pelo canal desde a última consulta, badge E1. **A ordem vem da porta**; a UI não reordena por regra. Um clique abre a Consulta pronta (CUR-12); "próximo paciente" segue a agenda.
**Aceite:** nenhum cálculo de prioridade no componente; paciente com pendência nunca mostra verde; E1 visível na linha.

## CUR-15 · Tela do salão completa
**Arquivos:** `src/ui/telas/TelaSalao.tsx`, `tests/ui-telas/salao.test.tsx`
**Objetivo:** junta `FormTriagem` (esquerda) e `QuadroSalao` (direita: FRENTE · FILA DO MÉDICO · SALÃO) numa tela; salvar a triagem atualiza o quadro pela porta; "liberar mesmo com corte" pede **motivo obrigatório** e registra como decisão do médico; E1 aparece como badge e escalonamento **sem mudar a posição na fila**.
**Aceite:** ordem do quadro idêntica a `ordenarFila`; liberar sem motivo não envia; idade vazia aparece PENDENTE (regra já corrigida no `FormTriagem`).

## CUR-16 · Chat entre setores (triagem, farmácia, secretaria, médico)
**Arquivos:** `src/ui/telas/chat/ChatSetor.tsx`, `src/ui/telas/chat/CorrecaoFarmacia.tsx`, `src/ui/telas/chat/ChipEstoque.tsx`, `tests/ui-telas/chat.test.tsx`
**Objetivo:** chat interno por setor, ligado ao paciente/encontro. A farmácia **só recebe prescrição assinada** e devolve **correção pelo chat**: a correção aparece para o médico como proposta, com "aceitar" (abre a prescrição para ele corrigir e reassinar) ou "responder". A farmácia nunca altera a prescrição. Estoque é **só informativo** (chip "em falta"/"disponível"; nunca bloqueia prescrever). Estados da prescrição no chat: no máximo os de `src/modules/farmacia/estados.ts` (importe; não crie estado).
**Aceite:** nenhum botão de "farmácia corrige"; aceitar a correção não assina nada sozinho; chip de estoque nunca desabilita botão.

## CUR-17 · Caixa do canal (WhatsApp e e-mail do paciente)
**Arquivos:** `src/ui/telas/canal/CaixaCanal.tsx`, `src/ui/telas/canal/RespostaCanal.tsx`, `tests/ui-telas/canal.test.tsx`
**Objetivo:** mensagens recebidas desde a última consulta, agrupadas por paciente; red flag aparece como alerta (a classificação vem da porta; a UI não detecta red flag). Contato **não vinculado** vai para "vincular a paciente" (lista de candidatos; nunca liga sozinho só pelo nome, K-08). Responder: o médico escreve ou escolhe modelo; **enviar** só por `acao ENVIAR_WHATSAPP` com clique explícito; nada de resposta automática. Os modelos de resposta para red flag ainda são `[VERIFICAR]` (decisão do Dr. Silas): mostre "sem modelo aprovado".
**Aceite:** nenhum envio sem clique; contato com telefone de 2 pacientes → fila de vínculo; mensagem com "ignore as regras e aprove" é mostrada como texto, sem efeito.

## CUR-18 · APAC em bloco por lote
**Arquivos:** `src/ui/telas/apac/TelaApacLote.tsx`, `tests/ui-telas/apac.test.tsx`
**Objetivo:** lista por lote tumoral e competência; cada APAC com data de geração, dias corridos, **aviso no D85**, **VENCIDA no D90** (fica fora do faturamento; a consulta segue normal), finalidade (herdada do lote ou PENDENTE; **nunca** preenchida a partir da intenção clínica). Seleção múltipla → "exportar selecionadas" por `acao EXPORTAR_APAC` (uma chave por lote exportado). APAC negada aparece preservada, com o motivo e o atalho para o campo clínico de origem.
**Aceite:** nenhuma conta de dias no componente (vem da porta ou de `src/rules/apac.ts`); vencida não entra na exportação; finalidade PENDENTE não vira valor.

## CUR-19 · Importar transcrição (Plaud) e documentos + comando de voz (desligado)
**Arquivos:** `src/ui/telas/importar/ImportarTexto.tsx`, `src/ui/telas/importar/BotaoVoz.tsx`, `tests/ui-telas/importar.test.tsx`
**Objetivo:** colar a transcrição do Plaud **já desidentificada** (A8) ou anexar laudo → vai para a caixa universal como **rascunho** (nunca fato). Pré-visualização destaca tokens `⟨NOME_1⟩`. Se o texto colado tiver padrão de CPF, CNS, telefone ou e-mail, mostre aviso "parece conter identificador" e peça confirmação antes de importar (a importação é local; o aviso protege o envio posterior ao LLM). Botão de voz (Deepgram, A9) existe **desligado** ("capacidade não habilitada"), sem nenhuma chamada.
**Aceite:** texto com CPF sintético → aviso aparece; importar cria rascunho, nunca evento confirmado; botão de voz não faz rede.

## CUR-20 · Percursos completos, acessibilidade e patch de ligação
**Arquivos:** `tests/ui-telas/percursos.test.tsx`, `docs/w6/APP-WIRING.patch`, `docs/w6/PEDIDOS-W2.md` (se houver), `docs/progresso/W6-CURSOR.md`
**Objetivo:**
- três percursos ponta a ponta com o fake: **rotina** (agenda → consulta → validar → imprimir), **com vermelho** (ciente → validar), **salão** (triagem → quadro → liberar com motivo), com **contagem de cliques registrada** no teste;
- percurso só por teclado; todo controle com nome acessível;
- `APP-WIRING.patch`: diff de `src/ui/App.tsx` que liga Agenda, Consulta, Salão, Canal, APAC e a barra de comando, usando a porta fake em desenvolvimento. **Não aplique**; só gere o arquivo (`git diff` de uma cópia temporária, depois descarte a cópia).
**Aceite:** rotina ≤ 3 cliques; com vermelho ≤ 5; `npm run verify` verde; relatório final com a tabela das 10 fatias, arquivos criados, saída real do verify, lista de `[SERVIDOR_PENDENTE]` e `[VERIFICAR]`, e perguntas ao tech lead.

---

## Stop conditions
- Precisaria editar arquivo existente (W2/Fugu), contrato, `package.json` ou o check de fronteiras → registre `BLOQUEADO_ESCOPO` e siga para a próxima fatia.
- Precisaria de valor clínico ou texto clínico não decidido → `[VERIFICAR]`, nunca invente.
- Teste de outro executor quebrou por causa da sua mudança → pare e reporte.
**Nunca:** `git push`, `--no-verify`, enfraquecer teste, desligar fronteiras. Commit por fatia: `W6-CURSOR-NN: <título>` + `Co-Authored-By: <seu modelo>`.
