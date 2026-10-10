# C2 — integração da consulta real

Preparação em `f0/f0f-astra-c2`, ainda não equivale a entrega no ramo integrado. Fontes: E6b, D-W9-77/78 e missão F0-FECHAMENTO-ASTRA. Sem LLM externa, novas dependências ou acesso a banco clínico real.

## Correções

- Reconciliação HTTP reúne os candidatos somente depois das verificações existentes de vínculo persistido, paciente, encontro e data clínica. Campos conflitantes não elegem candidato; todas as fontes e fatos permanecem na resposta.
- A evolução Flash incorpora o resumo cuja revisão foi registrada, com as divergências documentais. O rótulo literal “Diagnóstico anatomopatológico” passa pelo extrator determinístico; ausência declarada não gera histologia.
- `ConsultaPersistida` usa a porta HTTP real. Mostra os textos completos antes de oferecer assinatura; o clique confirma as mesmas versões, sem buscar silenciosamente outro bundle. Repetição da preparação após perda de resposta reutiliza a chave da operação. Histórico assinado vem do ledger; hash, versão e ator divergentes geram pendência e não são apresentados como assinatura íntegra.
- O cartão recebe fatos de AP confirmados e escopados ao paciente/encontro/lote selecionados. Sem lote confirmado retorna pendência. Extensão tumoral não declarada fica `null`; não há inferência de sítio, grau, estágio ou biomarcadores. As seis extensões estruturadas anteriores continuam disponíveis. Projeção documental entregue por L4; consumidor e prova de isolamento pela Astra.
- A porta local monta APAC e configuração Flash autenticadas. O bootstrap passa o diretório selecionado ao store configuracional e o proxy encaminha `/config` e `/acao`. Os campos de configuração ainda demonstrativos não são montados nessa superfície.
- A tela APAC conserva os achados e fontes da antiglosa. A referência `eventId` adicional da projeção é validada e retirada no adaptador; o contrato clínico APAC continua estrito. Não há emissão automática. SIGTAP ausente permanece explícita.
- O loader do corpus usa `NodeURL`, evitando que o transformador de assets de Vite transforme URLs de arquivos do servidor em `src/server/undefined` durante a prova conjunta HTTP/jsdom.
- Eventos antigos de triagem recebem `null` para os dois novos campos ausentes durante a leitura, sem alterar o payload original. A mesma correção já entrou no integrado junto de L3.

## Evidências desta preparação

| Execução | Resultado e interpretação |
|---|---|
| C2-foco-01 / C2-ui-02 | Falhas preservadas: conferência de contexto exigia patientId embutido redundante; a prova guardava referência DOM substituída após reload. Correções sem dispensar conferência de paciente pelo bundle/ledger. |
| C2-ui-03 | 2/2 provas de UI HTTP passaram naquele estado. |
| C2-foco-04 | 41 PASS / 1 FAIL: documento assinado não continha AP porque rótulo documental não era reconhecido. |
| C2-e6b-05 | 8/8 PASS após correção do rótulo; E6b completo e compatibilidade. |
| C2-tsc-06 e C2-tsc-09 | PASS, sem diagnósticos, antes da alteração final do loader. |
| C2-foco-07 | 22 PASS / 1 FAIL: APAC HTTP rejeitada pelo eventId adicional. Inclui as provas reais de assinatura, retry, isolamento do cartão, integridade documental, E6b e E1. |
| C2-apac-08 / C2-ui-10 / C2-apac-11 | Diagnósticos preservados: chave eventId adicional; antiglosa ausente; loader transformado em caminho `src/server/undefined`. |
| C2-ui-12 | 4 arquivos / 7 testes PASS: APAC real, consulta real com retry, isolamento/integridade e leitura HTTP anterior. |

As execuções estão em logs `C2-*.log`. Falhas iniciais não foram apagadas. Falta portão integral e três execuções finais consecutivas de E6b no candidato integrado estável; nenhuma contagem focal substitui esse portão.

## Limites explícitos

Reataque `C2-retomada-15.log`: **7 arquivos / 50 testes PASS** com processos separados e um worker, incluindo retomada após reiniciar SQLite/sessão, recusa de chave reutilizada com plano diferente, rollback integral após falha intermediária, E6b, UI real, E1 e regressões do ledger/Flash. A primeira tentativa `C2-retomada-14.log` expôs transação BEGIN dentro do SAVEPOINT; `transacao` agora usa savepoint aninhado quando já existe transação, preservando BEGIN IMMEDIATE no nível externo. Nenhuma asserção foi reduzida. Fronteiras `C2-fronteiras-13.log`: 298 PASS; TypeScript `C2-tsc-13.log`: PASS antes da alteração pequena do helper transacional. A bateria final integrada ainda é obrigatória.

Revisão independente estática L2 em `2e0544c` apontou P2: a chave guardada apenas em useRef não sobrevivia à perda de resposta da assinatura seguida de remount. Correção em preparação: identidade dos documentos pelo conteúdo/contexto exatos; chave de cada pedido vinculada ao hash em sqliteIdempotencia; preparação atômica com SAVEPOINT. Mesma chave com conteúdo alterado continua recusada; mesmo conteúdo já assinado é reconhecido após reiniciar sessão/SQLite. Nova prova `c2-flash-retomada.test.ts` cobre retomada, novo plano e falha intermediária. NOT_RUN após esta alteração; auditoria final D1 ainda obrigatória. L2 não encontrou bypass de conteúdo exibido ou mistura no caminho de escrita na leitura efetuada.

Revisão estática posterior encontrou import do harness na impressão na entrega E1 de L4, contrário à fronteira arquitetural. A regra G-06 foi movida para módulo puro de documentos, consumido pela impressão e reexportado pelo harness; API e exigências do gate preservadas. Reataque de fronteiras e teste E1 pendentes após essa mudança.

O confronto conserva divergências e o resumo registra as fontes; não implementa um novo comando de adjudicação que apague ou eleja conflitos. E6b prova que confirmar fontes individualmente não resolve divergência. Os campos do cartão sem fonte ficam visíveis como não informados; o projetor novo copia apenas histologia e TNM literal prefixado de AP. A tela real prepara e assina; não promete impressão no botão. A demo de navegador e a auditoria cruzada finais seguem pendentes.
