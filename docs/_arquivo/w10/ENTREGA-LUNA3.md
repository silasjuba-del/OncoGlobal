# W10 · entrega L3 — consulta local do grafo

## Serviço disponível para composição

`src/app/pesquisa/conhecimento.ts` exporta:

```ts
consultarGrafoLocal(input: {
  query: string;
  tipos?: readonly string[];
  status?: readonly string[];
  proveniencia?: { modulo?: string; aula?: string };
  topK?: number;
}): Promise<ResultadoConsultaGrafo>
```

A função consulta explicitamente os dois JSONL locais por meio de `carregarGrafoEstrito`, sem escrita, rede, LLM ou dependência nova. O servidor pode chamar a função depois de autorizar a leitura local. A assinatura não implica rota HTTP integrada.

A resposta de sucesso informa `modo: "LEXICAL"`, `vetorial.status: "NOT_IMPLEMENTED"`, até 20 resultados, status, tipo e proveniência da referência, hash SHA-256 por arquivo e versão de conteúdo derivada dos hashes. O ranking usa correspondência exata de tokens normalizados em nome, `embedding_text` e id; esse campo do corpus é texto comum, não um vetor. O resultado é marcado como `REFERENCIA`, `usavelComoRegra: false` e `usavelComoFicha: false`. Nenhum resultado declara elegibilidade ou recomendação.

Falha de leitura do corpus e consulta inválida são recusadas. Se o loader estrito detectar qualquer nó/aresta inválido, toda a consulta retorna `RECUSADA / GRAFO_INVALIDO` com códigos e linhas, sem expor o texto bruto dos registros inválidos.

## Inspeção do corpus no worktree

Leitura UTF-8 dos arquivos presentes em `docs/referencias/ragGRAFO-oncologia/dados`:

| Verificação | Resultado observado |
|---|---:|
| Nós JSONL | 2.971 |
| Arestas JSONL | 9.347 |
| Nós `NAO_VERIFICADO` | 2.746 |
| Nós `DIRETRIZ_FINAL_SBOC_2026` | 225 |
| Arestas órfãs por inspeção de ids | 0 |
| Nós com `embedding_text` textual não vazio | 2.971 / 2.971 |
| Campos vetoriais numéricos | 0 |

`contagens.json` estava divergente (2.746 nós e 8.024 arestas) e foi sincronizado com os JSONL auditados: total, distribuição por tipo/relação e órfãs. O campo `fundidos` foi preservado como metadado histórico, pois não pode ser recalculado a partir do grafo final. Os arquivos de nós e arestas não foram alterados.

## Testes e integração

Foi criado `tests/w10-entrega/brain.test.ts` para busca real lexical de “TEOC” com filtros e para recusa de grafo inválido. **Não executado**, conforme serialização do root. A integração HTTP depende do consumidor no servidor/Luna5 e permanece `NOT_IMPLEMENTED` até que essa composição seja concluída e validada.
