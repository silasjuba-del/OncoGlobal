# F1 — fechamento documental e diretrizes para a próxima fatia

Mandato de 17/10/2026: aplicar as correções finais, encerrar a sequência de auditorias e entregar F1 fechada. Autor da integração: Codex, escritor único. Autorização técnica não promove conteúdo clínico nem modifica as decisões médicas anteriores.

## Definição do escopo

1. Finalizar a camada documental universal dos packs e preservar integralmente o legado, as fontes e as variantes.
2. Retificar as recomendações B1–B8 abaixo. Elas orientam futuras mudanças; não autorizam uma refatoração geral nem viram dependências artificiais do fechamento atual.
3. Resolver os checks e a integração pendentes de F1. A base deste trabalho `codex/fase2-lacunas-t1 @ 2c0991d` representa uma frente; o main local `ffa1134` não comprova integração remota.
4. Preservar Maestro/ORK, ledger, contratos e comportamento existente. Correção de defeito demonstrado em gate deve ter escopo e prova próprios.
5. Não duplicar o ingresso de canal existente em `grok/f2-canal-inicio @ f69ca50`. Esse commit contém autenticação de webhook e persistência; não comprova produção ou integração. A etapa seguinte é **a próxima fatia identificada de F2, após conferir o trabalho existente**.
6. Manter o conteúdo NCCN em `A_CONFERIR`, com aprovação clínica nula. Fonte estrangeira não presume acesso SUS/privado.
7. Fechamento requer evidências dos gates e estado real das integrações, sem substituir resultado por intenção ou nome de commit.

## Decisão sobre B1–B8

| Item | Diretriz corrigida | Critério da futura fatia |
|---|---|---|
| B1 — projeção da triagem | Fatia pequena e independente. Não é pré-requisito obrigatório de F2. Entrada explícita inclui peso, data, fontes, IDs de eventos e altura documentada. Saída conserva sugestão e pendências. | Provar horizonte do encontro, isolamento paciente/lote, conflitos, deduplicação, proveniência visível e equivalência de comportamento. Redução do tamanho de `leituras.ts` não significa, por si, rewrite. |
| B2 — schemas compartilhados | Adotar nas novas operações e reduzir duplicação compatível. O exemplo de `vincularFonteRevisao` não comprova quebra: `LIGAR_PACIENTE` devolve `VINCULO_REVISTO`, inclusive em replay; `GRAVADA/REPLAY` pertencem a outro caminho. | Preservar a associação operação↔resposta, sem fazer o cliente aceitar indiscriminadamente a união de uma rota. |
| B3 — PHI | Compartilhar vocabulário apenas onde houver equivalência comprovada. `chaveDeIdentidade`, `scanText` e `phiEstrutural` têm responsabilidades diferentes. O exportador já usa detectores existentes. | Preservar validações, exceções e política pré-egresso. Detectar PHI não resolve identidade do paciente; canal reutiliza vínculo apropriado, sem identificador paralelo. |
| B4 — rotas declarativas | Experimentar na primeira rota adequada, com recorte limitado. Parse inicial não substitui guards antes e depois de operações assíncronas. | Preservar autenticação, validação de entrada, contexto e revisão após await, saída validada e cobertura de descoberta das rotas. O teste atual lê o ternário de `rotas.ts`; adaptar sua descoberta somente junto da alteração correspondente. |
| B5 — semáforo | Opcional, sem alteração de predicados ou aplicabilidade. | Respeitar decisões de UI/Flash e distinguir ausência, conflito e não aplicabilidade. |
| B6 — leitura de corpus | Não impor um loader universal. O loader atual de rulesets não possui automaticamente as responsabilidades de leitor de packs, originais e extrações. D-F1-15 não estabelece layout imutável por si só. | Todo consumidor novo justifica sua estratégia e reutiliza componentes compatíveis. Infraestrutura comum só quando a necessidade compartilhada estiver demonstrada; validações específicas permanecem. |
| B7 — contrato de setor | Formalizar o contrato comum quando uma mudança pertinente ocorrer; as funções já têm assinaturas explícitas. | Não apresentar formalização de tipo como implementação de uma capacidade inexistente. |
| B8 — N+1 | Adiar até evidência mensurável. | Registrar volume, número de consultas e latência observada antes/depois; não iniciar otimização por hipótese. |

## Fronteira das mudanças

- Declarar caminhos de escrita e revisar qualquer saída do conjunto: não existe franquia de até três arquivos extras.
- Contratos novos ou registros aditivos de rotas são distintos de alterar a semântica de contratos existentes; ambos precisam ser explícitos na fatia.
- Tamanho do diff e redução de arquivo não substituem avaliação de escopo, comportamento e risco.
- Exigir verde **em cada checkpoint concluído**, não em todo estado intermediário de edição.
- Nenhuma dessas diretrizes autoriza remover testes, relaxar scanner, reclassificar falhas ou criar aprovação clínica.

## Correções finais dos packs

