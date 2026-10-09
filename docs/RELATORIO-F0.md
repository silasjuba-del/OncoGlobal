# F0 pronta para merge humano

Código verificado: `dc2e78c`, branch `f0/w1-integrado`, PR [#4](https://github.com/silasjuba-del/OncoGlobal/pull/4). Registro documental de fechamento em 09/10/2026. Main não foi alterada; tag aguarda merge humano.

## Entrega

Integração das entregas aprovadas W0–W12 e planejamento, com rotas e provas adversariais preservadas. Contratos W12 publicados, triagem com desconhecido explícito, modelo padrão Flash persistido, prazo de retorno editável e caixa de configuração com faixa/proveniência corrigidas.

Consulta local conecta vínculo explícito, reconciliação documental sem apagar conflito, resumo revisado, cartão transversal com fonte/data, exibição integral dos documentos antes da assinatura, retomada idempotente e histórico após reabertura. A auditoria levou a correções de lote × paciente e drafts/recibos sem contexto. Prova de consulta completa usa HTTP real e SQLite temporário.

## Evidência medida

| Portão | Resultado |
|---|---|
| Bateria integral local | 2.298 regulares / 327 arquivos; 240 redteam / 31; 41 W8 / 9; todos PASS na mesma rodada serial |
| Tipagem, fronteiras, corpus | PASS; 299 fontes dentro das fronteiras; 125 arquivos de corpus |
| Backup/restore | Incluído e PASS no bloco 06 (tests/backup e percursos integrados) |
| E6b | 6/6 em três rodadas consecutivas; medição adicional 18 HTTP, 19 ações equivalentes, zero correções, jornada sintética 1.225 ms |
| R-34 | 290 linhas: 184 VERDE, zero VERMELHO, 106 N-A com motivo; fases futuras não declaradas implementadas |
| PHI | Scanner atual 13/13; conjunto com W11 59/59; binários e falsos positivos individualizados por hash/contexto |
| Auditoria | Claude operacional + reataque via Anthropic: nenhum ALTO ou MÉDIO aberto; limites e BAIXOS documentados |
| CI de código | Run do PR em dc2e78c PASS; verify 2.452/341, mais redteam e W8; 154 testes redteam se sobrepõem ao verify |
| Demo | API/SQLite/navegador reais; nove capturas, documentos assinados e reabertos após recarga; dados sintéticos |

Fontes: [STATUS](f0-fecha/STATUS.md), [matriz](MATRIZ-RASTREABILIDADE-F0.md), [demo](F0-DEMO.md), [auditoria](f0-fecha/CLAUDE-REATAQUE-SCANNER-Q50.md), [equivalência Git](f0-fecha/EQUIVALENCIA-FINAL.md). Logs brutos, inclusive falhas anteriores, permanecem no repositório. Atualizações documentais posteriores mantêm o código clínico e passam novamente pelos gates documentais e CI.

## Limites e próximos passos

F0 é um núcleo local monousuário verificado com dados sintéticos. LLM externa continua desligada; corpus não curado permanece RASCUNHO. A demo não comprova upload PDF pelo navegador, impressão/exportação, atendimento real ou agendamento persistido das poltronas ilustrativas. Pedido laboratorial da demo conserva itens PENDENTE. A apresentação da UI é básica.

BAIXOS: restrições de drafts legados sem contexto; impressão local ainda não amarrada ao contexto selecionado; cobertura universal de partes ocultas PDF/XLSX e histórico Git não demonstrada; recibo Q50 exige renovação manual depois de mudança clínica; refinamento de textos de rascunho no documento assinado. A ausência de ALTO/MÉDIO na auditoria não elimina esses limites.

F1+: receitas na Flash, orientações do canal curadas, biomarcadores adicionais, jornadas completas CTCAE/RECIST, roteador de modelos, capacidades proativas, grafo/vetores e custo por tarefa. Não foi criado estado clínico novo como atalho de fechamento.

O Dr. Silas faz o merge do PR #4. WIP antigo do Cursor preservado; 89 worktrees inventariados e nenhum removido. Limpeza e CANONICA seguem como propostas separadas, sem aplicação. Tag somente após merge humano.
