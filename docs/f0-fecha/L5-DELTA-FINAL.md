# L5 — delta final da auditoria do scanner

## Correções

- **M1 — entradas que não são arquivos:** entradas do inventário Git que apontam para diretórios/gitlinks, outros tipos especiais ou arquivos rastreados ausentes agora geram `UNVERIFIED` e `PENDENTE`. Elas não são ignoradas silenciosamente.
- **M2 — índice publicado versus worktree:** o scanner consulta o índice por `git ls-files --stage -z` e lê seus blobs em lote com `git cat-file --batch`, sem shell. Compara cada blob rastreado aos bytes atuais antes de usar disposições do manifesto. Só tolera equivalência CRLF/LF em texto UTF-8 estrito; PDFs, XLSX, imagens, fontes e outros binários mantêm comparação byte a byte. Divergências, conflitos de índice ou blobs ausentes geram pendência. Arquivos SQLite/DB e sidecars são inventariados sem leitura de conteúdo e permanecem `UNVERIFIED/PENDENTE`.
- **M3 — cobertura PDF:** o scanner preserva extração textual e observa operadores de imagem do PDF.js. Páginas sem texto ou com conteúdo de imagem exigem `coverageReviews` no registro do arquivo, com SHA igual ao atual, evidência/motivo e números de todas as páginas afetadas. Uma revisão stale ou incompleta mantém o bloqueio. PDF ilegível ou sem páginas também fica `UNVERIFIED/PENDENTE`.
- **B4 — cobertura XLSX:** a extração de `sharedStrings` e `sheetN` permanece ativa. Como comentários, cabeçalhos/rodapés, `docProps` e imagens embutidas não são extraídos, todo XLSX exige revisão dessas quatro partes no próprio registro, vinculada ao SHA, evidência e motivo. Sem cobertura completa, fica `UNVERIFIED/PENDENTE`.

As revisões são por arquivo/SHA e por páginas/partes; não há allowlist de diretório nem promoção automática de arquivos existentes. Nenhuma dependência foi adicionada e o manifesto de PHI não foi alterado.

## Provas

- `npm run typecheck`: PASS.
- `npx vitest run tests/f0-fecha/phi-repo.test.ts --pool=forks --no-file-parallelism --maxWorkers=1`: 12 testes passaram e 1 falhou. Passaram as provas novas de gitlink/diretório e arquivo ausente; índice divergente versus worktree e equivalência apenas CRLF/LF; PDF sem texto; PDF com texto mais imagem embutida; e revisões ausentes/stale de PDF/XLSX rejeitadas até apresentação de revisão hash-bound válida.
- A única falha é a asserção global do repositório. Ela continua apresentando candidatos pendentes, arquivos PDF/XLSX que ainda não têm revisão adicional, o WEBP protegido e divergências do índice enquanto esta entrega ainda está em WIP. Não afrouxei a asserção nem atualizei manifesto para passar.
- `git diff --check`: PASS. Não rodei UI, build nem suíte ampla.

## Limites

O scanner compara a superfície publicável Git corrente e o worktree, não o histórico inteiro nem o disco fora do inventário. A leitura dos blobs em lote falha fechada se indisponível ou acima do limite de buffer. Revisões manuais reais de páginas PDF e partes XLSX continuam necessárias antes de remover seus estados pendentes. Stores operacionais reconhecidos por extensão são relatados por caminho/tipo sem ler o conteúdo.
