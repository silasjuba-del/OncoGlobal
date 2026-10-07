# ONCOGLOBAL — RAIZ CANÔNICA DO ECOSSISTEMA

**Status:** CANONICA — DECIDIDO
**Autoridade:** Dr. Silas Negrão
**Versão:** 1.0 · 2026-10-07 (ordem expressa: "sim, aplica")
**Relação:** complementa `SSOT-ONCOMIND-v1.md` (v1.2) e `PLATFORM-GOVERNANCE.md`; detalhe executável no repo `silasjuba-del/OncoGlobal` (`docs/specs/ARQUITETURA-ECOSSISTEMA.md`, `docs/DECISOES.md` D-W9-55/56).

---

## 1. RAIZ

```
                         ONCOGLOBAL
                             │
                    ┌── ONCO-HARNESS ──┐
                    │                  │
               ONCOASSIST          GOVERNANÇA
                    │
        ┌───────────┼────────────┐
        ↓           ↓            ↓
    MEMORY_OS    BRAIN_OS    MODEL ROUTER
        │           │            │
 longitudinal   knowledge    OpenAI/Claude/Grok
        │           │            │
        └──────── AGENT RUNTIME ─┘
                    │
     Motoboy · Peneirador · Rads · Labs
     Voice · Carteiro · Auditor · RECIST
     APAC · Prescriptor · Trials · Docs
                    │
             TOOL ORCHESTRATOR
                    │
        API · MCP · Plugins · Web
        Browser · Computer Use
                    │
              EFFECT GATE
                    │
 Drive · Plaud · WhatsApp · Agenda · oncoMed
 consultas-docs · OncoMind · serviços externos

       WORK                         STUDY
 consultas/oncoMed              ONCOMIND
```
OncoAssist no centro operacional; HARNESS governa; MEMORY_OS persiste; BRAIN_OS fornece conhecimento; agentes executam responsabilidades; LLMs fornecem cognição; API/MCP/plugins fornecem braços; gateways controlam efeitos.

## 2. ONCO-HARNESS — governança transversal
Governa MEMORY_OS, BRAIN_OS, agentes, LLMs e efeitos externos. Controla: identidade, PHI, proveniência, permissões, fonte de verdade, estados, conflitos, promoção, auditoria e autorização de efeitos externos.
RECIST, resposta/progressão e prognóstico ficam sob seus gates: **cálculo determinístico; interpretação nasce `PROPOSED`; confirmação clínica é humana.**

## 3. ONCOASSIST — definição (DECIDIDO / CANÔNICO)
OncoAssist **não é o backend mínimo, não é só "assistente de documentação" e não pertence a um aplicativo.** É o **assistente pessoal persistente do Dr. Silas**, verticalizado em oncologia, com identidade e casa próprias, capaz de trafegar pelos aplicativos autorizados. Suas capacidades formam um único agente:
- **Multimodal:** texto, voz, imagem, screenshot/visão e, no futuro, interação visual/computer use.
- **Pesquisa:** web, diretrizes, PubMed, trials e fontes externas.
- **Comunicação:** WhatsApp e outros canais autorizados.
- **Produtividade pessoal:** agenda, lembretes, recuperação de pendências e contexto.
- **Documentação:** minuta de evolução, receita, requisição, encaminhamento, laudo/relatório médico, APAC e material didático — sempre submetidos à autoridade humana quando produzirem efeito clínico.
- **Orquestração:** seleciona skills, ferramentas, plugins, conectores, modelos e capacidades necessárias à tarefa.
- **Memória/aprendizado:** aprende preferências e padrões operacionais permitidos; recorda contexto, decisões e pendências.
- **Personalidade:** identidade persistente; oncologista clínico virtual crítico/perfeccionista, orientado ao trabalho do Dr. Silas.
- **Interface própria:** UI/casa própria e avatar iconográfico; não precisa "morar" dentro de OncoMind, consultas-docs ou oncoMed.
- **Mobilidade:** pode ser chamado por diferentes LLMs/hosts e atuar nos territórios do ecossistema por contratos/ports.
- **Proatividade controlada:** recorda, relembra, sugere, pesquisa e prepara; efeito clínico ou externo respeita autorização/gateway.

