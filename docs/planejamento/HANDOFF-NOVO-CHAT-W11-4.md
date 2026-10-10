# HANDOFF · novo chat · Onda W11-4 (10 fatias: 7 code + 3 hard test) · 2026-10-08

> Cole este arquivo inteiro no novo chat (Claude Code, Opus 5.5 como orquestrador). Ele traz o contexto e os 10 prompts prontos para os agentes Haiku.

## 1. Papel e regras fixas
- Você é o ORQUESTRADOR (Claude Opus 5.5). Dr. Silas é a autoridade clínica final; só ele decide clínica. Agentes Haiku 5.5 ("burros e determinísticos") codam/testam em worktrees isoladas; você revisa, integra (`merge --no-ff`), verifica e publica.
- Regras do projeto (nunca violar): IA propõe, código calcula, médico decide e assina · ausente = PENDENTE (vazio no papel) · conflito nunca some · alerta nunca bloqueia o clínico (só a emissão financeira espera) · junção de paciente nunca automática · só dados sintéticos no repo · IA nunca aparece em documento · semáforo de 3 cores sem amarelo ("verde ≠ liberado"; nunca "liberado/aprovado/apto") · CTCAE v6 · plaquetas < 50.000 = alerta antes do CTCAE · sugestões nascem desmarcadas (pré-marca só do modelo salvo do médico) · Cursor nunca cria documentos em pastas · nenhum agente altera `tests/redteam/**` ou `tests/adv-w8/**` (exceto o orquestrador corrigindo prova comprovadamente defeituosa, mantendo a exigência).
- Respostas ao Dr. Silas: curtas, em português, sem jargão.

