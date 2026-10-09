# Higiene de fim de linha e paridade de CI — L5

## Fim de linha

Inspeção estática do worktree `f0/f0f-luna5` em 2026-10-09, por bytes, nas 1.206 fontes textuais com extensões TS/JS, JSON, Markdown, YAML, HTML, CSS, PowerShell, TXT, SQL, shell, TOML, XML, CSV e ENV. Resultado: 54 arquivos CRLF, 1.152 LF, 0 mistos e 0 sem terminador de linha. Binários foram excluídos dessa contagem.

`.gitattributes` já existe e define `* text=auto`, LF explícito para TS/TSX/MTS/MJS/HTML/CSS/JSON/YML/MD, CRLF para PS1 e `binary` para PDF/WEBP/PNG/JPG. A regra atual é suficiente para a amostra medida; nenhuma alteração foi feita porque não há diff em massa a corrigir. Não foi necessário acrescentar outro `.gitattributes`.

## Paridade de verificação

`npm run verify` executa, nesta ordem, `npm run typecheck`, `npm run check:boundaries`, `npm run check:corpus` e `npm test`. `npm test` chama `vitest run` sem segmentação nem `--no-file-parallelism`.

O workflow `.github/workflows/verify.yml` chama `npm run verify` após checkout, Node 24 e `npm ci`; portanto, esse job executa a suíte padrão inteira. O workflow também tem um job adversarial separado, que executa `tests/redteam/vitest.config.ts` e `tests/adv-w8/vitest.config.ts`, ambos com `--no-file-parallelism`. Esses dois blocos adicionais não fazem parte de `npm run verify`. O comando local também não reproduz a segmentação serial definida em `docs/ondas/F0-FECHAMENTO-ASTRA.md` §5. Esta comparação é documental; nenhum workflow ou suíte foi executado por L5 antes da liberação de `TEST_SLOT`.

## Cobertura da varredura

O scanner da L5 tenta ler arquivos UTF-8, extrai texto de PDFs digitais pelo parser local existente e registra mídia/arquivos binários que não consegue ler como não escaneados. Imagens raster exigem OCR para provar ausência de identificadores no conteúdo visual; não há OCR local disponível nesta execução. Esses caminhos são uma limitação explícita da prova, não uma allowlist. O teste de varredura deve permanecer bloqueado enquanto houver arquivos não escaneados ou achados sem classificação autorizada.

Para as capturas futuras da demo D3, a proposta é manter no relatório um manifesto por arquivo com caminho, SHA-256, origem sintética demonstrada (SQLite temporário com `Paciente Teste 92`) e estado de inspeção visual da Astra. A pasta/extensão da captura não constitui evidência nem allowlist; mídias desconhecidas continuam UNVERIFIED.
