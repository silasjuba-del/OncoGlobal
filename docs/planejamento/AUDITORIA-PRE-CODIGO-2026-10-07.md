# Auditoria READ_ONLY antes de codar · 2026-10-07 (PLN-032)

> Pedido do Dr. Silas: "VAMOS COMEÇAR A CODAR. CURSOR E ASTRA JÁ TRABALHARAM MUITO. ESTÁ MODIFICADO. FAÇA UMA AUDITORIA ANTES READ_ONLY."
> Feita só com leitura (`git status/log/diff/grep`, leitura de documentos). **Nada foi editado, mesclado, enviado ou executado** no código. **Não rodei tsc nem testes**: a árvore de `f0/w1-integrado` está suja e tem outro escritor ativo (rodar aqui poderia criar artefatos e confundir). Números de teste abaixo são os que a Astra e a CI registraram, não os meus.
> Instantâneo: repositório `C:\Users\silas\Projects\OncoGlobal` e worktrees em `OncoGlobal-wt`.

## 1. Mapa dos ramos
| Ramo / worktree | Estado | Observação |
|---|---|---|
| `f0/w1-integrado` (checkout principal) | HEAD `707ca8f` (15:15) **+ 31 arquivos sujos (23 modificados, 8 novos), sem commit** | escritor ativo: "writer único" declarado em `docs/EIXO-CORRECAO.md` |
| `codex/w10-entrega-integrada` (Astra, worktree `w10-astra`) | HEAD `23937b2` (17:46), **8 commits à frente** do integrado e 1 atrás; worktree só com `.playwright-cli/` e `output/` não versionados | 3 commits novos às 17:45, **depois** da revisão do operacional |
| `f0/w10-cursor` (worktree `w10-cursor`) | HEAD `9d83008` (02:53) + **6 arquivos sujos** em `src/ui` e `vite.config.ts` | "CURSOR CODANDO" |
| `f0/planejamento` (meu) | `56b862b`; o integrado já recebeu uma cópia (`707ca8f`: "trazer planejamento PLN … M-0…M-Y"); faltam os nós M-Z … M-AK | só docs |
| W1–W9, Lunas 1–5, Grok, Fugu, int-*, redteam | **0 commits à frente** do integrado (já contidos) | podem ser arquivados depois, com decisão do operacional |
| `main` | `c824826` de 02/10, **456 commits atrás** do integrado | a Astra já reconciliou `main` no ramo dela |

## 2. O que está sujo no checkout principal (não commitado)
- **Docs:** `DECISOES.md` (+13 linhas: D-W9-67…72), `README.md`, `CONTEXTO-NOVA-ABA.md`, `canonica/SSOT-ONCOMIND-v1.md`, `w10/REDTEAM-DISTRIBUICAO.md`, `referencias/rads/EMERGENCIAS-RADIOLOGICAS-30.md`; novos: `EIXO-CORRECAO.md`, `canonica/WORK-ARQUITETURA-CLINICA.md`, `referencias/rads/LEXICO-TC-REGIONAL.md`, `referencias/evidencias/ONCOASSIST-KB-ACR-EMERGENCIAS-F2.md`, `w10/PEDIDO-ASTRA-ORQUESTRA-EIXO-2026-10-07.md`.
- **Dados/regras:** `corpus/packs/prostata.v1.json` (→ 1.2.0), `corpus/rulesets/rads-emergencias.v1.json` (→ 1.1.0, 31 linhas), `src/rules/radsEmergencias.ts`; novo `src/rules/kitTumorLot.ts`.
- **UI:** `src/ui/api/fake.ts`, `src/ui/api/porta.ts`, `src/ui/consulta/BarraFechamento.tsx`, `src/ui/telas/TelaConsulta.tsx`; novo `src/ui/consulta/validarComExibicao.ts` (um clique "validar tudo" → `exibirBundle` → `confirmar`).
- **Testes:** 5 `tests/adv-w8/*` (avisos `SEM_IMPLEMENTACAO` desatualizados; N19 passa a chamar o harness), `tests/corpus/*`, `tests/ui-telas/*`, `tests/w10-grok/grok-05-rads.test.ts`; novo `tests/ui/validar-com-exibicao.test.ts`.
- **Risco:** são 393 linhas inseridas/108 removidas que **só existem nesta árvore**. Se alguém trocar de ramo, fizer `git clean`/`reset` ou mesclar por cima, perde-se. **Primeiro ato recomendado: commitar essa fase** (decisão do escritor ativo).

