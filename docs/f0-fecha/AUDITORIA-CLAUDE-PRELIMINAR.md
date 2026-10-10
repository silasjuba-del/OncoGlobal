# Registro da auditoria preliminar independente

Endpoint Anthropic, modo restricted/safe-mode, ferramentas Read/Glob/Grep, sem execução ou escrita pelo auditor. Modelo confirmado no resultado: claude-sonnet-5-5; 23 turnos, nenhuma recusa de permissão. HEAD f4c4cb0; base f269699. SHA-256 da resposta JSON original: 5b9ed0506ed5faffa9ba010ff2822cbd71b38aefcd9fb893df027b0a704d70c9.

O JSON original e o diff ficam no cache local .git/f0-fecha-audit, preservados sem duplicar todo o código no repositório publicado. O pedido permanece versionável em evidencias/auditoria-claude. A tentativa anterior herdou endpoint ZAI, foi interrompida e não conta para D1. Nenhuma configuração global foi alterada.

Esta leitura é preliminar e parcial: exige correção/reataque de M1/M2 e cobertura complementar de perda de rotas, egress/provider, matriz e demo.

---

# Auditoria somente leitura: HEAD `f4c4cb0`, base `f269699`

Não encontrei ALTO nesta leitura, mas a cobertura é parcial (ver limites). Achei 2 MÉDIOS e 3 BAIXOS. Foram 18 leituras, sem execução de comandos. Não li o diff completo: li o código atual dos arquivos pedidos e não comparei o diff contra as resoluções de A3.

## MÉDIO

**M1. `selecionarContexto` aceita qualquer `tumorLotId` (defeito confirmado pelo código)**
- **Onde:** `src/server/rotas.ts:291-314` valida paciente e encontro, mas nunca o lote. `lerConsulta` faz essa checagem em `src/server/leituras.ts:169` (`TUMOR_LOT_FORA_DO_PACIENTE`), só que a rota Flash ignora o erro em `rotas.ts:893-897`. Também não há checagem de lote em `src/kernel/ledger/writeRouter.ts:31-65`.
- **Cenário:**
  1. Fazer login.
  2. `POST /consulta/contexto/selecionar` com `{patientId: A, encounterId: E de A, tumorLotId: "lote de B ou inexistente"}`. A resposta é 200.
  3. `/consulta/flash/preparar`, `/consulta/bundle` e `/consulta/confirmar` com o mesmo contexto. Todas as comparações passam, porque são feitas contra o próprio contexto forjado.
- **Consequência:** são gravados eventos do paciente A com o lote de outro paciente ou inexistente. A UI só envia lotes vindos de `carregarConsulta`, então o caminho exige cliente HTTP direto com sessão válida.
- **Correção mínima:** em `selecionarContexto`, quando `tumorLotId !== null`, exigir um evento `TumorLot` do mesmo paciente, como em `leituras.ts:169`. Fazer `rascunhoFlash` e `prepararFlash` falharem fechado quando `lerConsulta` devolver `codigo`.

**M2. Drafts sem `contexto` passam sem verificação de encontro/lote (confirmado no código; alcance é hipótese)**
- **Onde:** `rotas.ts:153-156` (`exibirBundle`) e `rotas.ts:187-190` (`confirmarBloco`). Os dois usam `contexto && …`, então `contextoDraft(...) === null` pula a checagem.
- **Cenário:** um draft genérico do paciente A, sem `contexto` e de outro encontro, entra no bundle e é confirmado sob o encontro/lote informado. A única checagem que sobra é `draft.patientId`.
- **Consequência:** fato ou documento é assinado em encontro/lote diferente do de origem. Não há vazamento entre pacientes.
- **Lacuna:** não verifiquei quais produtores de draft omitem `contexto`. Flash, prescrição e triagem incluem.
- **Correção mínima:** para `FATO` e `DOCUMENTO`, exigir `contexto` presente e igual ao do bundle, senão 409.

## BAIXO

**B1. Vínculo de paciente sem evidência de identidade**
- `src/rules/w8/vinculoDocumento.ts:78-79` e `:117`: sem nome nem identificador no texto, `confrontarNome` devolve `excecao:false` e `confrontarNomeIdentificador` devolve `liga:true`.
- `rotas.ts:103-110` lê só o primeiro nome e o primeiro CPF/CNS do trecho. Um trecho com dois pacientes não gera conflito.
- O vínculo exige ação explícita `LIGAR_PACIENTE` e a UI mostra o texto original (`RevisaoExtracaoLocal.tsx:143-147`), então nada é automático.
- A rota legada resolve o encontro sozinha, sem contexto selecionado (`rotas.ts:1103-1109`, `identityOnly`), e liga sem a tela de exibição.
- **Sugestão:** tratar "sem evidência de identidade" como `PENDENTE` com justificativa explícita do médico. Detectar identificadores múltiplos no trecho.