Aplicadas referências cruzadas por sítio para pembrolizumabe de cabeça/pescoço e PDNEC para a distinção de TNE G3; notação HER2 biliar preservada sem regra booleana de elegibilidade inferida; textos de zanidatamabe/BRAF explicitados; espaçamento de prosa corrigido sem tocar citações/IDs/variantes; auditoria repetida substituída por referência com hash, mantendo o conteúdo original; manifesto inicial preservado em histórico e manifesto atual recalculado.

Os textos históricos não foram restaurados de `2c0991d`, pois a extensão não existia ali. Sua preservação foi conferida contra os snapshots de trabalho; o commit serve de base para verificar o legado. A hipótese de regex defeituosa não foi adotada: o problema de espaçamento estava na redação gerada.

## Estado inicial verificado no remoto

Em 17/10/2026: PRs17/18 integrados; PR19 aberto em `8fcef9b`, PR20 aberto em `9d9881a`. Checks de PHI apontavam hashes de revisão desatualizados. Os trechos correspondentes devem ser revistos antes de atualizar suas disposições; detector e política permanecem intactos. GitHub exige os dois checks e base atualizada; nenhuma proteção será contornada.

## Resultado final

As correções deste escopo estão implementadas. O fechamento remoto é formado pelos [PR19](https://github.com/silasjuba-del/OncoGlobal/pull/19), [PR20](https://github.com/silasjuba-del/OncoGlobal/pull/20) e [PR21](https://github.com/silasjuba-del/OncoGlobal/pull/21); seus registros de merge e checks obrigatórios são a evidência de integração, sem confundir o main local com o remoto. PR19 foi integrado em `117aaed` em 17/10/2026. PR20/21 seguem a mesma proteção, sem bypass ou aprovação clínica automática.

Correções concretas de fechamento:

- Limites dos cursos documentados e variantes das fichas B2; unidade micrograma preservada e unidade incompatível recusada; componentes isolados de Ewing não produzem um curso alternado executável. Nenhum protocolo foi retirado.
- Curadoria da biblioteca vinculada à revisão exibida, com rejeição de aba desatualizada; data de acesso não substitui publicação. FGTS exporta somente a base legal com fonte própria e mantém sua condição de neoplasia maligna; a referência é pesquisável sem conceder elegibilidade automaticamente.
- Exportação com proteção de caminhos, envelope compatível com o limite HTTP e contagem em bytes. Gerador histórico de packs congelado antes de qualquer escrita para preservar enriquecimentos posteriores. Dossiê médico mantém as fontes por ocorrência de fármaco/classe/dia.
- UTF-8 inválido retorna erro de entrada; PDFs acima do limite conservam as páginas pendentes. Seleção do pack aceita faixas de CID e conserva a recusa em caso de ambiguidade.
- Contagem local de cliques passou a ocorrer após o evento do controle, preservando a seleção dos checkboxes de revisão. O harness aguarda a fonte efetivamente carregada.

Evidências executadas em 17/10/2026:

| Verificação | Resultado |
|---|---|
| 29 packs originais × base `2c0991d` | Zero diferenças nas chaves legadas; protocolos, fontes e conflitos preservados. |
| Manifesto documental | 29 hashes conferem com os arquivos locais e com os blobs Git; manifesto anterior preservado no histórico. |
| Gates de integração | `verify` e bateria adversarial W10/W8/F1 executados pelo GitHub; o PR21 em `456b0b1` passou ambos. Atualizações posteriores exigem os mesmos checks antes do merge. |
| Fronteiras e corpus nesse gate | 441 arquivos de código sem exceções de fronteira; 241 arquivos do corpus validados. |
| Build da interface | `vite build` aprovado localmente. |
| Navegador — cólon sintético | 3 fontes lidas e revisadas; 3 documentos assinados; zero chamadas externas da página. |
| Navegador — retorno sintético | 5 documentos assinados; cinco cliques de ação registrados, além da digitação; zero chamadas externas da página. |
| Reinício do servidor e mesmo SQLite | Os dois encontros reabriram com os 8 documentos; ambas as reimpressões retornaram `EXECUTADA`. A prova é HTML local, não papel físico. |

Evidências locais do navegador: `%TEMP%/oncoglobal-fechamento-final/browser-colon.log`, `browser-retorno.log`, `browser-reabertura.log`, screenshots e vídeos em `.s12-evidence/`. Só há dados sintéticos. A tentativa de bateria integral Windows teve timeout local no scanner sob carga e foi interrompida; não é contabilizada como PASS. Os gates integrais de aceite são os checks protegidos do GitHub, com regressões dirigidas locais adicionais; nenhum teste foi removido ou teve o limite aumentado.

Este fechamento é técnico/documental de F1. Conteúdo NCCN sem conferência médica continua `A_CONFERIR`, sem ativação automática, sem presumir acesso SUS/privado e sem assinatura atribuída ao médico. O motor terapêutico de F2 e as melhorias B1–B8 permanecem nas próximas fatias identificadas, conforme as fronteiras acima.
