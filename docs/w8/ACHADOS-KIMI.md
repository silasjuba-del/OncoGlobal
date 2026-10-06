# W8-KIMI · ACHADOS (provas adversariais)

> Onda W8 · executor KIMI · branch `f0/w8-kimi` · base `f0/w1-integrado` @ 243dcae.
> Cada `.adv.ts` reprova um comportamento exigido pelo PLANO/MATRIZ que **não existe em `src/`**:
> o 1º teste de cada arquivo afirma `SEM_IMPLEMENTACAO` (esperado: falha até a implementação existir);
> os demais testes do mesmo arquivo ficam guardados (`if (!fn) return`) como especificação executável
> pronta para virar verde — nenhuma expectativa foi ajustada para casar com o código.
> Rodada final: **9 arquivos · 41 testes · 10 falhas (todas `SEM_IMPLEMENTACAO`) · 31 passando**
> (os que passam hoje são provas de base real: manifesto existe, catálogo de donos não se sobrepõe, etc.).

## Como rodar

```
npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism
```

**Divergência registrada:** o prompt da onda sugere `npx vitest run tests/adv-w8/<arquivo>.adv.ts`,
mas o Vitest raiz só inclui `*.{test,spec}.ts` (não há `vitest.config.ts` na raiz e o `vite.config.ts`
não configura testes) — o comando literal não encontra nenhum teste `.adv.ts`. A config dedicada
`tests/adv-w8/vitest.config.ts` (dentro da faixa do executor) inclui `tests/adv-w8/**/*.adv.ts`.

---

## 1 · G-07 / T-49 — gate de lateralidade PATH×RADS×procedimento×diagnóstico
- **Arquivo:** [g07-t49-lateralidade](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/g07-t49-lateralidade.adv.ts)
- **Severidade:** **S1**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: gate de lateralidade existe em src/kernel/harness` — nenhuma função confronta lateralidade entre fontes; prompts do corpus com o literal "lateralidade" não equivalem a gate (MATRIZ: "nenhum teste confronto PATH×RADS×procedimento com revisão obrigatória").
- **Comportamento exigido (guardado no arquivo):** divergência de lateralidade entre PATH, RADS, procedimento ou diagnóstico ⇒ WARN + revisão humana obrigatória; lateralidade ausente em qualquer fonte ⇒ PENDENTE, nunca PASSA silencioso; concordância plena passa.
- **Causa provável:** o gate nunca foi implementado — a lateralidade ficou em prompt de extração (G-04) sem veredito de confronto.
- **Dono provável:** kernel/harness (execução de gates) + curadoria clínica (Dr. Silas define o domínio de lateralidades válidas por órgão).

## 2 · G-08 / T-50 — gate anatomia × sexo cadastral
- **Arquivo:** [g08-t50-anatomia-sexo](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/g08-t50-anatomia-sexo.adv.ts)
- **Severidade:** **S1**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: gate de anatomia×sexo existe em src/kernel/harness`.
- **Comportamento exigido:** próstata × cadastro F ⇒ revisão de identidade/anatomia (nunca veto automático); mama × cadastro M ⇒ simetria da regra; sexo NAO_INFORMADO ⇒ PENDENTE; combinação coerente passa.
- **Causa provável:** `src/contracts/clinico.ts` tipa `sexoCadastral`/`divergencia`, mas tipo não executa comparação — ficou schema sem gate.
- **Dono provável:** kernel/harness + contracts (curadoria da tabela anatomia×sexo).

