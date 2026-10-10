# C2-L5 — triagem contextual do scanner PHI

## Estado

Implementação e manifestos revisáveis preparados no worktree `f0/f0f-luna5`. Prova final curta executada: `tsc --noEmit` PASS; dos cinco casos Vitest, quatro de positivos/negativos/hash/XLSX passaram e o scan de repo ficou FAIL legítimo por 35 candidatos PENDENTE e o WEBP protegido. Não fiz commit nesta escrita do relatório.

## Disposições individualizadas

`PHI-TRIAGEM.json` registra disposições por caminho, SHA-256 integral, tipo, página (PDF), linha e ordinal do match, com referência de evidência. A aplicação exige igualdade do hash, do tipo/página/linha/ordinal, evidência e contexto. Se o hash mudar, a disposição deixa de valer e o candidato retorna PENDENTE. Candidatos sem evidência suficiente estão registrados como PENDENTE e continuam no resultado do scanner; não há allowlist por diretório.

O snapshot sanitizado anterior continha 180 linhas/categorias. A recontagem por token, ordinal e página produziu 210 ocorrências e o manifesto contém 210 itens correspondentes; há várias correspondências na mesma linha e páginas distintas dentro do mesmo PDF. A reclassificação C2-L5 resultou em:

| Disposição | Itens | Evidência contextual |
|---|---:|---|
| Falso positivo técnico | 64 | 18 identificadores de microprompt em 14 linhas; 46 matches telefônicos dentro de tokens hash/commit completos de 40/64 hex, inclusive três campos JSON SHA-256. |
| Sintético declarado | 103 | Disposições token a token em fixtures/artefatos com declaração contextual, incluindo linhas com múltiplos identificadores. |
| Metadado público de autoria/contato | 8 | Quatro e-mails de autoria/proveniência e quatro contatos rotulados em página editorial de manual externo; candidatos da página sem rótulo permanecem pendentes. |
| PENDENTE | 35 | CNS 14, CPF 2, telefone 10, e-mail 7 e cabeçalho de nome 2. Permanecem findings e não foram promovidos. |

Os 58 matches telefônicos tratados como hash na triagem anterior foram revistos com fronteira exata: **46** estão dentro de token completo SHA/commit 40/64 hex. Os outros 12 não recebem exceção automática por serem abreviações ou fragmentos hex; seguem apenas outra disposição se houver evidência própria, caso contrário ficam PENDENTE. A referência individual de todas as linhas/ordinais está no manifesto e no log final sanitizado.

Os substrings numéricos dentro de um valor estritamente hexadecimal de 64 caracteres no campo `sha256` do próprio `PHI-TRIAGEM.json` têm contexto técnico pelo esquema: o manifesto contém os hashes usados para vincular os demais arquivos e não pode se auto-hashear. A exclusão vale somente nesse campo/caminho e tem prova positiva/negativa dedicada.

Para candidatos abreviados, a triagem consultou o contexto Git e tentou `git rev-parse --verify <token>^{commit}` sem imprimir o token nem a saída do hash. Nenhum candidato pendente resolveu para objeto commit. `docs/f0-fecha/STATUS.md:28` tem contexto Git-like, mas não resolve; permanece PENDENTE. Não suprimi correspondências apenas por caracteres hexadecimais.

Por isso, as categorias preliminares de 66 sintéticos e 37 desconhecidos não foram copiadas como se fossem fatos. A revisão por contexto, ordinal e página deixou 103 disposições sintéticas, oito itens como metadado público de autoria/contato e 35 PENDENTE. A evidência por arquivo/linha/hash governa cada disposição; pasta `tests/`, marcador distante ou nome de artefato não libera um valor por si só.

Os 14 falsos positivos de microprompt estão individualizados em `docs/ondas/W8-GLM.md:8,11,14,17`, `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md:207`, `docs/progresso/W8-GLM.md:22`, `tests/prompts/captura.test.ts:6`, `docid.test.ts:6`, `path-sitios.test.ts:6`, `prompts.test.ts:33,64-66` e `tests/w11-adv/seguranca-phi.test.ts:65`. A disposição é por token em contexto de catálogo/versão, protegida pelo hash do arquivo.

