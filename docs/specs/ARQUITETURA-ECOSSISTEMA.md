# Arquitetura do ecossistema (proposta do Dr. Silas, 2026-10-07) × o que o OncoGlobal já tem

> Fonte: texto colado pelo Dr. Silas (patch da "raiz canônica": HARNESS transversal, agentes, LLMs, API/MCP). Registrado como D-W9-55. O arquivo `ONCOGLOBAL-RAIZ-CANONICA.md` (CANONICA) só muda com ordem expressa.

## Raiz proposta
```
                         ONCOGLOBAL
                    ┌── ONCO-HARNESS ──┐  (governança transversal)
               ONCOASSIST          GOVERNANÇA
        ┌───────────┼────────────┐
    MEMORY_OS    BRAIN_OS    MODEL ROUTER
  (longitudinal) (conhecimento) (OpenAI/Claude/Grok)
        └──────── AGENT RUNTIME ─┘
     Motoboy · Peneirador · Rads · Labs · Voice · Carteiro · Auditor
     RECIST · APAC · Prescriptor · Trials · Docs · Statistics · Legal/TI Guardian
                    │
             TOOL ORCHESTRATOR (API · MCP · Plugins · Web · Browser · Computer Use)
                    │
              EFFECT GATE (READ ≠ WORLD_EFFECT)
 Drive · Plaud · WhatsApp · Agenda · oncoMed · consultas-docs · OncoMind
       WORK (consultas/oncoMed)          STUDY (ONCOMIND)
```
Princípios: HARNESS controla identidade, PHI, proveniência, permissões, fonte de verdade, estados, conflitos, promoção, auditoria e efeitos externos; RECIST/resposta/prognóstico: cálculo determinístico, interpretação nasce `PROPOSED`, confirmação humana. "Agente" = responsabilidade delimitada (código, LLM+tools ou composição), não microserviço. LLM pode ler/extrair/classificar/resumir/comparar/redigir/pesquisar/propor; não pode ser fonte canônica, inventar, alterar identidade, promover PROPOSED→CONFIRMED, executar prescrição. Sem LLM: RECIST, Δ%, ClCr, Calvert, datas, hashes, versões, autorização, estado, promoção. MEMORY_OS primeiro (PATIENT_ID → persistência → eventos datados com proveniência → seguimento longitudinal → RECIST → resposta → fatores prognósticos → prognóstico versionado). **RAGGrafo não é fundacional**: entra só se provar ganho de consulta.

## Mapa para o código atual
| Camada proposta | No OncoGlobal hoje | Situação |
|---|---|---|
| ONCO-HARNESS | `src/kernel/harness/gates.ts` (G-02…G-28), `src/server/autorizacao.ts`, `check-boundaries` | **Existe**; W10 amplia (G-07/08/09/27, ownership, SafetyValidator do pipeline) |
| MEMORY_OS | `src/kernel/ledger` (SQLite WAL, eventos imutáveis) + `src/kernel/projections` + `src/kernel/identity` | **Existe** e é relacional (D-W9-44); timeline longitudinal = FUGU-10 |
| BRAIN_OS | `corpus/` (rulesets, packs, templates, fichas) + `docs/referencias/` + `ragGRAFO/oncologia` (referência) | **Existe**; grafo é referência, não fundação — coerente com a proposta |
| ONCOASSIST | contratos de agentes (`src/contracts/agentes.ts`), UI OncoChart (D-W9-35/40) | Parcial; LLM desligada |
| MODEL ROUTER (multi-LLM) | Provider único decidido (D-W9-15: OpenAI Luna GPT-6.1), desligado | **Lacuna**: router não existe; proposta pede OpenAI/Claude/Grok com task contract |
| AGENT RUNTIME | `src/orchestration/maestro.ts` + `ork.ts`; 18 agentes `AG-xx` em `corpus/capabilities.v1.json` com dono por objeto | **Existe** com nomes AG-xx; nomes Motoboy/Peneirador/… são da skill SILAS NEGRÃO (D-W9-21) — falta tabela de correspondência |
| Agentes de domínio | RECIST (cálculo pendente), APAC (`src/modules` + `src/apac` W10), Prescriptor (`src/rules/prescricao` W10), Docs (modelos 01–10), Statistics (D-W9-44), Trials (POSSIBLE_MATCH, Q48) | Parcial |
| TOOL ORCHESTRATOR (API/MCP/plugins/web/browser/computer use) | Configurações listam skills/plugins/MCP **desligados** (D-W9-16); sem orquestrador | **Lacuna** (v2) |
| EFFECT GATE | `src/kernel/gateway` (Action Gateway, idempotência, 6 verbos: IMPRIMIR, ENVIAR_WHATSAPP, ENVIAR_EMAIL, AGENDAR, EXPORTAR_APAC, BACKUP_LOCAL) | **Existe** para WORLD_EFFECT; **READ externo** (Drive, PubMed) ainda não modelado |
| WORK × STUDY | Q1/Q54: WORK clínico; ONCOMIND fora | **Existe** |
| Voice | Plaud manual desidentificado (A8), comando curto Deepgram (A9) | Parcial; Whisper realtime = TO-BE |

## Lacunas a decidir (Dr. Silas)
1. Model router multi-LLM (OpenAI + Claude + Grok) × provider único da D-W9-15.
2. Verbos de leitura externa (READ: Drive, PubMed, diretrizes, trials) no gateway, separados de WORLD_EFFECT.
3. Tabela de correspondência nomes de agentes (Motoboy… ↔ AG-xx) — proposta: manter os nomes de função da skill como rótulo, AG-xx como id.
4. Agentes RECIST e prognóstico versionado entram em qual onda (cálculo determinístico já previsto; interpretação PROPOSED).
