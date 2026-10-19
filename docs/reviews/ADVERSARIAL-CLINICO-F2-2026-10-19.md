# Quatro casos clínicos adversariais do canal F2

## Escopo

Pedido: transformar os quatro casos sintéticos em testes executáveis, corrigir falhas em worktree isolada e preservar integralmente o trabalho do Cursor. Nenhum limiar clínico novo ou alteração de limiar existente foi autorizado.

- Base: `c794fe8a58f2e4215802c47e9bc91d7cd5c726f0`, PR #28.
- Branch: `codex/f2-adversariais-clinicos-20261019`.
- Worktree: `C:/Users/silas/Projects/OncoGlobal-wt/codex-f2-adversariais-clinicos-20261019`.
- Um único escritor; revisores independentes somente em leitura.
- Testes: `tests/f2/adversarial/quatro-casos-clinicos.test.ts`.

## Matriz implementada

| Caso | Cobertura | Correção / invariante |
|---|---|---|
| C1 — temperatura em AC-T | Formal/gíria/erro; ponto e vírgula decimais; número isolado; extenso e frações; Celsius/Fahrenheit; valor sem unidade; concatenação; erro de separador; medidas seriadas; corticoide declarado; ciclo anterior citado; idade/peso/horário/dose; números negativos/extremos. | Valor, unidade original, estado de normalização, origem e tempo ficam separados. Não interpretar falha de extração como afebril. Comparação de C/F usa a medida original e o mesmo limiar; arredondamento somente na representação em décimos. |
| C2 — negação respiratória | Todas as frases obrigatórias; gíria/abreviação; negação antes e depois do termo; dupla negação; listas; “não passa/melhorou”; “só a tosse”; cansaço aos esforços; pergunta citada versus resposta; medição contraditória após vírgula/dois-pontos. | Negações não atravessam novas orações; pergunta não vira fato negado; náusea, vômito, cansaço e dispneia permanecem conceitos distintos. Nenhum diagnóstico de pneumonite é produzido. |
| C3 — diarreia em CAPOX | Descrição sem “diarreia”; fezes líquidas; contagem atual e basal em ambas as ordens; “banheiro” inespecífico; janela diária/semanal/múltiplos dias; operadores escritos e simbólicos; quantidade negada/corrigida; terceiros; ostomia e ostomia negada; tontura postural; regra ausente/inativa. | Aumento calculado somente com evidência compatível. Reutiliza `sugerirGrauCtcae` e `salao-ctcae.v1.json`, sem modificar regras. Grau continua candidato e não confirmado; comparação que atravessa faixas fica pendente. Tontura gera pendência de avaliação da hidratação, não diagnóstico nem ordem terapêutica. |
| C4 — cuidador/endereço | Primeira/terceira pessoa; filha com erro de digitação; casal; mensagem anterior vinculada seguida de autores não identificados; nomes de terceiros; Reply-To/corpo indicando outro destino; replay/getter e semântica legada; SQLite. | E-mail vinculado não prova autoria. IMAP permanece sem paciente atribuído; não herda certeza da mensagem anterior. Mensagens sem sujeito verificado não são comparadas como evolução da mesma pessoa. Destino não vem de instrução no corpo/Reply-To. |

## Contrato e proveniência

`PropostaClassificacaoCanal@1` recebe `leituraComplementar` opcional para compatibilidade estrutural de registros anteriores. A versão nova é `F2-LEITURA-2`, com:

- série térmica com valor/unidade original, normalização ou pendência, trecho, citação/relato, temporalidade e intervalo relativo;
- quantidade atual, basal, aumento, comparador, janela, ostomia, fonte literal e versões da graduação;
- autoria não verificada, sujeito relatado e contextos declarados;
- pendências explícitas para dados insuficientes ou ambíguos.

O campo de grau tem `confirmadoPeloMedico:false`. Diagnóstico, prescrição e assinatura permanecem falsos. Nenhum teste promove relato para `clinical_event`.

Reconciliações persistidas sem a nova versão não são devolvidas como atualizadas: replay retorna `RECONCILIACAO_REQUER_REPROCESSAMENTO`, getter retorna `null` e comparações indiretas excluem a semântica antiga. Os registros originais permanecem intactos. **A migração/reprocessamento versionado do acervo antigo não é executada por este patch.**

A leitura complementar permanece local. O callback LLM continua recebendo apenas o conjunto fechado de termo, polaridade, temporalidade e temperatura em décimos; não recebe os trechos complementares nem nomes de terceiros. Os testes usam somente callback sintético, sem provedor externo.

## Limiares e limitações

- `corpus/` e `src/rules/` ficam fora do WRITE_SET. O manifesto registra hashes dos 257 arquivos do corpus para comparação posterior.
- A graduação quantitativa usa a função CTCAE e o corpus já existentes. Não foram introduzidos cortes novos, promovidas regras RASCUNHO, alteradas doses ou criadas prescrições.
- Fixtures em memória podem simular uma regra conferida para testar comparação; isso não altera a curadoria persistida. Aprovação clínica permanece do médico.
- Os limites de representação térmica legados permanecem os do contrato. Valor fora dessa representação é preservado como pendência; não vira ausência de sintoma. A convenção anterior de interpretar “graus” como Celsius permanece explícita; número isolado ou apenas “°” exige confirmação de unidade.
- A gramática é determinística e limitada. Quantidade negada, intervalo que cruza graus, sujeito não resolvido, correção ou janela ambígua permanece pendente. Não se afirma compreensão irrestrita de português livre.
- Cabeçalho explícito de mensagem encaminhada abre bloco citado até marcador de retomada. Linhas iniciadas por `>` são citações individuais. Originais não são substituídos.
- A inferência de autoria por vínculo foi bloqueada no caminho EMAIL destes casos. Não se declara autenticação de pessoa por texto, por endereço ou por cadastro.
- Pré-consulta conserva os originais e a fila de revisão; não recebeu uma nova interface clínica neste patch. Integração HTTP/UI completa, transporte externo e curadoria de redflags continuam nos bloqueios já registrados no relatório F2–F6 anterior.

## Evidência de teste

- Primeira execução: 49 testes, 45 falhas e 4 aprovações. Incluía contratos complementares ainda ausentes e um ID de regra de fixture corrigido para o ID existente no corpus; esse ajuste não alterou a regra.
- A bateria cresceu com os contraexemplos dos revisores: janelas do basal contaminando a contagem, quantidade negada, pessoa diferente, decimal/extremo, citação multilinha, conversão e precisão perto do limiar.
- Resultado local final: 190/190 testes de F2 e regressões CTCAE, incluindo 92 novos adversariais; typecheck; fronteiras com zero exceções; build de UI; scanner PHI 14/14.
- Três revisores independentes encerraram seus achados após correção e reataque, incluindo a comparação de precisão C/F na fronteira do limiar existente. Pareceres técnicos delimitados, sem aprovação clínica.
- Os checks da árvore de merge são registrados no PR corretivo. Não considerar somente o número de testes como aprovação clínica.

## Preservação e continuidade

Foram inventariados main, a worktree ativa do Cursor, duas worktrees antigas com WIP e a base do PR #28. Nove arquivos WIP tiveram cópia local e hash registrados antes da edição. Nenhum reset, stash, clean, force push, exclusão de branch ou escrita nas worktrees protegidas integra este trabalho.

O aporte depende do PR #28 e deve ser revisado na branch de trabalho. Não fecha automaticamente o PR #27 nem as lacunas F3–F6.