## 3 · G-09 / T-51 — gate pTNM exige ressecção + TNM explícito
- **Arquivo:** [g09-t51-ptnm-biopsia](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/g09-t51-ptnm-biopsia.adv.ts)
- **Severidade:** **S1**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: gate de pTNM existe em src/kernel/harness`.
- **Comportamento exigido:** pT vindo de BIOPSIA (sem ressecção) ⇒ campo rejeitado; pT de SURGICAL_RESECTION com TNM explícito passa; cT de biópsia é clínico e passa (a regra só veta o prefixo p); ressecção sem TNM explícito ⇒ PENDENTE, nunca PASSA silencioso.
- **Causa provável:** proveniência tipada em contrato sem enforcement; o plano (Plano:456/672) exige rejeição por prefixo/fonte/specimen.
- **Dono provável:** kernel/harness + curadoria clínica (regra do pTNM).

## 4 · G-27 / N25 — saída externa limpa (sanitizador + gate HALTED)
- **Arquivo:** [g27-saida-externa-limpa](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/g27-saida-externa-limpa.adv.ts)
- **Severidade:** **S0 latente hoje · S1 no momento em que qualquer saída externa for habilitada**
- **Falha-canônica (2):** `SEM_IMPLEMENTACAO: sanitizador de artefato existe em src/kernel/llm` e `SEM_IMPLEMENTACAO: gate de saída externa limpa existe no harness`.
- **Mitigação atual comprovada (KIMI-19):** toda saída externa é recusada em `src/server/autorizacao.ts` (`CANAL_EXTERNO_NAO_HABILITADO`, `DESTINO_NAO_PERMITIDO`), então o risco NÃO é explorável enquanto o egress estiver 100% fechado — daí S0 latente.
- **Comportamento exigido:** PDF com metadado de autor/paciente a caminho de serviço externo ⇒ HALTED; artefato sanitizado (risco BAIXO) com relatório válido passa; saída sem relatório de sanitização ⇒ PENDENTE/HALTED, nunca PASSA.
- **Causa provável:** `SanitizationReport` é só schema (MATRIZ); sanitizador PDF/DICOM/pixel e gate de saída nunca implementados; o teste Parte10R30 F1 piloto não prova implementação.
- **Dono provável:** kernel/llm (sanitizador) + kernel/harness (gate de egress) — mesmo dono do G-02.

## 5 · K-26 / N17 — biblioteca de fichas de prescrição aprovadas
- **Arquivo:** [k26-n17-ficha-inteira](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/k26-n17-ficha-inteira.adv.ts)
- **Severidade:** **S2**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: biblioteca de fichas aprovadas (templateId+version+hash) existe`.
- **Comportamento exigido:** duas versões da mesma ficha ⇒ carrega UMA inteira, identificada por templateId+version+hash; dose remontada de trechos fora de ficha inteira é recusada; versão pedida inexistente ⇒ erro tipado, nunca mistura versões.
- **Causa provável:** receitas estruturais/renders genéricos não são biblioteca de ~50 fichas nem descoberta semântica→carregamento inteiro (MATRIZ: Plano:63/83); a W5 proíbe inventar conteúdo, então a biblioteca depende de curadoria real das fichas.
- **Dono provável:** modules/documentos (mecanismo) + curadoria Dr. Silas (conteúdo das fichas).

## 6 · N19 — gating de merge: diff fora do manifesto reprova antes do merge
- **Arquivo:** [n19-manifesto-merge](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/n19-manifesto-merge.adv.ts)
- **Severidade:** **S2**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: existe harness executável que reprova diff fora do manifesto`.
- **Base real que JÁ passa:** o manifesto W1 existe e declara dono por arquivo + contratos congelados (`docs/MANIFESTO-W1-F0.md:4/:7`) — o teste de base real confirma isso hoje.
- **Comportamento exigido:** diff adulterado fora da trilha declarada ⇒ reprovado com o arquivo nomeado, antes do merge; pinar base+contratos/rulesets/hash.
- **Causa provável:** `docs/w5/ferramentas/claim.ps1` recusa trilha, mas não é harness de rejeição de diff adulterado (MATRIZ: Plano:83; "claim não é harness"; gating de merge é lacuna verificável, não FORA_DO_F0).
- **Dono provável:** tech lead / CI (harness de merge), com apoio do dono do manifesto (K-25).

## 7 · FN-16 / T-34 — semáforo de interações medicamentosas
- **Arquivo:** [fn16-t34-semaforo-interacoes](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/fn16-t34-semaforo-interacoes.adv.ts)
- **Severidade:** **S1**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: semaforoInteracoes existe em src/rules`.
- **Comportamento exigido:** ruleset 100% inativo ⇒ NENHUMA interação vira VERMELHO sem fonte; lista de medicamentos incompleta ⇒ PENDENTE, nunca VERDE; par coberto por interação ATIVA com fonte ⇒ VERMELHO (achado, não bloqueio); "sem interação encontrada" só é válida com checagem completa + ruleset ativo.
- **Causa provável:** `corpus/rulesets/interacoes.v1.json` contém apenas sementes inativas e `tests/corpus/interacoes.test.ts` cobre só estrutura/fonte/inatividade — corpus não substitui a função de runtime (MATRIZ: Plano:384/663).
- **Dono provável:** src/rules (motor) + curadoria do ruleset de interações (ativação com fonte, Dr. Silas/farmácia).

