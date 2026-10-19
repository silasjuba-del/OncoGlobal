# Inventário técnico parcial — Fase F6 (Multiusuário, RBAC por Setor, Avisos sem PHI, Estatísticas e Isolamento WORK × STUDY)

> Situação revisada em 2026-10-19: **INTEGRAÇÃO PENDENTE — fase não encerrada**. O conteúdo abaixo registra componentes e testes do snapshot `0b00a40`; não comprova funcionamento integral no atendimento. I06 e STUDY: faltam identidade multiusuário e permissões por pessoa nas rotas reais, além da exclusão de STUDY nas contagens e jornadas operacionais. Helpers testados não comprovam isolamento completo. Ver [consolidação](reviews/CONSOLIDACAO-RECEITA-2026-10-19.md) e [auditoria 9X–12X](reviews/AUDITORIA-9X-12X-2026-10-19.md).

**Data:** 2026-10-19  
**Modalidade:** `GO_CODE ESCOPADO POR FASE` · **Fase:** `F6 — Multiusuário e Setores`  
**Repositório:** `C:\Users\silas\Projects\OncoGlobal` (`silasjuba-del/OncoGlobal`)  
**Worktree isolada de execução:** `C:\Users\silas\Projects\OncoGlobal-wt\claude-f2-canal-execucao` (`claude/f2-canal-paciente`)  

---

## 1. Componentes implementados

### 1.1 Controle de Acesso por Profissional e Setor no Servidor (`RBAC`, `Q40`, `D-F1-13`)
- Contrato estrito `SessaoProfissionalSetorF6` (`src/contracts/f6/multiusuarioSetores.ts`) separando `MEDICO`, `ENFERMAGEM_SALAO`, `FARMACIA` e `SECRETARIA_FATURAMENTO`.
- `autorizarOperacaoSetorialF6` (`src/modules/setores/rbacSetorialF6.ts`) e `verificarEAuditarAcessoSetorialF6` (`src/server/f6MultiusuarioSetores.ts`):
  - **Vínculo por ID nunca concede permissão (`VINCULO_POR_ID_NAO_CONCEDE_PERMISSAO`)**: conhecer ou enviar `patientId`/`encounterId` não autoriza leitura ou escrita fora da fatia do setor;
  - **Visões fatiadas (`obterFatiaSetorialNoServidorF6`)**:
    - `ENFERMAGEM_SALAO`: vê apenas triagem, fila e poltronas do salão (`evolucaoClinicaCompleta: null`, `prescricaoAssinadaFarmacia: null`, `agendaEFaturamentoApac: null`);
    - `FARMACIA`: vê apenas prescrição assinada e disponibilidade de estoque (`evolucaoClinicaCompleta: null`, `triagemFilaSalao: null`, `agendaEFaturamentoApac: null`);
    - `SECRETARIA_FATURAMENTO`: vê apenas agenda, cadastro administrativo e lotes APAC/faturamento (`evolucaoClinicaCompleta: null`, `triagemFilaSalao: null`, `prescricaoAssinadaFarmacia: null`);
    - `MEDICO`: vê todas as fatias integradas, decide conduta, libera corte e assina.
  - **Auditoria append-only (`INV-20`)**: toda tentativa de acesso (permitida ou negada) grava `AuditEvent` em `audit_event`.

### 1.2 Comunicação Operacional por Paciente e Setor (`Q39` / `D-F1-13`)
- `enviarMensagemChatSetorialF6` e `lerMensagensChatSetorialF6` isolam os canais de chat por setor (`TRIAGEM`, `FARMACIA`, `SECRETARIA`, `MEDICO`) e garantem que mensagens de chat nunca sejam promovidas automaticamente ao prontuário clínico (`promovidaAoProntuarioAutomaticamente: false`, zero escrita em `clinical_event`).

### 1.3 Avisos ao Médico Livres de PHI (`Q55` / `Q59`)
- `registrarAvisoMedicoSemPhiF6` emite avisos operacionais contendo apenas `codigoEventoOpaco`, `setorOrigem`, `urgencia` e `referenciaOpacaHash` (SHA-256), validando com `contemPhiResidual` que nenhum nome, CPF, CNS, telefone ou texto livre identificável sai no aviso (`contemPhi: false`).

### 1.4 Estatísticas do Serviço com Denominadores Explícitos (`D-W9-44`) e Separação `WORK × STUDY` (`Q54`)
- `consultarEstatisticaServicoF6` retorna `PENDENTE_ISOLAMENTO_WORK_STUDY`: RBAC sozinho não comprova o território dos eventos. Sem contrato persistente de separação comprovado, a F6 não publica denominadores. O projetor assistencial legado permanece separado e testado; isso não aprova estatísticas multiusuário.
- `validarFronteiraWorkStudyF6` é um gate puro; sua presença não comprova isolamento integral da base nem das rotas. A ativação F6 exige prova própria de WORK/STUDY e permanece pendente.

Revisão adicional PR27: avisos usam a operação específica EMITIR_AVISO_MEDICO e o wrapper de auditoria para tentativas permitidas/negadas. Estatísticas F6 são indisponíveis enquanto falta o contrato persistente de isolamento WORK/STUDY; não foi criado carimbo/default WORK nem reinterpretado evento legado. Esta correção não ativa acesso multiusuário/setorial nem transporte externo.
