# Inventário técnico parcial — Fase F5 (Anamnese Guiada, Voz no Canal e Revisão Assistida OncoChief)

> Situação revisada em 2026-10-19: **INTEGRAÇÃO PENDENTE — fase não encerrada**. O conteúdo abaixo registra componentes e testes do snapshot `0b00a40`; não comprova funcionamento integral no atendimento. I09: anamnese, voz e revisão assistida têm componentes isolados; suas jornadas completas no servidor e na interface ainda não foram demonstradas. Ver [consolidação](reviews/CONSOLIDACAO-RECEITA-2026-10-19.md) e [auditoria 9X–12X](reviews/AUDITORIA-9X-12X-2026-10-19.md).

**Data:** 2026-10-19  
**Modalidade:** `GO_CODE ESCOPADO POR FASE` · **Fase:** `F5 — Anamnese Guiada, Voz no Canal e Revisão Assistida (OncoChief)`  
**Repositório:** `C:\Users\silas\Projects\OncoGlobal` (`silasjuba-del/OncoGlobal`)  
**Worktree isolada de execução:** `C:\Users\silas\Projects\OncoGlobal-wt\claude-f2-canal-execucao` (`claude/f2-canal-paciente`)  

---

## 1. Componentes implementados

### 1.1 Anamnese Guiada por Roteiro Aprovado (`AG-19`)
- Contrato estrito `RoteiroAnamneseTumor` e `ResumoEstruturadoAnamnese` (`src/contracts/f5/anamneseEOncoChief.ts`).
- `admitirRoteiroAnamneseAprovado` (`src/modules/canal/anamneseGuiada.ts`) recusa qualquer roteiro com `statusCuradoria !== "CONFERIDA_MEDICO"`.
- `obterPerguntaPassoRoteiro` garante que, quando uma reformulação por LLM sem PHI é utilizada, ela jamais inclui dose, posologia, início de medicação ou diagnóstico; caso viole, cai automaticamente na `perguntaCanonica` aprovada.
- **Guarda Adversarial `A13` (`verificarPedidoTerapeuticoNaAnamnese`)**: se o paciente pedir dose, prescrição ou conduta pelo canal, o assistente nunca orienta tratamento — devolve a resposta fixa de segurança encerrada com `"Nada substitui a avaliação presencial do seu médico."` (`D-W9-75`) e escalona ao médico.
- **Resumo Estruturado (`compilarResumoEstruturadoAnamnese`)**: preserva `fontes`, `lacunasExplicitas` (passos obrigatórios não respondidos e documentos/fotos pendentes), `incertezasExplicitas`, `negacoesPreservadas` e `alertasEscalonamentoMedico`, mantendo `avaliacaoMedicaConcluida: false`, `defineDiagnostico: false`, `defineDoseOuPrescricao: false` e `revisao: "REVISAR"`.
- **Bloqueio de Teleconsulta com Ato Médico (`autorizarTeleconsultaComAtoMedicoF5`)**: bloqueia teleconsulta assíncrona com ato médico (`TELECONSULTA_ATO_MEDICO_NAO_HABILITADO_CFM_LGPD`) enquanto não houver enquadramento CFM 2.314/2022 + LGPD aprovado, consentimento específico e médico com CRM na sessão.

### 1.2 Integração de Voz com Consentimento e Expurgo do Áudio (`Q16` / `A5` / `G-23`)
- `processarVozAnamneseComExpurgoAudioF5` (`src/server/f5AnamneseOncoChief.ts`) exige `TERMO_ACEITO` do contato, aplica o gate `G-23` (`g23ComandoDeepgram`: bloqueia áudio longo em comando curto), grava apenas a transcrição validada e o `audioSha256Original`, e zera imediatamente os bytes do buffer de áudio bruto em memória (`audioBrutoApagado: true`).

### 1.3 Revisão Cruzada `OncoChief` sob Demanda (`ORK-2` / `A9`)
- `executarRevisaoCruzadaOncoChiefF5` opera sobre `criarOncoboard` (`src/kernel/llm/oncoboard.ts`) sem criar serviço ou memória paralela (`servicoParaleloCriado: false`, `memoriaParalelaCriada: false`), consultando as personas (`oncologista_clinico`, `cirurgiao_oncologico`, `radioterapeuta`) com desidentificação prévia (`FN-24` + `G-02`) e aplicando a assimetria `A9` (qualquer reprovação determinística do código força `vereditoFinalCodigoPrevalece: "BLOQUEADO_POR_CODIGO"`).