## 8 · T-56 / G-16 — um dono por objeto: write alheio rejeitado em runtime
- **Arquivo:** [t56-g16-owner-write](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/t56-g16-owner-write.adv.ts)
- **Severidade:** **S2**
- **Falha-canônica:** `SEM_IMPLEMENTACAO: veredito de ownership existe no harness`.
- **Comportamento exigido:** agente escrevendo objeto de dono alheio (ex.: AG-04 escrevendo Conversation, dono AG-14) ⇒ rejeitado; dono escrevendo no próprio objeto passa; leitura de objeto alheio não é write e não rejeita.
- **Base real que JÁ passa:** o catálogo real (`src/contracts/agentes.ts:ownerOf` + `corpus/capabilities.v1.json`) tem donos declarados que não se sobrepõem por objeto — o teste verifica isso hoje; o que falta é o **enforcement**.
- **Causa provável:** dono cadastrado não é enforcement runtime (MATRIZ: Plano:463/672).
- **Dono provável:** kernel/harness (veredito de write por ownership).

## 9 · CASO 07 — deduplicação de exames (D1/D2/D3)
- **Arquivo:** [caso07-dedupe](/C:/Users/silas/Projects/OncoGlobal-wt/w8-kimi/tests/adv-w8/caso07-dedupe.adv.ts)
- **Severidade:** **S2 · DEPENDE_W7** (faixa de implementação é `src/leitura`, fora desta onda)
- **Falha-canônica:** `SEM_IMPLEMENTACAO: existe motor de deduplicação de exames (DEPENDE_W7 — faixa src/leitura)`.
- **Comportamento exigido (fixtures reais em `tests/fixtures/caso07/`):** 8 páginas de exame colapsam para 6 exames únicos — cintilografia ×2 idênticas colapsam (chave laboratório+nº exame+data de entrada, MED-5001); reimpressão IHQ com data de extração diferente no topo NÃO impede a dedupe (LAB-9004); RTU e IHQ com mesmo diagnóstico permanecem DOIS exames (não dedupar por conteúdo clínico).
- **Causa provável:** a leitura estrutural de exames (W7) ainda não existe; sem motor, nada verifica a chave de dedupe nem impede contagem em dobro.
- **Dono provável:** modules/leitura (executor W7/W6) + curadoria clínica da chave de dedupe.

---

## Síntese

| # | ID(s) | Severidade | Dono provável | Depende |
|---|---|---|---|---|
| 1 | G-07 / T-49 | S1 | kernel/harness + curadoria | — |
| 2 | G-08 / T-50 | S1 | kernel/harness + contracts | — |
| 3 | G-09 / T-51 | S1 | kernel/harness + curadoria | — |
| 4 | G-27 / N25 | S0 latente → S1 | kernel/llm + harness | egress habilitado |
| 5 | K-26 / N17 | S2 | modules/documentos + curadoria | — |
| 6 | N19 | S2 | tech lead / CI | — |
| 7 | FN-16 / T-34 | S1 | src/rules + curadoria | — |
| 8 | T-56 / G-16 | S2 | kernel/harness | — |
| 9 | CASO 07 dedupe | S2 | modules/leitura | W7 |

**Nota de honestidade:** nenhum dos 13 IDs saiu de `SEM_TESTE` na `docs/w5/MATRIZ.md` (arquivo fora da minha faixa). O que esta onda entregou para cada um: prova adversarial executável (`tests/adv-w8/*.adv.ts`) + este achado. Os IDs G-07, G-08, G-09, G-27, FN-16, K-26, N17, N19, T-34, T-49, T-50, T-51, T-56 agora têm **especificação executável pronta** — basta implementar `src/` e os testes guardados viram verde sem toque no teste.
