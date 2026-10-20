# Inventário técnico parcial — Fase F4 (APAC, Farmácia, Estoque e Documentação de Acesso)

> Situação revisada em 2026-10-19: **INTEGRAÇÃO PENDENTE — fase não encerrada**. O conteúdo abaixo registra componentes e testes do snapshot `0b00a40`; não comprova funcionamento integral no atendimento. I05: o registro de negativa de APAC é persistido, mas a projeção do estado vigente ainda diverge na tela. A ordem de decisão e o recurso precisam de integração e prova pela interface. Ver [consolidação](reviews/CONSOLIDACAO-RECEITA-2026-10-19.md) e [auditoria 9X–12X](reviews/AUDITORIA-9X-12X-2026-10-19.md).

**Data:** 2026-10-19  
**Modalidade:** `GO_CODE ESCOPADO POR FASE` · **Fase:** `F4 — APAC, Farmácia, Estoque e Documentação de Acesso` (`S-F4-01` a `S-F4-05`)  
**Repositório:** `C:\Users\silas\Projects\OncoGlobal` (`silasjuba-del/OncoGlobal`)  
**Worktree isolada de execução:** `C:\Users\silas\Projects\OncoGlobal-wt\claude-f2-canal-execucao` (`claude/f2-canal-paciente`)  

---

## 1. Componentes implementados por fatia

### S-F4-01 — APAC Linear, Validação, SIGTAP Versionado e Prazos (`D85 / D90`)
- `executarFluxoLinearApacF4` (`src/modules/apac/laudoAcessoJudicial.ts`) integra `apacGerar` (`FN-10`: exige `revisao: "ASSINADO"` e descarta qualquer tentativa de converter intenção clínica em finalidade APAC, respeitando `G-12`), `validarEmissaoApac` (`FN-11`), `apacPrazo` (`FN-12`: aviso único no `D85`, `VENCIDA` no `D90` impedindo faturamento sem jamais travar a consulta clínica) e `antiglosa` com referência SIGTAP versionada por competência (`corpus/f0c/sigtap/2026-09.json`).

### S-F4-02 — Lotes (`TumorLot` / `ApacBatch`) e Negativa Retrógrada (`FN-13`)
- `montarApacBatch` garante competência única por lote diário (`D-W5-10`), exclui procedimentos cirúrgicos (`AIH`), APACs `VENCIDA` e itens `BLOQUEADO` com motivo explícito sem travar a impressão/exportação dos demais itens válidos.
- `processarNegativaRetrogradaApacF4` e `registrarNegativaRetrogradaNoBancoF4` (`src/server/f4Acesso.ts`) preservam a APAC `NEGADA` com comprovante no histórico *append-only* e mapeiam o código tipado da glosa (`ESTADIO_AUSENTE`, `HISTOLOGIA_AUSENTE`, `TOPOGRAFIA_AUSENTE`, `CID_AUSENTE`) ao campo clínico de origem (`campoOrigem` também projetado em `lerApacs` em `src/server/leituras.ts`).

### S-F4-03 — Comunicação com Farmácia (`D9`) e Chip de Estoque
- `avaliarFarmaciaEEstoqueF4` integra a máquina de estados `D9` (`ENVIADA → CONFERIDA | CORRECAO_PEDIDA → ACEITA`, recusando `EDITAR` pela farmácia com `FARMACIA_NAO_EDITA` e preservando histórico quando o médico recusa correção) e o chip informativo de estoque (`avaliarChip`: `DISPONIVEL | INDISPONIVEL | DESCONHECIDO` com `origem` e `data`, `trava: false`, `sugereTroca: false`).

### S-F4-04 — Minutas de Relatório / Laudo de Solicitação, Acesso e Judicialização (`AG-18` / `Q48`)
- Contrato estrito `MinutaLaudoAcessoJudicial` (`src/contracts/f4/acessoEJudicializacao.ts`) e gerador `gerarMinutaLaudoAcessoJudicial`:
  - Separa explicitamente 4 eixos: **indicação clínica médica**, **registro regulatório** (`REGISTRADO_ANVISA | USO_OFF_LABEL_DOCUMENTADO | NAO_VERIFICADO`), **cobertura padrão** (`INCORPORADO_SUS | NAO_INCORPORADO_SUS | RENAME_PADRAO | SAUDE_SUPLEMENTAR_ROL | NAO_VERIFICADO`) e **disponibilidade local** (`estado`, `origem`, `dataLeitura`).
  - Exige *grounding* verificável: toda afirmação clínica ou científica referencia ao menos uma citação verificada e datada (`FATO_CLINICO_CONFIRMADO`, `DIRETRIZ_OU_ESTUDO_PUBLICADO`, `NORMA_REGULATORIA`, `DOCUMENTO_NEGATIVA_OU_FALTA`).
  - Bloqueia expressões de conclusão jurídica automática (`"direito adquirido"`, `"elegível automaticamente"`, `"garantia de cura"`, `"prometo resposta"`) e objetos `ALERTA` / `CORRECAO_IA` (`INV-09`).
  - Toda minuta nasce em `REVISAR` (`assinado: false`); `assinarMinutaLaudoAcessoJudicialF4` exige o gate `G-03` (`SESSAO` médica com `CRM`, bloqueando assinatura por `AGENTE`/`IA`).

### S-F4-05 — Testes Administrativos e Adversariais
- Suíte `tests/f4/apac-farmacia-estoque-laudo.test.tsx` exercitando `S-F4-01` a `S-F4-05`, UI (`TelaApacLote` + `ChipEstoque`) e persistência/reabertura no SQLite.
