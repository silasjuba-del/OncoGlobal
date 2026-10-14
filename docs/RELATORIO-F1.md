# F1 — estado de entrega e rota de continuidade

Atualizado em 2026-10-14. **Correções técnicas entregues para revisão; fechamento integral ainda depende dos gates finais, do aceite e das fontes F1-B2.**
Base integrada: `main` em `b12a6b6`. Lote B1: [PR #17](https://github.com/silasjuba-del/OncoGlobal/pull/17), base de retomada `8633ebb`.
Correções Codex: [PR #18](https://github.com/silasjuba-del/OncoGlobal/pull/18), ramo `codex/f1-finalizacao`, encadeado no #17.
Os PRs não foram mesclados nesta retomada.

## Correções comprovadas nesta retomada

| Problema | Correção e prova |
|---|---|
| Peso com mais de 30 dias desaparecia da triagem nutricional | `9e58adb`: medida documentada com data/fonte e pedido de conferir atualidade; peso continua indisponível para dose. `tests/f1/b1/triagemNutricional-consulta.test.ts`. |
| Duas versões de um lote eram escolhidas pela ordem | `9e58adb`: pendência explícita; nenhuma eleição de tumor. IMC independente continua podendo sustentar sugestão. Mesma prova HTTP, nas duas ordens. |
| Sete projeções incorporavam fatos ou retificações posteriores ao encontro | `ae5389d`: limite do encontro antes da resolução de versões, em contexto, histórico cirúrgico, cumulativos, condicionais, instrumentos, interações e intervalo. `tests/f1/s12/horizonte-projecoes.test.ts` e `tests/f0c/intervalo-ciclo.test.ts`. |
| Servidor enviava respostas de sucesso sem contrato | `305f44f`: 54 rotas vinculadas a schemas, compartilhados com a UI quando já existentes. Resposta inválida retorna `RESPOSTA_FORA_CONTRATO`, sem conteúdo no log. `tests/server/contratos-saida.test.ts`. Campos de conteúdo extensível continuam JSON; isto não substitui validação clínica. |
| Pacote declarado público aceitava identificadores estruturais | `c9ad160`: nome rotulado, endereço e nascimento recusados antes de persistir. `tests/f1/s3/biblioteca.test.ts`. Links bibliográficos são permitidos; aprovação continua item a item. |
| Peso e altura desapareciam ao selecionar outro tumor do mesmo paciente | Projeções snapshot/Retrato reconciliadas no escopo PACIENTE; outro paciente continua excluído. `tests/f0c/avaliacao-adversarial.test.ts`, `tests/f1/s2/retrato.test.ts`. |
| Critério ausente ficava diluído no agregado vermelho | `CriterioElegibilidade@1`, com estados ATENDE/NAO_ATENDE/AUSENTE/CONFLITO, fontes e regra quando conhecida. Aplicado aos limiares e à validade de neutrófilos/plaquetas; motivos preservados no lembrete. Sem alterar cortes ou as três cores. |
| Teste de revisão verificava recarga antes do efeito React | `tests/f1/s8/revisao-atualiza-consulta.test.tsx` aguarda a condição de recarga, mantendo a contagem exata e a prova de ocultação da visão antiga. Falha reproduzida no CI. |
| Fechamento do HTTP podia liberar SQLite com trabalho do motor pendente | Encerramento recusa novos pedidos e drena inicialização/rotas/motor antes do close. Testes cobrem inicialização e trabalho posterior à resposta. A relação com o crash nativo ainda exige confirmação pela bateria final. |
| JSON escalar ou chaves JSON escapavam da inspeção de identidade na exportação | Texto decodificado e nomes das chaves passam pela triagem estrutural, inclusive objetos cujo valor é nulo. Metadados de aplicabilidade também são inspecionados na importação clínica. Regressões em `tests/f1/s3/exportar-biblioteca.test.ts` e `biblioteca.test.ts`. |
| Exames concordantes na mesma coleta perdiam fontes no critério | A seleção numérica e a lista de fontes usam o mesmo grupo de exames válidos mais recentes. Todos os eventos/fontes concordantes são preservados para limiar e validade, independentemente da ordem de entrada; exame anterior não é anexado ao critério atual. `tests/f0c/avaliacao-adversarial.test.ts`. |
| Data do serviço inválida convertia pendência de agenda/APAC em erro genérico de contrato | As duas rotas retornam 503 com estado PENDENTE e o código original, como o salão; a recuperação do relógio restaura a leitura 200. `tests/server/contratos-saida.test.ts`: ausência/invalidez, ausência de efeitos e recuperação. |

As regressões foram executadas em vermelho antes das respectivas correções. Baterias executadas: HTTP/dutos/biblioteca, 101 testes; temporal, 56; critérios, 26; portas/encerramento/impressão/exportação, 81; exportação e scanner PHI final, 35. Os conjuntos se sobrepõem e não devem ser somados. Typecheck passou. Uma execução integral anterior concluiu 3.453 testes em 451 arquivos; esse número não substitui a execução do HEAD final. Execuções Windows terminadas em `0xC0000409`, ou que observaram alterações durante o trabalho, não contam como prova final. O pool Windows passou a processos, preservando seleção e execução serial; nenhuma expectativa foi removida.

Em `db9cbce`, `npm run verify` completou **3.538 testes em 454 arquivos**, no Windows, com HEAD e árvore limpa conferidos antes/depois; quatro checks do CI também passaram. As correções posteriores de JSON/metadados e fontes concordantes exigem seus próprios gates. Não se atribui o crash nativo anterior a uma causa única apenas pelo desaparecimento nessa execução.

Em `cf111f6`, os quatro checks do CI passaram; localmente `verify:f1` completou **748 testes em 91 arquivos** e `ui:build` passou, com árvore estável. A execução local de `verify` foi interrompida para a correção de agenda/APAC e não conta como PASS. Após essa correção, o teste HTTP com 61 casos e o typecheck passaram; os gates do commit sucessor são a referência para sua integração.

Navegador real: cólon sintético com PDF/imagem/OCR, confirmação de fontes e achados, assinatura e geração HTML. Retorno canônico: cinco cliques após abrir a consulta, com seis preenchimentos programáticos (não é medida de esforço total de digitação). Após reiniciar o servidor no mesmo SQLite, os históricos conservaram três e cinco documentos, respectivamente, e a reimpressão foi executada. Zero requisições externas da página. Vídeos, imagens, banco e logs sintéticos ficam fora do Git.

Exportação real: 224 arquivos textuais do corpus, incluindo os oito pilares e as árvores consumidas pelo app. Binários/scripts excluídos são inventariados, nunca executados. O pacote foi validado de volta com hashes, metadados derivados, ausência de arquivos extras e estado RASCUNHO/alerta=false. Chaves JSON repetidas são recusadas antes que a inspeção perca valores. A triagem de referências públicas vincula arquivo, campo, hash integral e categoria; o pacote recebido não pode fornecer exceções. Isso não aprova conteúdo clínico nem implementa sincronização do Genspark. O formato de snapshot é distinto de `PacoteBiblioteca@1`; conversão para o loader clínico exige curadoria e contrato por item.

## Organização documental

403 arquivos históricos já incorporados em `main` foram movidos, sem exclusão, para [o arquivo](_arquivo/INDICE.md). O relatório S12 anterior foi preservado [separadamente](_arquivo/RELATORIO-F1-S12-ANTERIOR.md), totalizando 404 documentos e evidências arquivados.
Os 13 arquivos com consumidores conhecidos permanecem nos caminhos originais. O [mapa de movimentações](_arquivo/MOVIMENTOS.json) identifica origem, destino e consumidores. Referências foram atualizadas; gates, testes e corpus não foram arquivados.
As 18 famílias de duplicatas foram inventariadas. As duas fachadas CNS já compartilhavam a implementação de `src/rules/cns.ts`; não há justificativa para remover compatibilidade pública apenas por serem idênticas.

Inventário Git atual: 100 worktrees, dos quais 68 limpos/integrados já estão no arquivo, 9 limpos/integrados são candidatos após o aceite dos PRs, 15 não estão integrados e 8 contêm alterações locais. Nenhum desses checkouts foi removido ou movido nesta retomada. O inventário local registra SHA, branch, status e destinação de cada um; a etapa P1 continua sujeita à pré-condição de integração/aceite do plano.

Métrica de `src/` no ponto de retomada `8633ebb` versus `db9cbce`: 422 → 425 arquivos TS/TSX; 43.982 → 44.159 linhas; 8 dependências e 9 de desenvolvimento em ambos. As validações e os contratos aumentaram o código; não houve redução absoluta do backend nem instalação de dependência de produto.

## Trabalho ainda necessário para o aceite integral A–P

| Eixo | Estado verificável |
|---|---|
| A / B1 | Correções originais preservadas e dois novos achados corrigidos no #18. Revisão final e integração pendentes. |
| B / O | Inventário das duplicatas realizado. CNS, APAC e estatística usam fachadas; orquestração pura e runtime persistente têm responsabilidades distintas. Contratos de resposta compartilhados. Não foram removidas APIs públicas por ausência de consumidor local. Redução absoluta de linhas não foi obtida: foram acrescentadas validações necessárias. |
| C | 54 contratos de sucesso e teste parametrizado de método, autenticação e JSON em todas as rotas. Três rotas lacunares receberam testes de contexto. Cobertura aprofundada positivo/negativo/borda de cada domínio ainda não equivale a esse teste de transporte. |
| D / E | Sete falhas temporais e escopo corporal corrigidos. Maestro/ORK preservado. Navegador e reinício executados; gates finais do HEAD pendentes. |
| F / G / H / I / J / L | B1 e consumidores existentes preservados. A auditoria completa das relações ficha/pack/exames e das jornadas ainda não equivale a encerramento. B2 continua dependente da fonte SISAC. |
| K | Contrato versionado por critério implementado para a porta hematológica e compatível com os agregados legados. Critério reprovado não apaga ausência/conflito nem sua explicação. Demais sinais continuam no contrato agregado existente. |
| M | Novas regressões, HTTP, navegador e reabertura executados. Baterias completas finais ainda precisam ser registradas no HEAD estabilizado. |
| N | Importação/curadoria endurecida; snapshot real de 224 arquivos gerado e validado localmente. Sem rede, ativação ou aprovação coletiva. Conversão do snapshot para itens clínicos não é automática. |
| P | Documentos históricos arquivados com índice. As 100 worktrees foram classificadas; movimentação/remoção pós-aceite continua pendente, com oito árvores sujas preservadas. |

## Dependências externas e limites mantidos

- D-F1-48: a fonte SISAC é necessária para F1-B2. O arquivo `oncoMed_CONSOLIDADO_2026-08-23_2.xlsx` recebido contém casos e auditorias, incluindo dados identificáveis; não é a ficha SISAC original. O Dr. Silas informou que prepara material adicional e packs. Nenhuma linha de paciente foi publicada nem dose reconstruída foi adotada.
- A apostila consolidada recebida tem 1.460 linhas, sem URL/DOI/NCT. A amostra verificada mostrou comparadores incorretos de MajesTEC-3 e fusão de DREAMM-7/8, além de CTCAE v5 e decisões locais divergentes. Avaliação local em `AVALIACAO-FONTES-F1-B2.md`; não foi incorporada como regra. Fontes primárias e localizadores estão nesse documento.
- A pesquisa dos seis packs foi recebida e seus nove PDFs foram localizados, com inventário de hashes e conferência dirigida. As versões SBOC são para colaboração. Foram identificados conflito entre slides 12/13 para EMA/EP, sobreposição C11 e suporte ambíguo em Ewing, idade 25 sem ramo no quadro de osteossarcoma e variantes de AUC em CUP. Faltam três esquemas da D-F1-36 no conjunto pesquisado. Avaliação local `AVALIACAO-6-PACKS-F1-B2.md`; não houve incorporação de doses nem aprovação coletiva. Página impressa 214 do Exército corresponde à página 216 do PDF.
- Busca suplementar no parecer local: a diretriz original de Lok esclarece EMA/EP na Tabela A5 e confirma FIGO 2000; estudos originais foram localizados para cisplatina+docetaxel em CUP e cisplatina+5-FU em CUP escamoso. São referências para curadoria, com variantes e limites de população preservados. A dupla cisplatina+vinorelbina continua sem fonte direta localizada. Nenhuma dessas referências alterou automaticamente a decisão ou a ficha institucional.
- Conflitos de decisões clínicas permanecem para decisão médica. Correção técnica não promove rascunho a regra aprovada.
- Merge e liberação clínica exigem o aceite do Dr. Silas e os gates do repositório. Não contornar proteção.
- Provider ao vivo foi dispensado anteriormente pelo Dr. Silas; não marcar PASS por teste injetado. Extração só local (D-F1-40), Jev mantido (D-F1-45), voz e operação multiusuária fora da F1.
- Relação de aceites anteriores: [matriz F1](MATRIZ-RASTREABILIDADE-F1.md), [caso-guia](ondas/F1-CASO-GUIA.md), [S12 histórico](ondas/F1-S12-RELATORIO.md). Números históricos não valem como execução do HEAD atual.
