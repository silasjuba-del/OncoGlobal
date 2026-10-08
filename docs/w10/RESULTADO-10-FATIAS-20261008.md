# Resultado das dez fatias — 2026-10-08

Entrega local na branch `codex/w10-entrega-integrada`, base `367825e`. Três agentes gpt-6-luna trabalharam em checkouts separados; Fugu executou pela CLI nativa com provider Sakana confirmado, `responses` e geração de imagem desabilitada. Nenhuma troca do provider global.

## Código entregue

Fugu implementou F01–F03: literal e incerteza de fármacos com caracteres suspeitos, propostas de deduplicação preservando originais e reconciliação contextual entre plano e prescrição. Luna 1 implementou F04/F07/F08 e os consumidores HTTP/UI de reconciliação: vínculo explícito por segmento, confronto de identidade, triagem como rascunho, liberação médica justificada e vínculo de contato por decisão persistida. Luna 2 implementou F05/F06/F09: concordância de origem/unidade laboratorial, gate READ separado de WRITE e backup cifrado dos três stores. Luna 3 e root implementaram F10: contratos compartilhados, projeção de vínculos, jornadas HTTP/SQLite e primeiro uso da UI com reinício do banco.

As fontes originais não são excluídas por deduplicação. Um vínculo de identidade não confirma fatos. O body legado de três campos só é admitido para uma exceção UNLINKED válida e única; fontes corrompidas e segmentos ambíguos são recusados. Confirmar fatos continua exigindo consulta, seleção e comprovante de exibição válidos.

Reconciliação não grava decisão clínica. O servidor lê decisões persistidas e recusa contexto/autor enviados pelo cliente. Data de laboratório não fornece data para um plano sem data própria. A revisão filtra fatos por segmento autorizado.

## Verificação e limites

TypeScript, fronteiras, corpus e os três builds passaram. Bateria final de fechamento, servidor, UI local, confirmação e identidade: **144 PASS em 31 arquivos**, executada no código `fdf0d53`. Backup/restore e manifestos adulterados: 22 PASS. Regressões de UI, Jev e temporal: 142 PASS. Adversariais W8: 41 PASS. As contagens por bateria se sobrepõem e não devem ser somadas.

Na integração, foram corrigidos dois defeitos reais adicionais: o colapso de triagem por data de gravação ocultava duplicatas e selecionava entradas antigas; a projeção de contato ignorava divergência entre o envelope da mensagem e seu paciente declarado. A triagem agora preserva entradas para filtro por data clínica e revisão de duplicidade. Mensagens conflitantes permanecem visíveis como CONFLITO, sem associação automática de paciente. O leitor de Salão indisponível responde 503, com erro e tentativa novamente na UI.

O reataque W10 com provas atualizadas das APIs reais registrou 223 PASS / 2 FAIL. RT01/03/15 tinham probes de exports antigos e, em RT01, uma asserção de função sobre um wrapper objeto. Foram substituídos por testes diretos de contratos, extrator e reconciliação, com controles negativos; o total mudou de 226 para 225 testes. Não é comparação de contagem idêntica com o reataque anterior. Os caminhos HTTP de vínculo e reconciliação têm provas próprias.

As duas falhas RT07 continuam abertas: `hbDgDl` legado já declara décimos de g/dL, mas não contém proveniência obrigatória nem faixa superior aprovada. A concordância técnica de unidade foi implementada; a plausibilidade clínica permanece `BLOCKED_MEDICAL_RULE`. Não foi inventada faixa para silenciar os testes.

READ foi validado com adaptadores offline; transporte externo não foi conectado. G02 usa identificadores conhecidos e não comprova anonimização universal. PUBMED é restrito a STUDY; WORK admite apenas WORKSPACE. Nenhum dado real de paciente foi enviado.

Os três snapshots SQLite incluem WAL e são individualmente consistentes, com hashes, versão de schema e janela de captura no manifesto. Não existe transação distribuída que assegure um único instante lógico entre os três bancos.

Worktrees, branches e stashes preexistentes foram preservados. Não houve push, merge no checkout canônico, deploy ou leitura de bancos clínicos reais. Esta entrega não constitui aprovação clínica nem liberação de produção; o reataque red mantém risco de merge.
