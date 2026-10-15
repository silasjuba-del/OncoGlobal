# F0-COMPLEMENTO — início isolado e decisões do Dr. Silas

Data: 2026-10-10. Sessão Codex: `01a125d6-431f-7b03-b9cd-dde0c45249a4`.
Base: `bab0889aa5875c140f76833da759d0969620d3d2`, ramo `codex/f0c-inicio`, worktree `C:/Users/silas/Projects/OncoGlobal-wt/codex-f0c-inicio`.

## Autorização e limites

Pedido direto: “ISSO. FLASH DEFINIDO. siga C:\Users\silas\handoff\PROTOCOLO.md — receber\" FAÇA AS PERGUNTAS E INICIAR”. Em seguida, Dr. Silas respondeu às seis perguntas clínicas neste mesmo chat. A instrução atual de iniciar prevalece sobre o escopo histórico de auditoria da passagem recebida; não autoriza presumir respostas ou modificar dados clínicos fora da decisão explícita.

Início pela F05: aviso de APAC perdido após o dia 89, já delimitado na auditoria e no plano F1-00. Cálculos/dados clínicos abaixo estão registrados para as fatias próprias; não são todos implementados nesta fatia.

## Decisões clínicas recebidas — fonte direta, sem inferência de aprovação

| ID documental desta entrega | Pergunta | Resposta do Dr. Silas | Consequência para o plano |
|---|---|---|---|
| D-F0C-01 | SC | “Usar SC real por Mosteller” | Substitui piso/teto de SC de D-W9-60/61 nas futuras alterações pertinentes. Peso real da balança, inclusive obesos, já definido neste chat. |
| D-F0C-02 | Calvert | “Manter teto de 125 nesta onda” | Não retirar o teto renal nesta onda. Não confundir com a retirada dos limites de SC. |
| D-F0C-03 | Validade | “Hemograma 72 h; bioquímica 7 dias” | Padrão na ausência de regra específica da ficha; implementar sem confundir horas com diferença de datas civis. |
| D-F0C-04 | G2 / Flash | “Sim, alerta sem decisão automática” | G2 presente alerta o médico; não determina redução/adiamento. Na Flash só aparecem toxicidades apresentadas, sem grau. |
| D-F0C-05 | HBV | “Incluir o lembrete agora” | HBsAg, anti-HBc e anti-HBs: lembrete neste complemento, sem bloqueio do atendimento. |
| D-F0C-06 | Novos críticos | “NA:  < 125 E 145 < \| K: < 3 E > 6 \| CA TOTAL: < 8 E > 12 SOMENTE ESTES GERAM AVISO” | Interpretado e comunicado: Na <125 ou >145; K <3 ou >6; Ca total <8 ou >12. Limites estritos. Somente esses três na ampliação N5; não ativar novos avisos de Mg/glicose/bilirrubina/INR. |
| D-F0C-07 | Prazo do salão | “prazo salão 21 dias” | Contados da assinatura do documento. O dia civil da assinatura entra. No 21º dia decorrido deixa de valer. Sem prazo próprio na ficha da droga. |

D-F0C-06 não remove alertas já decididos de plaquetas, interações ou outras categorias. É o recorte da pergunta sobre os novos valores críticos laboratoriais. Antes de executar a comparação, o contrato deve exigir analito/unidade conhecida, conversão e proveniência; valores desconhecidos/conflitantes não entram como normais. Cálcio solicitado é TOTAL, não corrigido por albumina. A resposta não especifica uma nova fórmula de correção.

## Flash definida — escopo que substitui a proposta extensa

- Diagnóstico + TNM + estádio.
- Biópsia e imagem em uma linha cronológica compacta.
- Últimos labs essenciais e marcadores selecionados para o paciente.
- Protocolo e ciclo no formato 03/08; manter separado do último efetivamente administrado.
- TOX: somente sintomas apresentados, sem grau na Flash. Alergia visível; ausência não é negação.
- Conduta em três colunas: LAB | RAD | QT.
- LAB: HMG, U, Cr, TGO, TGP + Outros livre. TGO/TGP é a interpretação anunciada da repetição de TGP e da imagem, seguida de confirmação do modelo.
- RAD: TC tórax, TC abdome superior, TC abdome inferior, cintilografia + Outros livre.
- QT: decisão médica do ciclo inicialmente desmarcada, com data.
- Retorno, salvar e imprimir. Clique agrupado por seção.
- APAC fora da Flash principal. Demais funções na consulta/tela específica; não duplicar editores na Flash.

## F05 — quadro de sete blocos e ownership

| Bloco | Conteúdo |
|---|---|
| 1 Tema | Aviso de APAC devido que não pode desaparecer após dia 89. |
| 2 Previsto/real | `apacPrazo` usa `dias >=85 && dias <90`; defeito documentado na auditoria e F1-00. |
| 3 Proposta | Avisar desde dia 85 enquanto não houver aviso registrado, inclusive vencida. |
| 4 Código | `src/rules/apac.ts`, apenas aviso; testes abaixo. |
| 5 Biblioteca | Nenhuma mudança de tabela/corte clínico. |
| 6 Decisão | Correção já delimitada; início autorizado no pedido atual. |
| 7 Preservar | Vencimento, possibilidade de emissão e `consultaSegue` permanecem. |

Writer: agente Codex `/root/f0c_apac`, sob integração do Codex raiz. A instrução global AGENTS.md remete à delegação de tarefa mecânica; a autoria continua Codex. Sem escritores simultâneos na mesma faixa.

WRITE_SET da implementação:
- `src/rules/apac.ts` (apacPrazo).
- `tests/apac/apac-prazo-cob.test.ts`.
- `tests/w10-luna2/tempo-apac.test.ts`.
- `tests/f0c/apac-aviso.test.ts`.

WRITE_SET da orquestração: este documento. Testes executados pela raiz, serialmente. Nenhum commit ou push automático nesta entrega inicial; resultado é candidato local revisável. Revisão cruzada Claude e integração por PR permanecem pendentes.

## Prova prevista

D84 sem aviso; D85/89/90/91/120 com aviso quando nenhum anterior; aviso já registrado não repete; faturamento vencido permanece impedido; consulta sempre segue. Datas inválidas rejeitadas e futura não gera aviso. Rodar cobertura APAC, tempo e fuso, mais typecheck. Registrar resultado real na entrega, sem confundir teste focal com encerramento do complemento.

## Resultado da F05

- Implementação local concluída na faixa atribuída; aviso persistente desde D85, inclusive D90+.
- `node node_modules/vitest/vitest.mjs run tests/apac tests/w10-luna2/tempo-apac.test.ts tests/cobertura/fuso.test.ts tests/f0c/apac-aviso.test.ts --no-file-parallelism`: **66/66 testes, 8/8 arquivos PASS**.
- `node node_modules/typescript/bin/tsc --noEmit`: **PASS**.
- `git diff --check`: **PASS**.
- Testes executados sob lock compartilhado, sem paralelismo de arquivos. Dependências existentes reutilizadas por junction; nenhuma instalação.
- Suíte integral, redteam e adv-w8: **NOT_RUN** nesta entrega focal. Revisão cruzada Claude e integração ainda pendentes.
- Sem commit, push ou mudança no checkout `f1/integrado`. As seis decisões clínicas acima estão documentadas, não implementadas pela alteração de APAC.
