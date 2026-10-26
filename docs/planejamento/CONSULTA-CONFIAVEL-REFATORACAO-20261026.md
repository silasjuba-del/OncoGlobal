# Consulta confiável de ponta a ponta — plano de refatoração

Estado: EM EXECUÇÃO. Autorizado por Silas em 2026-10-26; entrega por PR, sem merge automático.
Base: `2c0b652a35b9b892936591649efd0cc5ad582468` (PR #74 integrado).
Branch: `codex/consulta-confiavel-e2e`.

## Resultado observável

Uma consulta sintética percorre a interface real: documento → revisão da fonte → edição médica → preparação → confirmação → documento persistido → reabertura do mesmo SQLite. Falha de rede, resposta tardia e repetição da ação não podem apagar a edição nem produzir confirmação ou duplicação silenciosa. A execução Chromium participa do gate obrigatório já protegido.

## Escopo e invariantes

- Trabalho exclusivamente no worktree dedicado; o WIP principal não é incorporado. Hashes dos arquivos locais registrados antes da execução.
- Dados sintéticos, fonte e trecho identificáveis, negação e incerteza preservadas; nenhuma mudança de dose, esquema, limiar, autorização clínica ou assinatura automática.
- Manter contratos existentes compatíveis. `PRONTO` continua sendo estado técnico; não significa aprovação clínica. A política legada sem reconciliador continua aceitando algum terminal bem-sucedido.
- Não alterar proteções do GitHub: ampliar as dependências do check consolidado existente. Não fazer merge; decisão final do médico.
- Reusar o harness HTTP/SQLite/Chromium; não substituir a jornada real por botões injetados nem por mocks do alvo.

## Lote e responsabilidade

| Frente | Mudança e responsável |
|---|---|
| Orquestração | Escritor ORK: `src/orchestration/**`, regressões em `tests/orchestration/**`. Separar avaliação de conclusão da execução; identificar reconciliador por contrato/identidade, não posição no array; diagnóstico de cobertura e falhas. |
| Camadas | Escritor UI: hook e controlador de modais em `src/ui/oncochart`, integração dos overlays/Jornada e `OverlayFlash`; testes exclusivos em `tests/consulta-confiavel/camadas/**`. Uma autoridade de teclado/foco por documento. |
| Jornada | Escritor E2E: `tests/f1/s12/browser-consulta-confiavel.js`, extensão do harness B2 e fixture sintética, testes em `tests/consulta-confiavel/jornada/**`. Demonstrar persistência após reinício e falhas controladas. |
| Integração | Codex integrador: workflow, plano, evidências, documentação operacional e correções de produto identificadas pela jornada fora dos conjuntos acima. Antes de editar território de agente, transferir responsabilidade explicitamente. |
| Revisão | Revisor sem autoria da frente: diffs, contratos, testes discriminantes e resultado integrado; não publicar autoaprovação. |

## Sequência

1. Confirmar base e preservar WIP; instalar dependências do lockfile no worktree isolado.
2. Implementar as três frentes em territórios disjuntos; executar provas focadas. Registrar regressões encontradas e corrigir a causa dentro do lote.
3. Incluir Chromium entre as dependências do check consolidado e exigir resultado `success`, inclusive quando houver cancelamento/skip.
4. Integrar serialmente; executar typecheck, fronteiras, corpus, testes afetados, suíte integral, jornadas Chromium e provas adversariais configuradas.
5. Revisão independente, correção dos achados, atualização das evidências e PR com base/escopo/limites explícitos. Conferir WIP por hash novamente.

## Critérios de aceite

- Reordenar os passos de um mesmo DAG não altera a conclusão nem permite ignorar validação da saída do reconciliador. Ausência, falha e saída inválida têm prova negativa.
- Cobertura/pendências são explícitas no resultado técnico; política opcional não enfraquece contratos clínicos e o default mantém compatibilidade.
- Somente o modal ativo recebe Escape/Tab; abertura, fechamento e desmontagem mantêm foco válido. Contexto CSS ancestral, controles ocultos, Shift+Tab e atalhos nativos têm regressões.
- A jornada real comprova a edição preservada diante de falha, ação única diante de repetição, revisão explícita e recuperação dos documentos/fontes após reinício do servidor.
- Chromium falho, cancelado ou pulado impede o gate consolidado de ficar verde.
- Evidência indica comando, revisão, resultado e limites. Teste verde não é autorização clínica.

## Refatoração proporcional dos arquivos grandes

O tamanho dos arquivos é indício para investigação, não motivo para dividi-los mecanicamente. Este lote extrai responsabilidades na orquestração e nas camadas porque elas têm defeitos demonstrados e provas de integração.

Para `canalEntrada.ts` e `canalResposta.ts`, a próxima refatoração proposta é separar adaptação HTTP, validação de contexto, coordenação de operações e persistência. Antes de mover código: mapear chamadas/transações/idempotência, criar testes de caracterização com dados sintéticos e definir um único proprietário por fronteira. Preservar a mesma transação e revalidar revisão antes da escrita. Não transportar cálculos clínicos para a UI. Essa reorganização ampla não será misturada ao presente PR sem necessidade demonstrada pela jornada.

Para o editor de prescrição, a próxima extração proposta é o ciclo preparar/confirmar/invalidar, preservando identidade da base, revisão, geração e idempotência. Aceite: mesmos payloads, nenhuma assinatura duplicada e nenhuma prévia obsoleta aproveitada. O lote atual só o altera se a prova E2E demonstrar defeito necessário ao objetivo.

## Recuperação e estado operacional

O checkout principal pode estar em uma base anterior com WIP; ele não deve ser atualizado ou resetado para demonstrar esta entrega. A referência verificável é o SHA do PR e seu worktree limpo. Reverter commits do lote por PR é a recuperação prevista; não há migração de dados autorizada.

## Evidências e continuidade

### Marco de integração

- ORK: avaliação extraída em `conclusao.ts`; Maestro declara política e devolve cópias isoladas. O diagnóstico é retornado em memória pelo ORK, sem payload clínico; o runtime existente não passa a persistir esse diagnóstico.
- Camadas: cinco falhas reproduzidas na base em sete cenários iniciais; controlador único em implementação/validação. Ajuste de setup em U-H1 abre o `details` antes de focar um campo; a asserção permanece e há regressão para campo fechado versus aberto.
- CI: shell do gate testado com `BROWSER_RESULT=success/failure/cancelled/skipped`; somente sucesso aprovou.
- Primeira jornada integrada aprovada: fonte revisada, quatro documentos sintéticos, falha de rede com texto preservado, um salvamento sob reentrada e mesmo hash lógico após reinício. Evidência local fora do Git: `s12-b2-evidence-dY5Owy/resumo.json` no Temp. Segunda rodada acrescenta repetição da confirmação e identificadores de eventos validados.
- Revisão independente ORK/CI: sem bloqueios, condicionada às provas integradas. Revisão de camadas em andamento.

Próxima ação: concluir provas de navegador de camadas, consolidar testes locais e CI integral; registrar evidência final e abrir PR sem merge.
