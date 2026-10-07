# SSOT — ONCOGLOBAL / ONCOMIND
## Fonte Única de Verdade · Documento Canônico

**Autoridade:** Dr. Silas Negrão — Patos, Paraíba, Brasil
**Status:** CANONICA — VETADO alterar sem ordem explícita
**Versão:** 1.2 · 2026-10-07 (substitui a 1.1 de 2026-10-05; histórico na seção 9)
**Ordem de atualização:** Dr. Silas, 2026-10-07 ("sim, aplica"); v1.1 em 2026-10-05 ("SIM, ATUALIZA CANONICA", Q3)
**Raiz do ecossistema:** `ONCOGLOBAL-RAIZ-CANONICA.md` (HARNESS, MEMORY_OS, BRAIN_OS, model router, agentes, tool orchestrator, effect gate)
**Governo superior:** LLM-CENTER-CONSTITUINTE (OMBRO_AMIGO)
**Especificação executável:** `PLANO-FINAL-ONCOGLOBAL-v1.1` (repo `silasjuba-del/OncoGlobal`, `docs/`) — 59 decisões Q01–Q59 + 11 decisões A1–A11

---

## 1. GENEALOGIA E TERRITÓRIOS

```
DOCTOR_OS → SUITE_DOCTOR → ONCOMIND (WORK+STUDY, v1.0) → separado em v1.1:
ONCOGLOBAL (ecossistema / asa)
  ├── WORK  → OncoGlobal  (repo silasjuba-del/OncoGlobal) · assistência clínica · ONDE O CÓDIGO NASCE
  ├── STUDY → OncoMind    (fora do OncoGlobal; outro projeto) · estudo, flashcards, segundo cérebro
  ├── CONS-DOC (consultorio-docs) · UI do consultório de hoje · continua existindo; não é o destino do WORK
  └── OncoAssist · assistente pessoal persistente do Dr. Silas, com casa própria; trafega pelos territórios autorizados (RAIZ §3)
```

| Território | Papel | Regra |
|---|---|---|
| **WORK / OncoGlobal** | motor longitudinal de contexto oncológico, centrado na consulta paciente ↔ médico | todo código novo do WORK nasce no repo `OncoGlobal` (Q1) |
| **STUDY / OncoMind** | aprendizado sobre conhecimento anonimizado | fora do OncoGlobal (Q54); o identificador `oncomind` não entra em tabela/rota/entidade de paciente |
| **CONS-DOC** | UI atual do consultório | só se reaproveitam ideias; nada é importado sem revisão |

## 2. PRINCÍPIOS

1. IA propõe → código calcula/valida → **médico decide, corrige e assina**.
2. **Médico no centro; vida leve ao médico.** Administração mínima: APAC + estoque informativo; farmácia só recebe prescrição e devolve correção no chat.
3. **O app alerta e nunca bloqueia o clínico.** Bloqueia só: artefato (ex.: APAC incompleta não emite), segurança (PHI, sessão) e autoridade (IA assinando).
4. **Dado ausente = PENDENTE**; ausente nunca é VERDE; VERDE ≠ liberado.
5. **Backend transfere, não traduz.** Intenção clínica (4) e finalidade APAC (5) são campos distintos, sem conversor.
6. **Dados de paciente ficam no PC do Dr. Silas.** Exceções expressas e únicas: comando curto de voz → Deepgram Nova-3 (A9); mensagens via Meta/WhatsApp (A10); transcrição do Plaud copiada já desidentificada (A8). **Nenhum dado identificável vai a LLM** (Q52). Backup só em HD externo cifrado (A11).
7. Menos cliques: retorno de rotina ≤ 5 cliques; 1 clique por bloco + "validar tudo" (confirma e assina só o que está exibido no bundle, A1).

## 3. ARQUITETURA (resumo; detalhe no PLANO v1.1)

- **Stack:** monólito modular Node/TS · **SQLite (node:sqlite)** · **Zod** contrato único · v1 **monousuário no PC** (Q57); setores depois.
- **OncoAssist** = assistente pessoal persistente, verticalizado em oncologia, com identidade, casa e UI próprias (RAIZ §3); orquestra modelos via MODEL ROUTER sob o HARNESS. Não pertence a um aplicativo.
- **Maestro** = tabela de planos por evento (LLM só em pergunta livre). **ORK** = executa, entrega microprompt, supervisiona agentes. ORK-1 ≡ ORK; ORK-2 ≡ Harness clínico + OncoChief.
- **Agentes "burros"** = extrator LLM estreito (sempre desidentificado) + função pura + ruleset versionado; sem ferramenta, sem memória, sem chamar outro agente.
- **Memory_OS** = ledger clínico append-only no SQLite + projeções recomputáveis (snapshot, delta, séries, cumulativos, APAC).
- **Brain_OS** = conhecimento + método + trabalho, associados (packs, rulesets, prompts, playbooks, preferências).
- **Harness** = governança transversal (identidade, PHI, proveniência, permissões, estados, promoção, efeitos externos); gates com teste positivo e negativo; gate sem teste não existe. RECIST/resposta/prognóstico: cálculo determinístico, interpretação `PROPOSED`, confirmação humana.
- **Memory_OS longitudinal** = PATIENT_ID → episódios datados com proveniência → timeline → LesionTrack → RECIST (baseline, alvos, soma, nadir, Δ, RC|RP|DE|PD → PROPOSTO) → resposta/progressão → prognóstico só com variáveis explicitadas (RAIZ §4). Grafo não é fundacional.
- **ESCREVE × AGE:** artefato (médico assina) e efeito externo (só pelo Action Gateway) nunca compartilham caminho.

## 4. ESTADOS (teto 5 por dimensão, Q9)

