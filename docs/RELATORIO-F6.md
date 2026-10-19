# Relatório de Fechamento Técnico — Fase F6 (Multiusuário, RBAC por Setor, Avisos sem PHI, Estatísticas e Isolamento WORK × STUDY)

**Data:** 2026-10-19  
**Modalidade:** `GO_CODE ESCOPADO POR FASE` · **Fase:** `F6 — Multiusuário e Setores`  
**Repositório:** `C:\Users\silas\Projects\OncoGlobal` (`silasjuba-del/OncoGlobal`)  
**Worktree isolada de execução:** `C:\Users\silas\Projects\OncoGlobal-wt\claude-f2-canal-execucao` (`claude/f2-canal-paciente`)  

---

## 1. Escopo Entregue

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
- `consultarEstatisticaServicoF6` reutiliza `projetarEstatisticaLedger` (`src/kernel/projections/estatistica.ts`), expondo `denominadorPacientes`, `totalPacientes`, `eventosPorCategoria`, `pacientesPorCategoria`, `administracoesPorStatus` e `exclusoes` detalhadas sob controle RBAC.
- `validarFronteiraWorkStudyF6` garante a separação estrita entre os territórios `WORK` e `STUDY`, bloqueando qualquer transferência de prontuário ou PHI.