## 3. A entrega da Astra (`codex/w10-entrega-integrada`)
- **Evidência registrada por ela** (candidato `8d060b5`, `docs/w10/ENTREGA-RESULTADO.md`): CI regular **238 arquivos / 1.565 testes PASS** (typecheck + fronteiras + corpus); bloco focal 32 arq./196 testes; **red team W10: 214 PASS / 12 FAIL** (eram 24); W8 **41 PASS**; UI 41 arq./103 testes PASS; build PASS. **Entrega parcial; não é liberação clínica; PR deve ficar rascunho.**
- **12 falhas do red team abertas:** RT-01 (3: nome×identificador, deduplicação), RT-02 (1: homônimos/lateralidade), RT-03 (1: fármaco foneticamente incerto/homóglifo), RT-05 (2: cadeias RADS na fachada), RT-07 (2: contrato de laboratório com unidade/plausibilidade), RT-09 (1: composição agente→agente no ORK), RT-12 (1: READ externo), RT-15 (1: reconciliação planejado×prescrito). Parte são probes que procuram nomes de função antigos.
- **Dez fatias:** PASS F01 (escopo corrigido), F03 (endurecimento), F04, F06 (avaliação do grafo: 2.971 nós, 9.347 arestas, **zero vetores**); PARCIAL F02, F05, F07, F08, F09; F10 pendente. Sem READ externo, sem Plaud/Nova-3 reais.
- **Revisão do operacional (EIXO-CORRECAO):** classificou o diff em `src/` como **MERGE_COM_RISCO** — a revisão de extração poderia gravar `CONFIRMADO` no ledger **sem o bundle ter sido exibido** (A1/G-25) e a projeção poderia pintar laboratório datado de forma enganosa. **Essa revisão é anterior** aos 3 commits das 17:45 da Astra (`bbdb8c4` isolar pacientes e preservar pendências; `239ed56` "exigir revisão exibida antes de confirmar" + Jev; `23937b2` docs). **Precisa de reauditoria do HEAD novo antes de qualquer merge.**
- **Mudanças novas e sensíveis da Astra no HEAD:**
  1. **Novo provedor LLM "Jev"** via `@typesafe-ai/sdk@0.6.0` (dependência nova em `package.json`/lock): `src/kernel/llm/jev/*`, `src/app/oncoassist.ts`, `src/app/oncoassistLocal.ts`, `oncoassist.html`, `scripts/iniciar-oncoassist.mjs`. Opt-in (`ONCOASSIST_JEV_ENABLED=true` + `TYPESAFE_API_KEY`), servidor-only, só classifica o **tipo de fonte** (LAB, RADS, PATH, NOTA, OUTRO, INDETERMINADO) com texto desidentificado; sem chave, devolve PENDENTE e não chama a rede. **Conflita com D-W9-15** (provedor único decidido: OpenAI Luna GPT-6.1, desligado) → exige **decisão do Dr. Silas** sobre aceitar o Jev como provedor e a dependência.
  2. **Entrada `/oncoassist.html`** "com login e agenda reais do ledger escolhido" (porta 127.0.0.1, senha local): revisar contra o gate de PHI e contra a regra de dados só sintéticos no repositório.
  3. **Fim do `CONFIRMADO` sem exibição** (A1/G-25): parece corrigido no commit `239ed56` (`revisaoExtracao.ts` + `leituras.ts`), mas **não verificado por mim**.
- **Sobreposição de arquivos com o checkout principal** (conflito de merge certo): `src/ui/api/fake.ts`, `src/ui/api/porta.ts`, `src/ui/telas/TelaConsulta.tsx`, `docs/CONTEXTO-NOVA-ABA.md`.

## 4. Conflitos de decisão e numeração (resolver antes de escrever código)
| # | Achado | Detalhe | Quem decide |
|---|---|---|---|
| A | **Colisão de número D-W9-67** | o operacional usou D-W9-67 para o **kit baseline TumorLot da próstata**; no meu diário "D-W9-67" era a decisão **CTCAE v6 pura** (plaquetas 20.000 = G3) e **ainda não está em `DECISOES.md`** (só existe a nº 45 "CTCAE v6 desde já"). | operacional: renumerar a minha para o próximo livre (D-W9-73 ou superior) e registrar |
| B | **Nome do território** | resposta do Dr. Silas hoje: "**ONCOGLOBAL — WORK**" (PLN-031). **D-W9-72** (no checkout sujo, também de hoje): OncoGlobal = guarda-chuva; **OncoMind** = projeto solo deste repositório; **WORK×STUDY abolido**. As duas coisas não cabem juntas. | **Dr. Silas** (qual vale e qual veio por último) |
| C | **Semáforo de 3 cores** | decisão nova (sem amarelo em tudo) não está no código nem em `DECISOES.md` além da nº 10. | registrar |
| D | **Pacote de decisões de hoje** (PLN-023 IA nunca em documento; PLN-031 FOLFOX com/sem port, tramadol = receita especial só se tiver, resumo longo, Consulta Flash; PLN-014/015/016 eixos) | só os eixos foram copiados (`EIXO-CORRECAO.md`); o resto ainda não está em `DECISOES.md`. | operacional |
| E | **Tech lead da fase** | `PEDIDO-ASTRA` diz "tech lead: sessão **Cursor** no ramo `f0/w1-integrado`"; as regras do projeto (e sua memória) dizem que o **Cursor não produz documentos em pastas**, e o checkout sujo tem 6 documentos novos/alterados. | Dr. Silas (papéis) |

