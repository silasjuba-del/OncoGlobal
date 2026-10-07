# W10 — revisao durante implementacao

Achados observados em WIP; nao representam o estado final. Cada fechamento exige diff e reataque.

| ID | Dono | Evidencia e efeito | Correcao / estado |
|---|---|---|---|
| R01 | L2 | Gateway base repassa `r.erro` e `objeto.tipo` a resposta/auditoria: texto controlado pode conter PHI. | Codigos fixos e verbo fechado; teste pendente. |
| R02 | L2 | WIP valida recibo de impressao com regex de token e rejeita caminho local usado pelo executor existente. | Preservar contrato local; restringir transformacao de recibo a saida externa. Aberto. |
| R03 | L2 | Regex alfanumerica para recibo externo aceita telefone/CNS/CPF/nome sem espacos. | Gerar referencia opaca internamente; nunca retornar recibo bruto externo. Aberto. |
| R04 | L2 | Evidencia validada mantem referencia ao objeto mutavel devolvido pelo callback. | Snapshot profundo antes de validacao/execucao e teste de mutacao. Aberto. |
| R05 | L2 | Engolir toda falha de auditoria pode executar efeito sem trilha. | Negar antes do efeito se auditoria requerida falhar; preservar resultado incerto/idempotencia apos efeito. Aberto. |
| R06 | L4 | Primeira API deixa categoria RECIST sempre null, mesmo com dados completos. | Implementar criterios completos verificaveis; manter null somente nos casos nao avaliaveis. Aberto. |
| R07 | L5 | Primeira alteracao por caixa usa null como valor anterior mesmo quando perfil ja mostra DIA/false; readBox e readProfile divergem. | Fonte unica do valor atual e teste de primeira alteracao. Aberto. |
| R08 | L5 | changeBox permite PERSONALIZAR sem layout e texto vazio; leitura normaliza valores diferentemente do evento gravado. | Validar/normalizar perfil resultante antes de persistir, mantendo valor anterior/novo e leitura coerentes. Aberto. |

Baseline inicial: typecheck, boundaries (174 arquivos) e corpus (91) passaram. Vitest com pool padrao excedeu timeout de teste HTTP e deixou de avancar; processo proprio interrompido, resultado INCOMPLETO, nao PASS. Reexecucao com forks, um worker e limites de I/O de 30 s, sem mudar expectativas dos testes. Logs em `_w10-astra/logs` (fora dos repositorios).
