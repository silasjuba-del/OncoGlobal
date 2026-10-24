# Limpeza não clínica — 24/10/2026

Base: `3fb1b3824f690f518a68442ffbdd8e416538a9d0`. Escritor deste lote: Codex. Worktree isolada; Claude continua responsável pelo EST-08 e pelas suas branches.

## Entrega

Retirados da árvore ativa 69 arquivos, 12.463.148 bytes brutos, após preservar os consumidores indiretos do recibo Q50:

| Grupo | Arquivos | Bytes |
|---|---:|---:|
| PDFs externos sem carregamento pelo produto | 2 | 10.737.409 |
| Protótipos e assets de design | 27 | 1.440.693 |
| Logs brutos históricos de F0 sem vínculo Q50 | 40 | 285.046 |

O ganho líquido desconta o inventário e a ferramenta de recuperação. Isto reduz a árvore atual, não o histórico Git nem, por si só, o bundle ou a memória do navegador.

## Preservação e recuperação

O [inventário](NAO-CLINICO-20261024.json) identifica cada original por caminho, tamanho, blob Git, SHA-256 e motivo. Todos os originais foram copiados e comparados com os blobs da base antes da retirada. A cópia local está em `C:\Users\silas\Projects\OncoGlobal-archives\20261024-nao-clinico-3fb1b38`, incluindo `originais.zip`, inventário inicial e a triagem anterior. O backup inicial conserva os 81 originais da primeira seleção; `inventario-v2.json` descreve os 69 externos atuais, e `correcao-ci-Q50.json` registra os 12 reintegrados. O arquivo ZIP completo também foi lido e verificado por entrada. Ele fica fora do repositório.

Em outro checkout com os objetos do histórico disponíveis:

```powershell
node scripts/restaurar-nao-clinico.mjs --destino 'C:\Users\silas\Documents\OncoGlobal-arquivo-recuperado'
```

O destino deve ser uma pasta nova, com pai existente, fora do checkout. Acrescente caminhos do inventário para selecionar apenas alguns arquivos. O comando não faz fetch, não altera branches, não escreve no checkout nem sobrescreve destino existente. Confere bytes e SHA-256 de todos os selecionados antes de criar a saída. Se o clone for raso e faltar um blob, retorna erro explícito; recuperar o histórico completo ou usar a cópia local preservada. Não reescrever o histórico: ele também conserva a proveniência.

## Fronteiras mantidas

- Nenhuma mudança em `corpus/**`, regras, doses, limiares, conteúdo clínico, assinaturas, permissões, banco ou bibliotecas de execução.
- Nenhuma mudança nos arquivos e nas branches reservados a Claude. Sem integração das PRs #54–#59 e sem intervenção no EST-08.
- As especificações Markdown de design ficam em `docs/design`; os protótipos executáveis e as imagens de referência têm recuperação pelo inventário.
- Os documentos de fechamento e o arquivo histórico de 403 movimentos continuam disponíveis. O teste de preservação existente permanece íntegro; não foi enfraquecido para permitir exclusões.
- PHI-TRIAGEM.json mantém integralmente os registros dos arquivos retidos; só os 12 registros cujos arquivos saíram da árvore ativa foram retirados. A triagem anterior acompanha os originais fora do repositório. Nenhuma classificação dos arquivos retidos foi alterada. Os únicos registros novos tratam dos hashes técnicos do inventário, conforme a evidência abaixo; não há nova aprovação clínica ou de paciente.
- O ZIP oficial SIGTAP, o grafo RAG, as fichas e os documentos clínicos de referência permanecem ativos.
- A cópia `PRESCRICAO-POR-TOXICIDADE.md` tem consumidor em teste, e as pequenas fachadas de código mantêm imports compatíveis; não foram apagadas por parecerem duplicadas.

## Prevenção de recorrência

Novos `.log` locais são ignorados pelo Git. Testes e scripts devem gravar evidências em TEMP isolado/artefatos de CI. Os arquivos já rastreados não são ocultados pela regra. Não há instalação, remoção ou alteração de dependências neste lote.

## Provas

A validação usa testes dirigidos de recuperação, preservação documental e scanner de PHI, mais typecheck e verificações de fronteiras/corpus. O CI permanece responsável pela suíte completa. A recuperação tem provas de bytes binários idênticos, recusa de hash divergente, fuga de caminho, destino no checkout, sobrescrita, seleção desconhecida e blob ausente.

A apresentação clínica e o plano de tumor packs não fazem parte desta entrega. O lote não declara aprovação clínica nem disponibilização em produção.

### Triagem dos identificadores de integridade

O scanner encontrou sete sequências com formato numérico dentro dos SHA-256 do novo inventário. Cada ocorrência foi conferida por posição: todas estão exclusivamente dentro do campo hexadecimal SHA-256 de 64 caracteres de um original preservado. A triagem usa o mecanismo existente de falso positivo técnico, com linha, tipo, ordinal, evidência e hash do inventário exato. O scanner e seus critérios não foram alterados; nenhuma regra clínica ou revisão de paciente foi criada.

## Correção do CI — Q50

A primeira seleção retirou nove capturas e três logs vinculados por hash em Q50-ACEITE.json. O CI detectou a dependência indireta na matriz de F0. Os 12 foram restaurados com os bytes originais; o recibo, seus hashes e os testes não mudaram. Esses arquivos permanecem ativos e protegidos contra nova retirada. A varredura seguinte deve seguir referências de manifestos/recibos, inclusive transitivas, além de imports e caminhos usados diretamente por código.
