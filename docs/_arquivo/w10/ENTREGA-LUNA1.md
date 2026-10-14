# W10 · Entrega de extração e leitura

Estado: implementação produzida; validação **NOT_RUN** por instrução do orquestrador.

## Alterações nesta faixa

- O extrator reconhece `colo uterino` e `colo do utero` (com ou sem acento em “útero”) como `utero`, mantendo a expressão original em `rawEvidence`. `colo` sozinho fica ambíguo; `colon` e `cólon` explícitos continuam reconhecidos.
- Todos os laboratórios com unidade reconhecida na mesma linha geram candidatos separados. A negação é limitada à cláusula entre pontos e vírgulas, então `Nega dor; creatinina 1,4 mg/dL` preserva o laboratório e não cria sintoma.
- Plaquetas com agrupamento explícito (`20.000 /mm3`) são capturadas e normalizadas como 20.000/mm³. O agrupamento por ponto fica restrito a plaquetas; `1.400` para outro marcador permanece nulo, UNCERTAIN e exige confirmação.
- Unidades `µmol/L`, `μmol/L` e `g/L` são preservadas no literal e ficam sem normalização canônica, portanto PENDENTE.
- “Não se pode excluir”, “sugestivo”, “compatível” e “provável” produzem candidatos UNCERTAIN com confirmação, inclusive achados de imagem. `cN2` isolado e menções Plaud de medicamento conhecido junto de dose/frequência literal também ficam como candidatos incertos; nenhum estágio completo, dose, regime ou conduta é inferido.
- DOCX com bytes que não decodificam como UTF-8 fica PENDENTE e não expõe texto mojibake.
- A cobertura R1 do Caso 07 agora exercita conversão, hash, conteúdo preservado e não promoção de trechos riscados. O teste legado que afirmava inexistência de leitura foi removido.
- O teste GROK-11 constrói um repositório Git sintético em `os.tmpdir()`, com commits de base e mudanças controladas. Assim prova diff permitido/barrado e W8 preexistente/novo sem exigir refs locais; a limpeza valida que o alvo é filho temporário criado pela fixture.
- Os casos RT-04 agora preservam achados sob linguagem incerta como candidatos UNCERTAIN com confirmação e campo não resolvido; `PSA 1.400` conserva o literal sem assumir escala numérica. A expectativa antiga que removia a imagem foi substituída por asserções de segurança no pipeline.
- Rasura multiline preserva texto/hash e PENDENTE; o extrator deixa passar apenas trechos fora dos marcadores. Laboratórios datados normalizam para ISO antes da reconciliação; data inválida ou ausente permanece sem `date` canônica e exige confirmação. Reconciliação não resolve candidatos UNCERTAIN ou que pedem confirmação, mantendo fato explícito concordante de duas fontes resolvido.

## Limites e validação

Arquivos desta entrega: `src/kernel/extracao/extrator.ts`, `src/kernel/extracao/normalizacao.ts`, `src/leitura/caixa-unica.ts`, `tests/cobertura/caso07.test.ts`, `tests/w10-entrega/extracao.test.ts` e `tests/w10-grok/grok-11-manifesto.test.ts`. Nenhum script, contrato, policy, projeção, workflow, dependência ou arquivo de outra faixa foi alterado por esta entrega. Não houve commit, push ou merge.

Não executei testes, typecheck, boundaries ou corpus nesta sessão. Para validação global serializada, executar da raiz:

```powershell
& '.\docs\w10\astra\validar.ps1' `
  -Worktree 'C:\Users\silas\Projects\OncoGlobal-wt\w10-astra' `
  -Rotulo 'ENTREGA-LUNA1-EXTRACAO' `
  -Testes @('tests/w10-entrega/extracao.test.ts','tests/cobertura/caso07.test.ts','tests/w10-grok/grok-11-manifesto.test.ts')
```

O wrapper adquire o lock Vitest global e roda typecheck, boundaries, corpus e esses dois arquivos com um worker e `--no-file-parallelism`. Os resultados permanecem NOT_RUN até a execução pelo root.