## 4. MEMORY_OS — primeira fundação clínica
```
MEMORY_OS
├── Persistência por PATIENT_ID
├── Episódios/consultas datados + fonte + proveniência
├── Linha do tempo longitudinal
├── LesionTrack / exames seriados
├── RECIST longitudinal
│   ├── baseline
│   ├── lesões-alvo
│   ├── soma
│   ├── nadir
│   ├── Δ absoluto / %
│   └── RC | RP | DE | PD → PROPOSTO
├── Resposta / progressão documentada
└── Prognóstico longitudinal
    └── somente baseado em variáveis/evidência explicitadas
```
Ordem: PATIENT_ID → persistência → eventos clínicos datados com proveniência → seguimento longitudinal (labs, RADS/LesionTrack, tratamento/dose/ciclo, toxicidade, marcadores, performance) → RECIST → resposta/progressão → fatores prognósticos → prognóstico versionado.
**Grafo (RAGGrafo) não é requisito fundacional:** primeiro se prova o modelo longitudinal relacional; grafo entra só se demonstrar ganho real de consulta.

## 5. AGENTES — responsabilidades delimitadas
"Agente" é responsabilidade delimitada; a implementação pode ser código determinístico, LLM+tools ou composição. Não precisam ser microserviços nem LLMs separados.
- **Ingestão:** MOTOBOY (OCR, classificação, data, roteamento).
- **Extração clínica:** PENEIRADOR (anatomopatológico); ALMOXARIFE/RADS (TC, RM, PET, USG, cintilografia; laudo + imagem longitudinal + morfometria supervisionada); ESTUDANTE/LABS (hemograma, renal, hepático, marcadores, IHQ, molecular, biomarcadores); VOICE (Plaud agora; Whisper realtime TO-BE; fala → eventos, sem converter toda fala em comando).
- **Integração:** CARTEIRO (fragmentos → paciente → episódio → conflitos → longitudinal); AUDITOR (completude, inconsistências, APAC, segurança, pendências).
- **Domínios:** RECIST · APAC · PRESCRIPTOR · TRIALS/RESEARCH · DOCUMENT · STATISTICS · LEGAL GUARDIAN · TI GUARDIAN.
Os ids técnicos do código (AG-xx) continuam; os nomes acima são os rótulos de função.

## 6. LLMs
OncoAssist orquestra múltiplas LLMs via **MODEL ROUTER + TASK CONTRACT**, sob o HARNESS; nenhuma vira banco de dados nem autoridade clínica.
- **Podem:** ler, extrair, classificar semanticamente, resumir, comparar, redigir, pesquisar, interpretar contexto e propor.
- **Não podem:** ser fonte canônica, inventar dado ausente, alterar identidade, promover `PROPOSED→CONFIRMED`, executar prescrição, transformar hipótese em fato.
- **Sem LLM (código):** RECIST, Δ%, ClCr, Calvert, datas, hashes, versões, autorização, estado e promoção.
- PHI nunca vai a LLM sem desidentificação local (SSOT §2.6).

## 7. API / MCP / PLUGINS / CONECTORES
TOOL ORCHESTRATOR → API (contrato máquina↔máquina) · MCP (descoberta/acesso padronizado) · plugin/conector (integração empacotada) · web/browser (informação externa) · computer use (sistemas sem API) → **EFFECT GATE**.
O HARNESS distingue **READ** de **WORLD_EFFECT**: ler Drive ou PubMed não equivale a enviar WhatsApp, criar agenda, alterar prontuário ou liberar documento.

## 8. TERRITÓRIOS
WORK (consultas/oncoMed → OncoGlobal) × STUDY (ONCOMIND), conforme SSOT §1.

---
*CANONICA · RAIZ v1.0 · 2026-10-07 · criada por ordem expressa do Dr. Silas · redator: Claude*
