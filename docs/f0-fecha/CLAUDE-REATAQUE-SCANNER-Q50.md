# Reataque independente final do scanner e Q50

Claude via endpoint Anthropic, modelo claude-opus-5-5, somente leitura; 12 turnos. JSON bruto preservado em .git/f0-fecha-audit/reataque-final.json, SHA-256 c5dbb85fabdfb395a7f56fdb514ece22e63d4243564ccbbc9f4b662983b321b0.

Conferência Astra complementar: git diff --name-only 1b56427 5aa88a6 -- src corpus retornou vazio. PDF.js identificou também páginas 30 e 31 do manual de quimioterapia; ambas foram renderizadas/abertas (fundos sem identificação) e incluídas no manifesto antes do PASS focal 16/16. O revisor não executou os testes nem substitui essa inspeção.

# Reataque READ_ONLY: M1/M2/M3/B4 e Q50

Só li arquivos. Não rodei comandos, git ou testes, e não abri capturas nem PDFs. Li: `scripts/phi-repo.mjs`, `tests/f0-fecha/phi-repo.test.ts`, `docs/f0-fecha/REVISAO-BINARIOS.md`, os trechos de `PHI-TRIAGEM.json` com `coverageReviews`, `Q50-ACEITE.json`, `scripts/matriz-f0.mjs` (Q50) e a regra Q50 em `PLANO-FINAL-ONCOGLOBAL-v1.1.md:540`.

## Status dos achados

**M1, diretório/gitlink: FECHADO**
- `scripts/phi-repo.mjs:544-548`: entrada que não é arquivo regular agora vira `unscanned` e `pending` (`gitlink_or_directory` ou `non_regular_file`) e entra em `seen`.
- Gitlink com diretório ausente cai em `inventory_file_unavailable` (`:521-524`).
- Gitlink trocado por arquivo regular também falha fechado: o blob 160000 é excluído (`:411`) e o caso vira `index_blob_unavailable` (`:576-577`).
- O teste existe em `phi-repo.test.ts:271-296`.

**M2, índice versus worktree: FECHADO**
- O scanner lê `ls-files --stage` e busca os blobs com `cat-file --batch` (`:392-435`). Objeto ausente ou que não é blob faz o inventário inteiro falhar fechado (`:427`, `:500-503`).
- Um único estágio é comparado ao worktree (`:568-574`). A única tolerância é CRLF/LF em texto UTF-8 válido sem NUL (`:378-390`). Ela não muda os candidatos, porque a extração já separa linhas por `\r?\n`.
- Conflito de estágios vira pendência (`:565-567`).
- Esses mecanismos cobrem `git add` seguido de limpeza só no worktree, `skip-worktree`/`assume-unchanged` e filtro clean.
- A divergência só gera `pending`, sem `unscanned`. Isso basta, porque o teste do repositório exige `pending: []` (`phi-repo.test.ts:444-448`).
- O teste existe em `:298-315`.

**M3, PDF misto: FECHADO**
- Cada página registra `hasImages` pela lista de operadores (`:471-478`).
- Página sem texto ou com imagem exige revisão vinculada ao SHA do arquivo e da revisão, cobrindo todas essas páginas (`:368-376`, `:634-640`).
- Testes: página em branco, revisão desatualizada e página com texto e imagem (`:356-399`).

**B4, XLSX: FECHADO**
- Fora do que é extraído, o scanner exige revisão `xlsx_unread_parts_review` vinculada ao SHA, com as quatro partes declaradas (`:18`, `:609-618`). Sem ela, o arquivo vira `unscanned` e `pending`.
- O manifesto tem a revisão em `PHI-TRIAGEM.json:2730-2743`, com o mesmo SHA do arquivo. A justificativa está em `REVISAO-BINARIOS.md:14`.
- Teste em `:401-433`.

## Novos achados

Não encontrei nada ALTO nem MÉDIO.