**B2. `bloco` e `reconhecerAlertas` não são usados em `confirmarBloco` (`rotas.ts:175-235`)**
- Só entram indiretamente no hash de `reviewDecisionId` (`rotas.ts:216`). Não li o schema `ConfirmarBloco`, então não sei se ele os valida.
- **Sugestão:** conferir se o contrato ou os gates tornam o reconhecimento obrigatório. Se não, é lacuna de proteção.

**B3. Bundle único por sessão (`sessao.ts:61`): falha fechada, só disponibilidade**
- `prepararRevisao` (`rotas.ts:1317`) e `bundle` sobrescrevem o mesmo slot. Uma resposta atrasada de uma tela, ou a abertura da revisão com a Flash em preview, gera 409 `ESCOPO_ASSINATURA_INVALIDO` ou `BUNDLE_NAO_EXIBIDO`. Nunca assina conteúdo diferente do exibido.
- Retry após sessão expirada, em drafts genéricos sem `documentId` no payload: a versão exibida passa a `revision+1` (`rotas.ts:158`), diverge do `expectedRevision+1` original e dá `DOCUMENTO_NAO_SELECIONADO`. O replay só funciona dentro da mesma sessão.

## Respostas às perguntas

1. **Rotas e proteções perdidas (W10/W11/W12):** não verificado contra o diff. A tabela de rotas em `rotas.ts:238-270` está completa e os gates G25 e A13 estão presentes. A comparação linha a linha com A3 não foi feita.
2. **Assinatura de versão ou conteúdo diferente do exibido:** não encontrei defeito.
   - O servidor calcula o hash e o registra na sessão (`rotas.ts:141-172`).
   - A confirmação exige que id, versão, hash e draft coincidam (`rotas.ts:205-213`).
   - A revisão de revisão de extração compara o comprovante com o hash recalculado e com o bundle (`rotas.ts:1321-1329`).
   - A revisão de `expectedRevision` é conferida dentro da transação (`writeRouter.ts:47-55`). O fluxo síncrono do Node fecha a janela entre a verificação do hash e a gravação, num único processo.
3. **Troca de contexto ou resposta atrasada:**
   - A UI usa o contador `geracao`, descarta respostas obsoletas e confere contexto na resposta (`ConsultaPersistida.tsx:29-37`, `RevisaoExtracaoLocal.tsx:65`).
   - O servidor zera o bundle ao mudar de consulta (`sessao.ts:72-80`) e revalida o contexto em Flash, reconciliação e `oncoassist`.
   - A exceção é M1, por cliente direto.
4. **Ausência virando valor, conflito sumindo, vínculo automático:** conflitos multifonte ficam com `resolvedFactId:null` e `decisaoClinicaTomada:false` (`rotas.ts:637-649`). Datas de tratamento sem suporte dão 409. A UI de reconciliação não renderiza `campos`. O único ponto aberto é B1.
5. **Retry com resposta perdida:** `em` vem da operação existente e o `eventId` é derivado da chave (`rotas.ts:214-228`). O hash do payload dá `OPERATION_HASH_CONFLICT` para a mesma chave com conteúdo diferente (`ledger.ts:26-32`). A Flash usa reserva atômica e `IDEMPOTENCIA_CONFLITO` (`flash.ts:187-191`). A mesma chave não é reutilizável com conteúdo diferente e não vi duplicação de eventos.
6. **Saída de dado clínico, segredos e LLM:** inconclusivo, fora do escopo lido.
   - `/consulta/oncoassist/classificar-fonte` envia texto e um dicionário com nome, identificadores e CRM do paciente a `service.avaliar` (`rotas.ts:726-735`). Não li esse serviço, então não sei se é local.
   - Também não li `autorizarSaida` e o gateway de `/acao`, nem o scanner.
   - O servidor não registra corpo de requisição nem erros (`rotas.ts:1357`). A sessão não tem credencial padrão (`sessao.ts:29`).
7. **Demo e matriz distinguindo F0, HTTP real, sintético e F1+:** não avaliado, pois não li matriz nem demo. O comentário "Composição HTTP real" em `ConsultaPersistida.tsx:12` não foi cruzado com testes.

## Limites da leitura

- Li `rotas.ts`, `sessao.ts`, `flash.ts`, `ledger.ts`, `writeRouter.ts`, `drafts.ts`, `idempotencia.ts`, as duas UIs, trechos de `leituras.ts`, de `vinculoDocumento.ts` e de `gates.ts`.
- Não li a maior parte de `leituras.ts`, o diff (`codigo-f4c4cb0.diff`), os contratos (`ConfirmarBloco`) nem `hashCanonico`. A busca por ele em `src/modules/tipos.ts` não retornou nada, então não verifiquei a canonização do hash.
- Também não li testes, a matriz, o scanner, o provider e `autorizarSaida`.
- Tudo o que está marcado como "confirmado" vem do código lido, sem execução.

**Há ALTO aberto?** Não, dentro desta leitura. M1 e M2 pedem correção e reataque. A revisão final continua dependendo do delta de integração da matriz e do scanner e das perguntas 1, 6 e 7. A decisão de merge continua do Dr. Silas.
