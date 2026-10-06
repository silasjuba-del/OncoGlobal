# Evidência da extensão UI/Pesquisa

## Executado

- Merge fast-forward para `12b5dcd4ced28ca87f004c550c6bf7b68977ae30`, sem conflito.
- Regressão anterior: `tests/w3/auditoria-regressao.test.ts`, 9 testes aprovados antes da composição.
- Typecheck e verificações de fronteiras/corpus existentes, sem alterar seus critérios.
- Testes seriados da pesquisa, dos prompts, da persistência, do kit, do APAC e dos executores.
- HTTP real em loopback: sessão, CSRF, origem externa negada, RAW inválido preservado, conflito de revisão, reinício, leitura por outro processo e replay de impressão.
- Playwright em navegador real: upload JSON pelo seletor de arquivos, candidato com fonte, revisão da versão, inclusão/exclusão, `POSSIBLE_MATCH`, alocação ao braço e registro de imagem seriada com negação preservada.
- Receita: itens selecionáveis, item desmarcado ausente na prévia, marca de rascunho.
- APAC: prévia HTML autenticada em iframe. Conferida visualmente contra a rasterização do PDF fonte; disposição e blocos conferidos, não homologação administrativa.
- Layout sem overflow horizontal nas larguras 375, 762, 1041 e 1440 pixels.
- Build Vite SSR da composição local aprovado.
- `git apply --check` do patch opcional de comando aprovado; patch não aplicado.

## Correções encontradas na revisão cruzada

1. Critérios de exclusão independentes agregados por OR; inclusão por AND, preservando os grupos explícitos.
2. Fatos vinculados ao paciente, revisão selada por hash, evidência e versão verificadas.
3. Documentos binários preservados com SHA-256; conteúdo textual mutado sob hash anterior rejeitado.
4. Alocação a braços documentada e conflitos na mesma data recusados sem sobrescrever.
5. Citações de Oncoboard validadas por fonte, versão e trecho desidentificado.
6. Impressão publicada atomicamente; clique duplo e chaves distintas não observam arquivo parcial.
7. Token CSRF e senha excluídos do registro RAW. Origem de formulários locais preservada sem enviar referência para sites externos.
8. Páginas físicas do kit corrigidas para 1–5, apesar de cada documento imprimir internamente “Pagina 1”.
9. CID/diagnóstico APAC sem lote confirmado permanecem PENDENTE; justificativa e observações médicas são preservadas.
10. Prazo/data pericial não presumidos; campos ausentes não ficam parcialmente preenchidos.

## Não executado / dependências

- LLM real, extração por IA e OCR: **DISABLED**, dependentes de fornecedor e gate local validado. Não foram enviados documentos.
- Inclusão de participante em estudo real, randomização e elegibilidade definitiva: **não implementadas nem alegadas**.
- Importação automática do ledger canônico e integração ao shell/API do Cursor: **pendentes de integração**.
- Assinatura clínica real, exportação SIA, impressora física e impressão silenciosa: **NOT_RUN / não habilitadas**.
- A prévia de impressão e os executores são testados; impressão em driver real e homologação oficial do APAC ainda dependem do médico/instituição.

Saída integral da rodada final: `VERIFY-FINAL.txt`. Os arquivos de teste e o roteiro Playwright preservam reproduções dos critérios verificados.