## 5. Higiene de dados
- **PHI no repositório:** varredura por CPF `NNN.NNN.NNN-NN` e CNS de 15 dígitos no checkout e no ramo da Astra → só valores **sintéticos declarados** (`123.456.789-01`, `111.444.777-00`, `704202600001234`, fixtures "100% inventados"). **Nenhum dado real encontrado.** Tenha a mesma varredura como gate antes de cada merge.
- **Meus registros (`docs/planejamento/**`):** o CHATPLAN e as fontes são desidentificados (PLN-017/019/020/021/027/029 explicitam). Nada de nome de paciente real.

## 6. Estado do código frente às decisões novas de hoje (lacunas para as fatias)
| Decisão | No código hoje |
|---|---|
| Semáforo 3 cores também em elegibilidade/interação | interação já é 3 cores (`semaforoInteracoes`, sem "amarelo" em `src`); **elegibilidade/cluster 4+1 do retorno não existe** |
| CTCAE v6 | `ctcaeGrau.ts` com `ctcae_version`; falta conferir o **corte v6** nas regras `salao-ctcae.v1.json` e o caso "plaquetas 20.000 = G3 → fila, sem E1" |
| FOLFOX com e sem port-a-cath | existem fichas `folfox__*` (cólon/reto, esôfago, estômago) **sem** variante com/sem port e sem menção a port-a-cath |
| Tramadol = receita especial só se tiver | `tramadol` só em `corpus/receitas/toxicidade-fonte-original.v1.md` e `regulatorio/pendencias.v1.json` (PENDENTE_VERIFICACAO); **sem** atributo "controlado" nem configuração "serviço tem receituário especial" |
| IA nunca em documento | `proibidoConter` por origem existe; **falta** teste de varredura de termos de IA nos modelos |
| Resumo longo e Consulta Flash | só `validarComExibicao` (clique "validar tudo"); **sem** template longo, **sem** modal Flash, **sem** objeto `Retorno` |
| APAC página 2 (oncologia/QT/RT) | só página 1 em `src/apac/laudo.ts` |
| Matriz universal / cluster / eixos X-Y-Z | não existem como dado nem como contrato |
| Eixo temporal (4 datas, dias desde) | `tests/w10-eixo-temporal` existe na Astra (snapshot, estatística, RECIST) — não integrado |

## 7. Recomendação de ordem (sem mexer em nada agora)
1. **Congelar o escritor:** um único writer em `f0/w1-integrado`; o Cursor continua em `w10-cursor` (UI de agenda) e **não escreve documentos**.
2. **Commitar a fase suja** do integrado (diff revisado), com a numeração de decisão corrigida (item A) e o nome do território resolvido (item B).
3. **Reauditar `codex/w10-entrega-integrada@23937b2`** contra A1/G-25 e G-02/G-27, com os 4 arquivos de sobreposição e a dependência `@typesafe-ai/sdk`; só então decidir merge `--no-ff` (ou cherry-pick por fatia).
4. **Decisão do Dr. Silas sobre o Jev** (provedor adicional e dependência) e sobre o nome do território.
5. Depois: **fatias de código** na ordem do plano (sem implementar nada ainda): (a) registrar decisões em `DECISOES.md`; (b) CTCAE v6 + corte do salão; (c) fichas FOLFOX com/sem port (doses do sem port: Dr. Silas); (d) atributo "controlado" + config de receituário especial; (e) teste de varredura "sem IA no documento"; (f) APAC página 2 + gates de coerência; (g) objeto `Retorno` + modal Flash + template longo; (h) matriz/cluster/eixos.
6. Cada prompt de executor leva: **sem documentos em pastas**, só dados sintéticos, verificação em blocos, e o relatório no chat.

## 8. O que NÃO foi verificado (limites da auditoria)
- Compilação (`tsc`), testes, build e fronteiras **não foram executados por mim**.
- Não li o diff de código linha a linha: o parecer de "parece corrigido" em `239ed56` é de leitura de títulos e arquivos tocados.
- Não abri os worktrees antigos (W1–W9) além do contador de commits.
- Não há CI do HEAD novo da Astra no que consultei.