Os sintéticos foram confirmados por declarações próximas e específicas, com referências por ocorrência no JSON: `tests/fixtures/redteam/pacientes.ts`, `tests/fixtures/caso07/`, `tests/rules-w8/`, `tests/w11-adv/` e os demais arquivos com marcador local explícito. A regra global `docs/ondas/F0-FECHAMENTO-ASTRA.md:54` limita a declaração de nomes a `Paciente Teste NN`; ela não libera dados de outros arquivos nem valores de uma pasta inteira.

Os 50 itens PENDENTE continuam sem exceção: entre eles há campos numéricos em `docs/design/prototipos/*`, identificadores em fontes de teste sem marcador local (por exemplo `tests/modules/vinculo.test.ts` e `tests/app/executores.test.ts`), `src/ui/api/fake.ts:214`, além dos dois candidatos de cabeçalho em `docs/referencias/externos/manual-paciente-oncologico-2023.pdf:1` e `docs/referencias/ui-modelos/Triagem_QT_v20.html:213`. A lista íntegra tipo/caminho/linha e o motivo PENDENTE estão no manifesto. A classificação não presume que teste, fixture, nome de pasta ou modelo HTML tornem o conteúdo sintético.

## Mídia e arquivos binários

Os dez rasters revisados visualmente pela Astra têm hashes locais iguais aos fornecidos. As disposições preservam a fonte e a limitação da revisão; não afirmam anonimização universal:

- `docs/design/oncochart/assets/annot.png`, `crop-header.png`, `crop-right.png`, `crop-timeline.png` e `ref.png`: handoff de mock fictício em `docs/design/oncochart/DECISAO-UI-ALVO.md:3`, com revisão visual Astra de 2026-10-09.
- `ct-abdome.jpg` e `ct-torax.jpg`: placeholders de CT sem identificação visível, evidência `docs/design/oncochart/README.md:144` e revisão visual Astra.
- `docs/w7/kit-preview/apac-html.png`: formulário rascunho vazio/PENDENTE, revisão visual Astra e `docs/w7/COMO-EXECUTAR.md:48`.
- `apac-pg1.png`: formulário oficial vazio, revisão visual Astra e `docs/ondas/ADENDO-W6-W7.md:74`.
- `workspace-pesquisa.png`: interface de estudo fictício, revisão visual Astra e `docs/w7/COMO-EXECUTAR.md:57`.

Os dois WOFF2 foram classificados como fontes técnicas depois de validar magic `wOF2`, SHA-256 e a proveniência em `src/ui/oncochart/tokens.css` e `src/ui/oncochart/fontes/OFL-geist.txt`. A planilha `docs/referencias/protocolos/protocolos-citotoxicos-revisado-silas.xlsx` passa pelo leitor ZIP local: só lê XML de shared strings e worksheets, não executa fórmulas ou macros e não acessa rede. Se houver macro, ZIP inválido ou limites excedidos, mantém UNVERIFIED.

`docs/referencias/ui-modelo-consulta.webp` permanece **PENDENTE**. Não foi aberto visualmente, lido nem hasheado; o manifesto usa uma entrada protegida por caminho que o scanner verifica antes de tentar abrir o arquivo. A prova total deve continuar FAIL enquanto esse item aguardar revisão do usuário.

## Provas e estado atual

O teste cobre positivos/negativos por classe, ID sem declaração, disposição limitada a um ordinal, invalidação quando o hash muda, microprompt/hash com contexto delimitado e XLSX mínimo em memória sem macro/rede. Saídas finais sanitizadas: `evidencias/c2-l5/typecheck-final.log` e `evidencias/c2-l5/phi-repo-test-final.log`.

O resultado do scan real foi: 35 findings PENDENTE (CNS 14, CPF 2, telefone 10, e-mail 7, cabeçalho 2), um caminho WEBP protegido como PENDENTE/UNVERIFIED e 36 pendências totais. As provas de detecção e de hash binding passaram; o teste global preservou o FAIL esperado, sem converter desconhecido em PASS. O inventário tokenizado foi reconciliado em 210/210 itens no manifesto por leitura local de fontes e páginas de PDF; nenhuma mídia protegida foi aberta.

Slot de teste liberado após a prova. Sem TSC/UI/suíte ampla adicional. O commit único C2-L5 e o hash serão registrados no retorno final; sem push.