## 2. Onde está tudo
- Repo: `C:\Users\silas\Projects\OncoGlobal` (GitHub `silasjuba-del/OncoGlobal`), ramo de integração **`f0/w1-integrado@47f4422`** (publicado).
- Registro de TODAS as mensagens do Dr. Silas: `docs/planejamento/` — `fontes/` (30 textos íntegros M-0…M-AK), `DIARIO.md` (PLN-001…034: ideia × código × lacuna × decisão), `CHATPLAN.md` (árvore), `APAC-MAPA-DE-CAIXAS.md`, `AUDITORIA-PRE-CODIGO-2026-10-07.md`. Ramo de docs: `f0/planejamento` (worktree `OncoGlobal-wt\planejamento`).
- Decisões oficiais: `docs/DECISOES.md` (Q01–Q59, A1–A11, D-W9-xx). Memória Claude: `C:\Users\silas\.claude\projects\C--Users-silas-iCloudDrive-Oncomind-ONCOGLOBAL-ONCOMIND-CANONICA\memory\`.
- Worktrees PRONTAS para esta onda (já criadas de `9e658e0`, com `node_modules` em junção): `C:\Users\silas\Projects\OncoGlobal-wt\w11-h21` … `w11-h30`, ramos `f0/w11-h21` … `f0/w11-h30`. **Antes de começar, atualize cada uma**: `git -C <wt> merge --ff-only f0/w1-integrado` (o integrado avançou para `47f4422`, só docs).
- Verificação padrão: `npx tsc --noEmit` · `node scripts/check-boundaries.mjs` · `node scripts/validate-corpus.mjs` · `npx vitest run` · `npx vitest run --config tests/redteam/vitest.config.ts` · `npx vitest run --config tests/adv-w8/vitest.config.ts`.
- Estado verde em `9e658e0`/`47f4422`: tsc ok · fronteiras 266 · corpus 122 · suíte 283 arquivos / 1.994 testes · red team 226/226 · adv-w8 41/41.

## 3. O que já foi feito (W11-1 a W11-3)
- W11-1: correções Astra (e2e exibe bundle antes de confirmar, pureza RECIST), RT-01/03/07/12/15, gate READ × WORLD_EFFECT, suíte "IA nunca no documento".
- W11-2: alerta plaquetas < 50.000; APAC página 2 (56–85); gates antiglosa AG-13…18; fichas FOLFOX4 com/sem port; identificação APAC a partir do check-in.
- W11-3: `src/rules/retorno.ts` (Retorno operacional), `src/rules/prescricao/receituarioEspecial.ts` + `corpus/regulatorio/medicamentos-controlados.v1.json`, `src/rules/elegibilidadeCiclo.ts` (3 cores), `src/kernel/projections/datasFixas.ts` (4 datas + dias desde), `src/kernel/projections/historicoTratamento.ts`, `src/modules/documentos/resumoLongitudinal.ts` (paraTela/paraDocumento), `corpus/matriz/matriz-universal.v1.json` + `src/rules/matrizUniversal.ts` (RASCUNHO); ataques Jev/UI/APAC; pré-marcação só do modelo do médico (`src/ui/consulta/Bundle.tsx` `marcadoInicialmente`).

## 4. Pendências do Dr. Silas (não decidir no lugar dele)
Curadoria da tabela CID×sexo e da matriz (RASCUNHO) · conferir códigos IBGE contra lista oficial · eixo X não está nas 8 categorias da matriz · Jev retorna ERRO (não PENDENTE/INDETERMINADO) — Astra decide · FOLFOX4: suporte só no D1 e bolus sem tempo · creatinina 0 = PENDENTE (decidido) · trabalho do Cursor em `w10-cursor` ainda sem commit (não tocar).

## 5. Rodapé comum a TODOS os prompts (anexar a cada um)
```
REGRAS FIXAS: não altere tests/redteam/** nem tests/adv-w8/**; não crie arquivos .md/documentação em pastas; só dados sintéticos; sem pacotes novos; sem push; sem rede/LLM real.
VERIFICAÇÃO: npx tsc --noEmit · node scripts/check-boundaries.mjs · node scripts/validate-corpus.mjs · os testes indicados (verdes).
COMMIT único no seu ramo, mensagem em português, última linha: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>.
RELATÓRIO FINAL curto: o que fez, arquivos, saídas dos comandos, hash, e o que precisa de decisão (não decida clínica).
```

## 6. Os 10 prompts

### H21 · CODE · Ligar check-in real e configuração do serviço
Worktree `OncoGlobal-wt\w11-h21`. (1) Mapear o cadastro real/visão de check-in (`src/ui/oncochart/chart-visao.ts` `CadastroModelo08`, `cadastro-sintetico.ts`, rotas de cadastro em `src/server`/`src/app`) para o tipo `CadastroCheckin` de `src/apac/campos.ts`, acrescentando os campos que faltam (CEP, município, UF, raça/cor, etnia, telefones, responsável) como OPCIONAIS; nada inventado; ausente = PENDENTE. (2) Criar a configuração do serviço `servicoTemReceituarioEspecial` (padrão false) num lugar de configuração do serviço (não no perfil de UI) e usá-la em `src/rules/prescricao/receituarioEspecial.ts` via injeção. Testes `tests/w11-adv/checkin-real.test.ts`.

### H22 · CODE · Visão da consulta no servidor (dados novos)
Worktree `w11-h22`. Em `src/server/leituras.ts` (e o tipo `ConsultaVisao` em `src/ui/api/porta.ts`, campos novos OPCIONAIS) expor, calculados no servidor a partir do ledger: `datasFixas` (`projetarDatasFixas`), `historicoTratamento` (`projetarHistoricoTratamento`), `alertaPlaquetas` (`src/rules/plaquetasAlerta.ts`), `elegibilidade` (`src/rules/elegibilidadeCiclo.ts`). Só fatos confirmados; ausente = PENDENTE; `dataReferencia` = data do servidor passada explicitamente (nunca dentro da regra). Atualize `src/ui/api/fake.ts` com dados sintéticos. Testes `tests/w11-adv/consulta-visao.test.ts` (HTTP real do servidor de teste como em `tests/e2e`).

### H23 · CODE · Cabeçalho das 4 datas na UI
Worktree `w11-h23`. Componente `src/ui/consulta/CabecalhoDatasFixas.tsx` com PROPS PRÓPRIAS (tipo local; não importar kernel — respeitar fronteiras): 4 datas (Biópsia · C1D1 · Último estadiamento/reestadiamento com tipo · Última exposição) + "dias desde"; PENDENTE aparece como campo vazio com marca discreta; conflito mostra as duas fontes; nada de cor amarela. Acessível (rótulos, contraste do tema OncoChart). Não ligar na TelaConsulta (o orquestrador liga). Testes `tests/w11-adv/cabecalho-datas.test.tsx`.

### H24 · CODE · Modal Consulta Flash (one click)
Worktree `w11-h24`. Componente `src/ui/consulta/ConsultaFlash.tsx` (props próprias) conforme `docs/planejamento/fontes/M-AK_PLN-031_consulta-flash-one-click.md`: header imutável (DX+TNM+estádio+biomarcador / AP+MUC+alergia+ECOG / tratamento+linha+ciclo), exames recentes ("dentro do limite", NUNCA "LIBERA"; laudo mostra a frase do laudo, não rótulo "ESTÁVEL"), ações de hoje e receitas (pré-marcadas SÓ se origem MODELO_MEDICO; "liberar tratamento" sempre desmarcado), chip APAC/SIGTAP com 3 estados (✓ VERDE / ! PENDENTE / × VERMELHO), bloco "IA FALA" curto, botões [SALVAR RASCUNHO] [FINALIZAR · IMPRIMIR · SAIR]. O botão final NÃO executa efeitos: chama callback `aoFinalizar(plano)` com a lista de efeitos (evolução, pedidos, receitas, APAC como rascunho com pendências, retorno) para o médico ver antes; nunca emite APAC nem envia nada. Testes `tests/w11-adv/consulta-flash.test.tsx`.

### H25 · CODE · Clusters por voz/texto (descrição × ordem)
Worktree `w11-h25`. Módulo puro `src/rules/clusterVoz.ts` + seed `corpus/clusters/clusters-voz.v1.json` (RASCUNHO) para ANEMIA, NEUTROPENIA, IMAGEM, DIARREIA, RETORNO, usando o subconjunto da matriz (`src/rules/matrizUniversal.ts`). Entrada: frase já transcrita + contexto. Saída: `{ intencao: DESCRICAO | ORDEM | NENHUMA, cluster, itensMarcados, pendencias, evidencia (trecho) }`. Regra: DESCRIÇÃO ("está com anemia") abre o cluster SEM marcar nada; ORDEM explícita ("vou pedir ferritina e B12") marca só os itens ditos → DRAFT; negação ("não tem anemia") não abre; nada vira CONFIRMADO; nenhum fármaco/dose é deduzido. Testes `tests/w11-adv/cluster-voz.test.ts` (frases sintéticas, negação, mistura, determinismo).

### H26 · CODE · Biblioteca transversal de emergências
Worktree `w11-h26`. `corpus/rulesets/emergencias-transversais.v1.json` (RASCUNHO, para curadoria) com a união das emergências registradas em `docs/planejamento/fontes/M-D_PLN-003_freeze-v1.1.md` (§5), `M-X_PLN-020_…` e `M-AH_PLN-030_…` (§8): para cada uma, sinais/achados (presentes) e pendências a checar (ausentes), sem doses e sem conduta fixa (kit = categorias de ação, ex.: DESTINO PS, LAB, RAD, ENCAMINHAMENTO, sempre com OUTROS). Avaliador puro `src/rules/emergenciasTransversais.ts`: devolve padrão compatível + evidências presentes + evidências ausentes; NUNCA porcentagem; a PRIORIDADE fica para o médico marcar (campo vazio). Não duplicar nem alterar `rads-emergencias` existente. Testes `tests/w11-adv/emergencias-transversais.test.ts` (compressão medular, neutropenia febril, hipercalcemia, sem PHI, sem %).

### H27 · CODE · Enquadramento regulatório versionado
Worktree `w11-h27`. Módulo puro `src/apac/enquadramento.ts` implementando a regra do Dr. Silas (`fontes/M-AJ_…`, "REGRA MEMORY_OS → oncoMed"): o bloco regulatório é UMA unidade `{ cid, diagnostico, estadio, biomarcador, sigtap, finalidade (escolha do médico), prioridade (marcada pelo médico), competencia AAAA-MM, proveniencia }`; mudança de estágio, linha ou intenção cria NOVA VERSÃO com `supersedes`, sem apagar a anterior; histórico consultável; nenhuma tradução de vocabulário. Testes `tests/w11-adv/enquadramento.test.ts`.

### H28 · HARD TEST · Fuzz determinístico de todas as regras puras
Worktree `w11-h28`. Suíte `tests/w11-adv/fuzz-regras.test.ts` com PRNG semeado (sem pacote novo) gerando ≥ 500 entradas por regra para todos os módulos puros de `src/rules/**` e `src/kernel/projections/**` usados nas ondas W11 (triagem, plausibilidade, plaquetasAlerta, elegibilidadeCiclo, retorno, receituarioEspecial, matrizUniversal, datasFixas, historicoTratamento, antiglosa gates): provar (a) mesma entrada = mesma saída; (b) entradas congeladas não são mutadas; (c) dado ausente nunca produz VERDE/liberado; (d) nunca lança exceção para dado clínico ausente (só para entrada estruturalmente inválida, documentada); (e) nenhuma saída contém "amarelo", "liberado", "aprovado", "apto". Bug real encontrado: corrigir o mínimo e comentar.

### H29 · HARD TEST · Caso ponta a ponta "Paciente Teste 91" (próstata)
Worktree `w11-h29`. Suíte `tests/w11-adv/e2e-paciente-teste-91.test.ts` reproduzindo a simulação da Astra (DIARIO PLN-001): kit sintético → texto colado → extração → revisão EXIBIDA → ledger → datas fixas → histórico → APAC página 1+2 → gates antiglosa → resumo `paraDocumento`. Provar as lacunas de PLN-001: texto colado gera fatos; "nega dor" não apaga a linha inteira; plaquetas, Gleason e ISUP extraídos; fonte LAB_FEED aceita; plaquetas em datas diferentes viram série temporal (não conflito); documento final sem IA. O que falhar: corrigir o mínimo no lugar certo (extração/normalização/contratos) e comentar; o que exigir decisão, relatar.

### H30 · HARD TEST · Segurança e PHI
Worktree `w11-h30`. Suíte `tests/w11-adv/seguranca-phi.test.ts`: (a) varredura do repositório inteiro (exceto node_modules/.git) por CPF `NNN.NNN.NNN-NN`, CNS 15 dígitos, telefones e e-mails, com allowlist explícita dos valores sintéticos já declarados (`123.456.789-01`, `111.444.777-00`, `704202600001234` …) — qualquer outro valor falha; (b) todas as rotas do servidor exigem sessão (sem sessão → 401/403), exceto as declaradas públicas; (c) servidor do OncoAssist liga só em 127.0.0.1; (d) efeito SEND com PHI no payload é negado pelo gate G-02; (e) logs/erros nunca contêm a chave ou PHI; (f) nenhum `VITE_*` carrega segredo. Bug real: corrigir o mínimo e comentar.

## 7. Integração (orquestrador)
Merge um a um em `f0/w1-integrado` (`--no-ff`), resolver costuras (nomes de campo entre H22/H23/H24; H25 depende da matriz; H22 usa H14/H15/H13/H6 já integrados), rodar a verificação completa, corrigir regressões sem afrouxar regras, publicar e registrar no `docs/planejamento/DIARIO.md` como PLN-035.
