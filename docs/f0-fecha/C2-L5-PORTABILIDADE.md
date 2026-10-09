# C2-L5 — portabilidade do scanner PHI

## Escopo

O scanner cobre a superfície publicável do repositório: caminhos devolvidos por `git ls-files -z --cached --others --exclude-standard`. Isso inclui arquivos rastreados mesmo dentro de diretórios ignorados e arquivos não rastreados que não sejam excluídos pelas regras Git. Arquivos ignorados e não rastreados de build/runtime ficam fora dessa superfície. A implementação lê os bytes atuais no worktree, inclusive alterações staged ou unstaged; não usa blobs do índice como substituto.

O scanner não declara cobertura do disco inteiro. Falha na enumeração Git gera `PENDENTE` e `UNVERIFIED`, nunca um resultado vazio interpretado como aprovação. Caminhos symlink são registrados como `UNVERIFIED` sem seguir o destino. Portanto a análise do alvo do link, inclusive se estiver fora do repositório, permanece fora da prova.

## Hash de texto

Registros do manifesto mantêm `hashMode: "raw"` por padrão. O modo opcional `utf8-lf` decodifica UTF-8 estrito e normaliza somente pares CRLF para LF antes do SHA-256. Bytes inválidos, conteúdo com NUL e extensões de binário/documento (PDF, XLSX, imagens e fontes) não aceitam esse modo. CR isolado não é alterado.

O modo não aprova conteúdo alterado: qualquer diferença além da normalização CRLF/LF muda o hash e invalida a disposição por manifesto. Não atualizamos hashes revisados nesta entrega. Uma entrada só deve receber `utf8-lf` após comparação independente confirmar que o digest normalizado coincide com o SHA já revisado.

## Provas planejadas

Os testes adicionados cobrem: equivalência CRLF/LF apenas em `utf8-lf`; sensibilidade byte a byte no modo raw; rejeição de formato binário; invalidação quando conteúdo/identificador é acrescentado; exclusão de um arquivo ignorado e não rastreado; inclusão de arquivo forçado como tracked sob a mesma regra de ignore; inclusão de arquivo público untracked; e falha de inventário sem aprovação vazia.

## Resultado da prova

Com `TEST_SLOT` concedido, `npm run typecheck` passou. `npx vitest run tests/f0-fecha/phi-repo.test.ts --pool=forks --no-file-parallelism --maxWorkers=1` executou sete testes: seis passaram, incluindo os novos testes de portabilidade; o teste integral do repositório falhou na comparação de findings/pending já pendentes e na imagem protegida `docs/referencias/ui-modelo-consulta.webp`. Essa falha global não foi convertida em PASS nem corrigida nesta faixa.

O diff estático passou em `git diff --check`. A bateria não executou UI, build ou suíte ampla. Esta correção não altera manifesto nem remove pendências.