Semáforo **VERDE · VERMELHO · PENDENTE** · Revisão RAW → INFERIDO → REVISAR → CONFIRMADO → ASSINADO · Destino SALÃO · FILA_MÉDICO · FRENTE · APAC RASCUNHO · EMITIDA · AUTORIZADA · NEGADA · VENCIDA · demais dimensões no PLANO v1.1.

## 5. REGRAS CLÍNICAS LOCAIS DECIDIDAS (Hospital do Bem; fonte: decisão do Dr. Silas, 2026-10-05)

Corte do salão (igual passa): PA sistólica >160 ou <90 · FC >120 ou <50 (D-W9-37) · SpO₂ <88 · temp estritamente >37,8 (37,8 passa; D-W9-38) · Cr >1,5 · Hb <8,0 · ANC <1.500 · plaquetas <100.000 · grau ≥3 (grau 4 = corte + emergência) · ECOG 3–4 (ECOG 2 com tontura não corta) · hemograma válido 7 dias · ausente → PENDENTE → fila do médico. Frente (cama, cadeira, >80) só sem corte e sem pendência. Fila: ECOG4 → ECOG3 → cama → cadeira → >80; empate ECOG maior, depois chegada; E1 escalona por fora da fila. Peso vermelho = perda >5 kg em 60 dias → nutrição + QT adiada + consulta (peso informado nunca dispara sozinho). Dose: −20/−30/−40% sobre a dose **administrada** no ciclo anterior; sem peso → dose anterior + sinal; 2º seguido = VERMELHO; ciclo 1 sem balança → peso informado pelo paciente. AC: ciclo 3 salta o médico só sem corte/pendência. APAC: deriva da prescrição assinada; data = geração no app; aviso D85; D90 o faturamento não emite e a consulta segue. Intervalo de 30 dias da última administração de QT até cirurgia ou RT sequencial. CTCAE v6.

## 6. ONCOASSIST — PODE / NÃO PODE

**Pode:** minutar, resumir, recordar, alertar, buscar conhecimento sem PHI, falar com o médico; **falar com o paciente com limites** (anamnese por roteiro, pedir exame/foto, lembrar retorno; red flag = resposta FIXA + alerta ao médico) — A/Q43; ler e-mail/WhatsApp e avisar contato (Q44); minutar laudo para judicialização (Q48).
**Não pode:** prescrever, liberar QT, assinar, orientar tratamento/dose/diagnóstico ao paciente, declarar elegibilidade de trial, enviar PHI a LLM, transformar sugestão em fato. Visão de TC/RM sem laudo é capacidade **desligada** até validação própria + dossiê Anvisa.

## 7. REGRAS DE OURO (toda LLM deve obedecer)

1. VETADO duplicidade — uma fonte de verdade por conceito.
2. VETADO criar/alterar doc na CANONICA sem ordem expressa.
3. VETADO branch/worktree descontrolado — toda ramificação registrada.
4. VETADO PHI no STUDY e em qualquer LLM.
5. VETADO prescrição automática; QT aparece, não gera farmácia.
6. VETADO comunicação entre projetos sem bridge/contrato.
7. Backend mínimo, não limitado; menos cliques.
8. Chat não é repositório; decisões promovidas vão para CANONICA.
9. Tudo se assina — o que fez, onde parou, quem fez.
10. Alegação não excede a prova: testes reais passando + PR + demo por fase (Q50).

## 8. EXECUÇÃO

Claude **comanda e orquestra** (pensa, arquiteta, integra e codifica o núcleo); executores cumprem: Codex (revisa/audita/codifica), Cursor e Grok (código pesado), GLM (corpus/boilerplate), Kimi (testes/docs), Fugu (fatias longas); ≤5 em paralelo por onda, um dono por arquivo, contratos congelados por onda. Fases: F0 kernel → F1 consulta → F2 canal → F3 salão → F4 APAC/farmácia/estoque → F5 anamnese/voz → F6 multiusuário.

## 9. SUPERADO (histórico preservado)

| Regra da v1.0 | Situação |
|---|---|
| "ONCOMIND = WORK + STUDY" | SUPERADO: WORK = OncoGlobal; STUDY = OncoMind, fora |
| Semáforo verde/amarelo/vermelho | SUPERADO: VERDE · VERMELHO · PENDENTE |
| OncoAssist "NÃO fala diretamente com pacientes" | SUPERADO (Q43): fala com limites (seção 6) |
| CONS-DOC/consultorio-docs como base do código | SUPERADO (Q1): código nasce no repo OncoGlobal |
| Bridge Memory-OS `127.0.0.1:5175` + `longitudinal.json` como memória do WORK | SUPERADO para o OncoGlobal (SQLite local); continua válido apenas para o CONS-DOC |
| "Codex é o write único" | SUPERADO (Q2/Q51): Claude comanda e orquestra executores |
| Whisper como motor de voz | SUPERADO (A6): Deepgram Nova-3 para comando curto; Plaud para consulta inteira |
| Brain-OS = só "como trabalhar" | SUPERADO (Q12): conhecimento + método + trabalho |
| DeepSeek como API interna (em deliberação) | SUPERADO (D-W9-15): provider OpenAI (Luna GPT-6.1), desligado até gates; RAIZ §6 prevê model router multi-LLM |
| OncoAssist como "faculdade dentro do OncoGlobal" | SUPERADO (2026-10-07): assistente pessoal com casa própria (RAIZ §3) |
| "FC <50 não corta" | SUPERADO (D-W9-37): FC <50 vai à fila do médico |
| Estados clínicos do Andar 0 (ABERTO→…→ENCERRADO) | Mantidos como **marcos com data** no TumorLot (não máquina de estado; Q9) |

---

*CANONICA · SSOT v1.2 · 2026-10-07 · atualizado por ordem expressa do Dr. Silas · redator: Claude*
