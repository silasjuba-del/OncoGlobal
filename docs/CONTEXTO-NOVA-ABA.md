# CONTEXTO PARA NOVA ABA · OncoGlobal · atualizado 2026-10-07

> Você é o **tech lead/orquestrador (Claude)**. O Dr. Silas é a autoridade clínica final. Leia este arquivo inteiro e depois `docs/DECISOES.md` (D-W9-01…66) antes de agir.

## 1. Projeto
Motor longitudinal oncológico centrado na consulta do **Dr. Silas** (oncologista clínico, SUS, Paraíba). v1 monousuário, local no PC. Node 24 (`node:sqlite` WAL), TypeScript strict, Zod 4, Vitest 5, React 19 + Vite, `pdfjs-dist` (único acréscimo aprovado).
- Repo `C:\Users\silas\Projects\OncoGlobal` (GitHub `silasjuba-del/OncoGlobal`, privado). Integração **`f0/w1-integrado`** (espelho `f0/w0-contratos`). Último: `cb347af`.
- Worktrees `C:\Users\silas\Projects\OncoGlobal-wt\<nome>`. CANONICA (`...\Oncomind\ONCOGLOBAL\ONCOMIND\CANONICA`): `ONCOGLOBAL-RAIZ-CANONICA.md` v1.0 + `SSOT-ONCOMIND-v1.md` v1.2 + `PLATFORM-GOVERNANCE.md`; só muda com ordem expressa (espelho em `docs/canonica/`).
- Memória do Claude: `C:\Users\silas\.claude\projects\C--Users-silas-iCloudDrive-Oncomind-ONCOGLOBAL-ONCOMIND-CANONICA\memory\` — inclui **"registrar tudo"**: todo material do Dr. Silas vira registro no repo + commit/push, sempre desidentificado.

## 2. Regras que nunca mudam
IA propõe, **código calcula**, médico decide e assina · ausente = PENDENTE (nunca VERDE/0) · conflito nunca some · app alerta e nunca bloqueia o clínico (bloqueia só artefato, saída de PHI e autoridade de IA) · junção de paciente **nunca automática** (caixa de revisão) · efeito externo só pelo gateway · só "Paciente Teste NN" nos testes · PC com pouca RAM: testes **em blocos**, `--no-file-parallelism`, nunca a suíte inteira · contratos em `src/contracts` só o tech lead.
**Exceções de PHI:** A8 Plaud, A9 voz curta, A10 WhatsApp, **D-W9-66 kit PDF → LLM** (via gateway, `store:false`, volta à caixa de revisão). LLM ainda **desligada** (provider D-W9-15: OpenAI Luna GPT-6.1) até adaptador + gates.

## 3. Decisões de hoje mais usadas (detalhe em DECISOES)
Corte do salão: SpO₂<88, PAS<90 (ou >160), FC<50 (ou >120), Hb<8, Cr>1,5, febre **>37,8** estrita, N<1.500, PLQ<100.000, ECOG 3–4 · porta de ciclo = limiar de **bula**, não grau CTCAE · agenda: ≥5 h só até 12h, 5 inícios/30 min · dose: ajuste só −20/−30/−40; BSA **Mosteller** limitada a 1,40–2,20 m²; Calvert com ClCr ≤ 125; peso vale 30 dias · fichas: 5-FU 46 h sem bolus; antiemese ondansetrona + dexa + prometazina (sem NK1); cimetidina em taxano; hidratação Mg/K na cisplatina D1 e D8; SOnHe resolve divergências; Mayo 425; carbo semanal AUC 2; AT doxo 60; FLOT 5-FU 2.400; GEMOX oxali 100; temozolomida C1 150 → 200 · RECIST linfonodo: eixo curto ≥15 alvo, 10–15 não-alvo · nódulo <1 cm = indeterminado (TC em 4 meses) · lateralidade/anatomia×sexo/pTNM (D-W9-05/06/07) · 4 classes de medicação (PRÉ-QT, QT, PÓS-QT, NÃO ONCOLÓGICAS) · UI-alvo = **OncoChart** · SQLite v1 + estatística liberada · página do paciente v1 = WhatsApp · ExecSpec CKG = **proposta** (D-W9-64, aguardando: spec × implementação).

## 4. Estado da W10 (onda ampla)
**Integrado em `f0/w1-integrado`:** contratos W10 (`src/contracts/w10/`), pipeline do Fugu até FUGU-12, Grok e Cursor parciais, equipe interna (gates G-07/08/09/27 + correção sistemática, prescrição em 4 camadas + morfometria TS, APAC com antiglosa, 72 fichas RASCUNHO, copy/ícones), red team do GLM (227 testes; **26 vermelhos** nos `.adv.ts`, distribuídos em `docs/w10/REDTEAM-DISTRIBUICAO.md`), adv-w8 com 5 vermelhos.
**Commits ainda NÃO integrados:** Grok **19**, Cursor **7**, Astra (cadeia 1 Astra + 5 Lunas) **29**, Fugu 0 (aguardando `docs/w10/FUGU-RODADA-2.md`).
**Próxima ação:** integrar Grok, Cursor e Astra (conferir escopo pelas faixas de `docs/ondas/W10-COMUM.md`, merge `--no-ff`, verificar em blocos: `tsc`, `check:boundaries`, `check:corpus`, testes das pastas, red team `npx vitest run --config tests/redteam/vitest.config.ts --no-file-parallelism`), push.

## 5. Pendências abertas
- Fugu rodada 2: bug "colo uterino" → cólon + lacunas L-01…15 do extrator + red team da faixa.
- Decisões do Dr. Silas: chave de dedupe de exames (laboratório + nº + data de entrada); biomarcadores obrigatórios dos demais tumores (oferecido rascunho SBOC); CKG spec × implementação; INSS metastático; dexametasona D2–D3; interações (ativar item a item); red flags (texto final); fichas a conferir à mão.
- Técnicas: RT-12c (READ no gateway, Luna L2); `ValidationRequirement` a promover a contrato; chave GLM (Z.AI) expirou; exportação SIA aguarda `Layout_Exportacao_APAC.pdf`.
- Propostas de trabalho (ONCOASSIST-PROGRAMA-X-CODIGO.md): model router + cofre de chaves, gateway READ, persona do OncoAssist, custo por tarefa, conexões Drive/Agenda/Gmail desligadas.

## 6. Onde está cada coisa
Prompts de onda `docs/ondas/W10-*.md` · respostas aos executores `docs/w10/` · specs `docs/specs/` · modelos de documento `docs/referencias/modelos/01…11` · referências clínicas `docs/referencias/{evidencias,fornecedores,protocolos,onco-referencia,externos,rads}` · grafo `docs/referencias/ragGRAFO-oncologia/` (fonte em `C:\Users\silas\Projects\ragGRAFO\oncologia`) · aulas PRO 2026 e diretrizes SBOC ficam fora do git (caminhos em D-W9-49/53).

## 7. Como trabalhar
Executores externos em worktree próprio, faixa exclusiva, sem push; tech lead confere escopo, mergeia, verifica em blocos, registra em DECISOES e faz push. Equipe interna = agentes Sonnet em worktrees `w10-int-*`. Commits do tech lead terminam com `Co-Authored-By: <modelo da sessão> <noreply@anthropic.com>`. O Dr. Silas quer respostas curtas, em português, sem jargão; consultar só quando bloqueia (perguntas com opções).
