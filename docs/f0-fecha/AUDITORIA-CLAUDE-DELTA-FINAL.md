# Auditoria complementar do delta final

Resultado original do Claude via endpoint Anthropic, modelo claude-opus-5-5, somente leitura, 17 turnos. JSON bruto preservado localmente em .git/f0-fecha-audit/delta-final.json; SHA-256: d1673961503ad0748e73b9c6646aa9162fbb31343784df639a9b8a09de07bd28.

Snapshot inspecionado durante preparação de 22c886e. M1/M2/M3 do scanner encaminhados à Luna 5; não confundir este relatório com aprovação das correções posteriores.

# Auditoria READ_ONLY: delta de higiene e demo

Escopo: os seis arquivos pedidos. Para checar o provider, li também `src/app/oncoassist.ts`, `src/app/oncoassistLocal.ts`, `src/server/rotas.ts` e `scripts/vite-f0-demo.config.mjs`. Não editei arquivos, não executei comandos e não rodei testes.

## Confirmações

- **Bytes atuais:** o scanner lê o arquivo do worktree (`readFileSync`, `scripts/phi-repo.mjs:470`) só depois de três checagens: `lstat`, recusa de symlink (`:444-448`) e `realpath` contra a raiz física (`:450-461`). A lista de arquivos vem de `git ls-files -z --cached --others --exclude-standard` (`:414`). Se essa listagem falha, o resultado é fail-closed (`:418-421`).
- **Links e junctions:** symlink de arquivo e diretório pai que resolve para fora do repositório viram `pending`/`unscanned` e não são lidos.
- **Binários:** imagens e woff2 exigem SHA, categoria e magic corretos no manifesto (`:479-499`). Conteúdo com NUL ou UTF-8 inválido vira `binario_opaco` (`:526-532`). XLSX ou PDF ilegível e PDF sem texto vão para `unscanned`. O teste do repositório exige `unscanned: []`, então esses casos fazem o teste falhar, ou seja, ficam fail-closed.
- **EOL não vira dispensa por conteúdo:**
  - `utf8-lf` só muda o hash usado para comparar com o manifesto (`:38-51`, `:53-60`).
  - Os candidatos continuam sendo extraídos do texto real decodificado.
  - Qualquer mudança de conteúdo gera `manifest_hash_mismatch` e devolve todos os candidatos como findings (`:184-195`).
  - Arquivo binário, ou texto com NUL, declarado como `utf8-lf` vira `pending` (`:472-476`).
- **Demo com provider desligado:** a demo define `ONCOASSIST_JEV_ENABLED="false"` (`demo-servidor.ts:15`) antes de `criarOncoassistJev()` (`oncoassistLocal.ts:56`), e a flag é lida na chamada, não na importação (`oncoassist.ts:36`). Depois, a demo exige do endpoint de status a resposta `PENDENTE/DESABILITADO` antes de qualquer ingestão (`demo-servidor.ts:62-64`). O único destino externo em `src` é o SDK JEV (`src/kernel/llm/jev/sdk.ts:11`). A demo força o desligamento e o confirma em tempo de execução.

## Achados

**MÉDIO**
1. **Diretório na lista do Git é ignorado em silêncio** (`scripts/phi-repo.mjs:462`). A linha `if (!stat.isFile()) continue;` não registra `pending`/`unscanned` nem marca o caminho como visto. Submódulos (gitlink) e repositórios aninhados não rastreados aparecem como diretório e passam sem nenhum registro. Isso é fail-open.
2. **Índice do Git não é escaneado** (`:470`). O scanner lê o worktree, mas o commit publica o índice. Se um arquivo com PHI for adicionado com `git add` e depois "limpo" só no worktree, o scanner aprova. O mesmo vale para `skip-worktree`/`assume-unchanged` e para filtros clean em `.gitattributes`. A frase "bytes atuais do checkout" em `PORTABILIDADE-PHI.md:3` está correta, mas não cobre o que de fato vai para o commit.
3. **PDF aceito com página sem texto** (`:514`). Basta `pages.some(...)` ter texto para o PDF contar como escaneado. Um PDF com uma página de texto e páginas de laudo digitalizado como imagem passa sem pendência. Imagens embutidas no PDF também não são revisadas.

**BAIXO**
4. **XLSX lido em parte** (`:277`). O scanner lê só `sharedStrings` e `sheetN`. Comentários, cabeçalho/rodapé, `docProps` (autor) e imagens embutidas ficam fora, sem nenhum registro.
5. **Dispensa fixa por caminho, sem vínculo ao manifesto** (`:79-84`, `:132`). Em `PHI-TRIAGEM.json`, candidatos de telefone dentro de campos `sha256` de 64 hex são descartados antes de qualquer registro. O escopo é estreito, mas é a única supressão que não passa por tipo, linha e SHA.
6. **Janela de corrida (TOCTOU)** entre `realpath` (`:451`) e `readFileSync` (`:470`). Exige um atacante local, então o risco é baixo.
7. **Testes insuficientes nestes pontos** (`tests/f0-fecha/phi-repo.test.ts`):
   - Não há teste de symlink de arquivo (só junction de diretório).
   - Não há teste, no nível do repositório, de NUL/UTF-8 inválido gerando `binario_opaco`, nem de `utf8-lf` em arquivo binário gerando `manifest_hash_mode_invalid`. A linha 183 só testa a função `sha256`. Por isso, a afirmação "testes cobrem modo inválido" (`PORTABILIDADE-PHI.md:5`) vale só em parte.
   - Não há teste de diretório ou gitlink na lista, nem de divergência entre índice e worktree, nem de PDF misto.
   - O teste da linha 267 depende do estado real do repositório.
8. **Rastreabilidade da demo:** `F0-DEMO.md:3` cita "`db1c550` mais a correção", mas `demo-servidor.ts` ainda está modificado e não commitado. Os bytes executados não estão fixados em nenhum commit. Além disso, nenhum teste automatizado executa a fixture da demo; a garantia de provider desligado depende só da checagem em tempo de execução (que é suficiente).

## Limitações

- Não vi as nove capturas, os logs nem o manifesto `PHI-TRIAGEM.json`/`PROVA-EOL-MANIFESTO.json`, então não confirmei os SHAs nem os 63 registros de EOL.
- Não verifiquei se o build em `dist/f0-demo` corresponde ao fonte atual.
- Não analisei o histórico Git (commits anteriores), que o scanner também não cobre.
- Não reproduzi nenhum valor de identificador.
