# Inventário técnico parcial — Fase F3 (Salão de Quimioterapia)

> Avanço S-F3-04 em 2026-10-19: contingência operacional ligada ao HTTP e à tela, com identidade/contexto, replay, conflito, prévia e reabertura SQLite. Evidências e limites no [relatório da fatia](reviews/F3-CONTINGENCIA-HTTP-2026-10-19.md). A F3 permanece parcial; não houve ativação de regras clínicas pendentes.

> Situação revisada em 2026-10-19: **INTEGRAÇÃO PENDENTE — fase não encerrada**. O conteúdo abaixo registra componentes e testes do snapshot `0b00a40`; não comprova funcionamento integral no atendimento. I07: adiamento e nutrição ainda não têm efeitos completos sobre agenda, recepção e farmácia. Marcadores retornados por funções não comprovam tarefas atribuídas, prazos ou bolsa a recolher. Ver [consolidação](reviews/CONSOLIDACAO-RECEITA-2026-10-19.md) e [auditoria 9X–12X](reviews/AUDITORIA-9X-12X-2026-10-19.md).

**Data:** 2026-10-19  
**Modalidade:** `GO_CODE ESCOPADO POR FASE` · **Fase:** `F3 — Salão: Triagem, Fila, Aplicação e Dose` (`S-F3-01` a `S-F3-04`)  
**Repositório:** `C:\Users\silas\Projects\OncoGlobal` (`silasjuba-del/OncoGlobal`)  
**Worktree isolada de execução:** `C:\Users\silas\Projects\OncoGlobal-wt\claude-f2-canal-execucao` (`claude/f2-canal-paciente`)  

---

## 1. Componentes implementados por fatia

### S-F3-01 — Triagem na Interface e Regras Existentes
- Reutilização integral de `avaliarTriagem`, `validadeHemograma`, `avaliarCorteSalao` (`src/rules/triagem.ts`), `lerTriagens`/`lerSalao` (`src/server/leituras.ts`) e `TelaSalao`/`FormTriagem` (`src/ui/telas/TelaSalao.tsx`).
- `executarTriagemSalaoF3` (`src/modules/salao/operacaoSalao.ts`) consolida destino (`SALAO | FILA_MEDICO | FRENTE`), cortes, pendências, validade de 7 dias do hemograma e explicitação de campos desconhecidos (`idadeAnos: null`, `tontura: null`).

### S-F3-02 — Fila, Eventos do Salão e Interrupções
- **Fila e Frente**: `organizarFilaSalaoF3` aplica `ordenarFila` (`ECOG 4 → ECOG 3 → cama → cadeira → >80 anos → chegada`), expõe `destinosPorEntrada` via `decidirDestino` (`temCorte`/`temPendencia` → `FILA_MEDICO`), mantendo `filaOrdenada`; `FRENTE` exige `temCorte: false` e `temPendencia: false` explícitos; flags ausentes ou parcialmente conhecidas permanecem em `FILA_MEDICO` (K-11 / Q26–Q27), e mantém a emergência `E1` em escalonamento separado sem reordenar a fila (A7).
- **Eventos de Interrupção Operacional (`EventoInterrupcaoSalao`)**:
  - `ALERGIA_INFUSIONAL` → `PARAR_INFUSAO_NA_HORA` + avaliação médica + notificação ao chat da triagem.
  - `VOMITO_DIFICIL` → `PAUSAR_E_AGUARDAR_ESTABILIZACAO` + avaliação médica.
  - `DOR_OU_EXTRAVASAMENTO_INFUSAO` → `AVISAR_ENFERMAGEM_E_MEDICO_NA_HORA`.
- **Tendência de Peso (`DesfechoPesoSalao`, Q24–Q25, A2)**:
  - Perda `> 5,0 kg` em 60 dias (ambas medidas) → `VERMELHO` + `recomendacaoNutricao: PENDENTE_DECISAO_MEDICA` + `recomendacaoAdiamentoQt: PENDENTE_DECISAO_MEDICA` + `passaEmConsultaMedica: true` (médico confirma se perda é real ou erro de medida).
  - `tarefaNutricaoCriada` e `qtAdiada` permanecem `false`: não há tarefa, responsável, prazo ou mudança de agenda produzidos por este módulo. Na leitura de legados, os antigos marcadores calculados são preservados em `efeitosLegadosNaoVerificados` com `verificacao: NAO_VERIFICADO`, separados das recomendações; os efeitos atuais permanecem `false`. O JSON histórico armazenado não é alterado nem comprova execução.
  - Perda exatamente `5,0 kg` → `VERDE` (passa).
  - Diferença com peso `INFORMADO_PACIENTE` → `PENDENTE` (nunca dispara vermelho sozinho).
- **Liberação com Corte (`ExcecaoLiberacaoMedicaSalao`)**: exige sessão médica válida (`medicoId` + `crm`) e motivo justificado não vazio, persistido de forma *append-only* no SQLite.

### S-F3-03 — Dose, Ciclo, Administração e Cumulativos
- **Cálculo de Dose e BSA**: `avaliarDoseECicloSalao` combina `bsaMosteller` ($\sqrt{\text{altura cm} \times \text{peso kg} / 3600}$) e `calcularDose` (`FN-04`), incidindo as reduções de `−20% / −30% / −40%` exclusivamente sobre a **dose efetivamente administrada no ciclo anterior** (Q29 / K-06), mantendo a prescrição assinada inalterada.
- **Regras de Peso por Ciclo**: ciclo 1 sem peso medido aceita `INFORMADO_PACIENTE` (Q31); ciclo subsequente sem peso usa a dose anterior (`ANTERIOR`, `PENDENTE`); 2º ciclo consecutivo sem peso acende `VERMELHO` (Q30).
- **Regra do Ciclo 3 de AC (`FN-09`)**: `cicloVaiAoMedico` permite saltar a consulta médica no ciclo 3 de `AC` **somente** quando não há corte nem pendência (Q32).
- **Cumulativos Efetivos (`calcularCumulativosEfetivosSalao`)**: computa o acumulado por droga exclusivamente a partir de `TreatmentAdministration` efetivas (`OMITIDA` soma `0`, `PARCIAL` soma `quantidadeEfetivaMg`), nunca somando doses apenas planejadas ou prescritas.

### S-F3-04 — Testes Clínicos (`C1–C14`), Folha de Contingência Impressa e Reabertura SQLite
- **Folha Operacional de Contingência (`gerarFolhaContingenciaSalaoF3`)**: valida o gate `G-06` (`g06E1Destaque` bloqueia a geração caso `emergenciaAtiva: true` não tenha banner `E1` explícito) e gera HTML imprimível sem jamais injetar objetos `Alerta` na evolução clínica (`INV-09`).
- **Suíte `tests/f3/salao-c1-c14-e-adversariais.test.tsx`**: exercita `C1–C14`, componentes reais `TelaSalao` e `CalculadoraDose`, geração da folha de contingência e reabertura do SQLite após reinício.
