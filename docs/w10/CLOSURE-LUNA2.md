# Encerramento Luna 2 — F05, F06 e F09

Base: `367825e4e0ae3f9a088256d24a745fd5b3705844`

Branch: `closure/w10-luna2`

Checkout: `C:\Users\silas\Projects\OncoGlobal-wt\w10-finish-luna2`

## F05 — proveniência e unidade de Hb

Implementada uma interface local provisória `ProvenienciaLaboratorial` em `src/rules/triagem.ts`, com valor original, unidade declarada, fonte e data clínica. Quando a proveniência opcional é fornecida, a triagem valida a fonte/data, converte `g/dL` para décimos de `g/dL` e compara `dg/dL`/`g/L` diretamente com a escala congelada de `hbDgDl`. Unidade/origem incompleta ou divergente acrescenta `PENDENTE` e encaminha à fila médica; o corte clínico não muda e `bloqueiaSalvar` continua `false`. Sem o campo opcional, preserva-se o contrato legado, que já declara `hbDgDl` em décimos de `g/dL`.

O root está formalizando o tipo canônico em `contracts/w10/closure.ts`; a interface local tem os mesmos nomes de campo e requer harmonização para importar o tipo canônico. Não foi criada regra de plausibilidade superior: converter `12000 g/L` é matematicamente coerente com a escala declarada, e afirmar impossibilidade clínica exige uma faixa aprovada. A parte de magnitude do RT-07 segue `BLOCKED_MEDICAL_RULE`; os testes RT-07 existentes não foram alterados nem forçados a verde.

Regressões próprias em `tests/closure-luna2/lab-origin.test.ts` cobrem conversão declarada, discordância mantendo o corte, unidade ausente e Hb em conflito sem eleger candidato.

## F06 — READ separado de WORLD_EFFECT

`autorizarLeitura` e `executarLeitura` formam uma fronteira independente de `ActionIntent`. O body contém apenas request ID, finalidade, destino allowlisted, payload mínimo e timeout. Sessão, território e proveniência são resolvidos pelo servidor. O adaptador é selecionado por mapa local de destinos e recebe somente `query`/`refs` e `AbortSignal`; ID, contexto, proveniência e destino não seguem para o adaptador. A auditoria usa destino, códigos e hash dos metadados, sem payload ou PHI literal.

O envio exige sessão vigente, proveniência/contexto válidos, G-02 sobre payload com dicionário de identificadores conhecido, adaptador injetado, timeout e sinal de cancelamento. G-02 detecta PHI conhecida; não representa uma garantia universal de anonimização. Nenhum conector de paciente, segredo de ambiente ou transporte real foi ligado ou executado. Os testes novos usam apenas um adaptador offline.

O tipo do gateway é provisório até ser alinhado com `ReadIntent`, `ReadContext` e `ReadProvenance` do contrato canônico do root. Regressões em `tests/closure-luna2/read-gate.test.ts` cobrem allowlist, sessão, campos forjados no body, G-02, auditoria sem payload, cancelamento e timeout.

## F09 — backup e restauração dos stores locais

O inventário dos proprietários confirmou `ledger.sqlite`, `config-w10.sqlite` e `workspace.sqlite`. O formato interno v2 do backup cifra manifesto, os três snapshots e referências de arquivos. Cada SQLite é capturado pela API `node:sqlite` `backup()` (inclui páginas ainda no WAL), com SHA-256, `PRAGMA user_version`, hash do schema e janela temporal de captura. Restore valida autenticação, manifesto, hashes, versões e `integrity_check` em staging e só renomeia para destino inexistente após todas as verificações. O formato legado v1 permanece legível.

O CLI de backup recebe os três caminhos absolutos dos bancos, raiz dos arquivos, destino e nome; a senha continua em `ONCOGLOBAL_BACKUP_PASSWORD` e é removida do ambiente do processo após a leitura. A API/script não abre bancos reais nesta tarefa. A regressão cria stores sintéticos, mantém uma conexão WAL aberta e confere os três bancos restaurados.

Os três snapshots são individualmente consistentes, mas o SQLite não oferece uma transação única entre arquivos independentes; o manifesto registra a janela de captura em vez de prometer atomicidade global entre os stores.

## Commits e validação

- `79888e2` — backup v2 com manifesto de três stores e restauração validada.
- `ddfb25d` — gateway READ separado do gateway de efeitos, com testes offline.
- `6ae9d45` — fixture de backup conserva WAL ativo durante o snapshot.
- `1e92bf2` — proveniência/unidade de Hb com estado pendente seguro.
- `e0f3e9f` — READ mantém metadados no processo e aplica G-02 diretamente.

`git diff --check` e `node --check` dos dois scripts `.mjs`: `PASS`. Vitest, typecheck e build: `NOT_RUN`, aguardando o lease serial do root. Não houve acesso a bancos de produção, tráfego de rede, push, merge, deploy ou alteração de arquivos fora da ownership.