**BAIXO**
1. **XLSX com lista fixa de partes** (`scripts/phi-repo.mjs:18`, `:279`). O scanner só lê planilhas com nome `sheetN.xml`, e a revisão só pede as quatro categorias. Ficam de fora, sem extração e sem exigência de revisão:
   - gráficos e caixas de texto em `drawings`;
   - `pivotCacheRecords`, que pode conter cópia dos dados;
   - `definedNames` e nomes de abas em `workbook.xml`;
   - `threadedComments` e `customXml`;
   - planilhas com nome fora do padrão `sheetN.xml`.

   Para o arquivo atual, gerado pelo openpyxl, o risco é baixo, e a Astra relata ter inspecionado o ZIP. Mas a regra não garante isso para arquivos XLSX novos.
2. **PDF ainda tem partes não cobertas** (`:466-478`). O scanner não olha:
   - valores de campos de formulário e conteúdo de anotações, que `getTextContent` não extrai e que não contam como imagem;
   - metadados Info/XMP;
   - arquivos embutidos;
   - texto convertido em curvas.

   As páginas renderizadas na revisão visual ficam cobertas na prática. Já um PDF só com texto, como `kit-oncologia-2026-05.pdf`, não tem essa cobertura.
3. **O recibo Q50 não se vincula ao HEAD atual** (`scripts/matriz-f0.mjs:1103-1125`).
   - `reviewedCodeHead` só tem o formato conferido. Nada compara o diff de `1b56427` até o HEAD com uma lista de arquivos permitidos, então uma mudança clínica futura mantém Q50 VERDE.
   - Hoje isso não é bypass, porque o delta declarado é de higiene, scanner e demo. Mas não confirmei isso sem git, e o merge de reconciliação com main (`7936820`) também entra nesse delta.
   - Menor: a contagem de 9 PNGs (`:1114`) aceita o mesmo caminho repetido.
4. **Texto obsoleto em `matriz-f0.mjs:419`.** A entrada Q50 de `mappingPending` ainda diz "não entregues". Ela nunca é usada, porque o ramo de Q50 (`:1160`) retorna antes, mas confunde quem lê.
5. **Lacunas de teste:**
   - repositório aninhado não rastreado (saída de `--others` com barra no final);
   - filtro clean e `skip-worktree`;
   - PDF misto aprovado com revisão, ou com revisão que omite uma das páginas visuais.

## Q50

Não encontrei bypass da regra (`PLANO-FINAL:540`: testes reais, PR revisado e demo).
- **Aceite documental separado do runtime:** dono e consumidor ficam como "não se aplica" e são validados (`matriz-f0.mjs:1163-1166`, `:1285-1289`).
- **Exigências do recibo:** PR do repositório, revisor e status, as evidências D1 e `F0-DEMO.md`, e nove capturas com SHA. Qualquer alteração deixa Q50 VERMELHO.
- **Testes:** os seis testes E6b continuam referenciados (`:388-395`).
- **Fora da linha:** CI e merge ficam explicitamente fora, o que é coerente com um gate que vem antes do merge. Não exijo merge humano.
- **Recibo autodeclarado:** a existência do PR e o estado draft vêm do próprio recibo, e a matriz não consulta o GitHub. Isso é aceitável para um recibo documental.

## Limites

- Não executei testes nem o scanner. Por isso não confirmei que o pdf.js detecta as mesmas páginas que o pypdf/pypdfium2 usados pela Astra, nem que os SHAs do manifesto e do recibo batem com os bytes.
- Não abri as capturas, os PDFs, `PHI-matriz-final-01.log` nem `CLAUDE-REAUDITORIA-D1.md` por completo.
- Não analisei o histórico Git. O scanner cobre índice e worktree, não os commits anteriores do PR.
- Não reproduzi valores de identificadores.

## Veredito

M1, M2, M3 e B4 estão fechados e falham fechado no gate do repositório. Não há achado ALTO nem MÉDIO, só os cinco BAIXOs acima. Q50 representa evidência de aceite sem fingir ser consumidor de runtime. Antes da bateria final, recomendo confirmar com git que o delta de `1b56427` até o HEAD não toca código clínico (BAIXO 3).
