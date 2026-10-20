# Revisão técnica dos pins PHI após a refatoração — 20/10/2026

O scanner invalidou cinco pins após mudanças autorizadas. O Codex 2 comparou cada arquivo com a base `a8f919c`, verificou que o SHA-256 anterior corresponde ao manifesto e conferiu todas as linhas já classificadas. Não foram criadas disposições, ampliadas exceções nem alterados os tipos, ordinais, linhas ou estados de classificação.

| Arquivo | Mudança verificada | Evidência conservada |
|---|---|---|
| `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md` | Apenas nota de governança acrescentada ao final; o conteúdo anterior é prefixo idêntico | Identificadores técnicos da linha 207, sem alteração |
| `tests/app/executores.test.ts` | Apenas caminhos de imports, com o mesmo número de linhas | Asserções de nomes de arquivos locais; referência de implementação reapontada para `src/kernel/gateway/executores/imprimir.ts:79` |
| `tests/muse/autoridades.test.ts` | Apenas caminho do import canônico | Vetores de teste já declarados sintéticos, sem alteração |
| `tests/w11-adv/checkin-real.test.ts` | Apenas caminhos de imports | Declaração de fixture e ocorrências classificadas, sem alteração |
| `tests/w11-adv/fuzz-regras.test.ts` | Apenas caminhos de imports | Vetores de teste e ocorrências classificadas, sem alteração |

Para os quatro testes, uma comparação linha a linha confirmou que todo trecho modificado é uma declaração `import`, sem inserção ou remoção de linhas. Para cada disposição existente, a linha atual é idêntica à linha correspondente na base. A nota documental nova não contém dados de pacientes.

Somente após essa revisão foram atualizados os cinco hashes no modo existente `utf8-lf`, com referência a este registro. Isso é revisão técnica das mudanças e das evidências anteriores, não nova aprovação humana ou clínica. O scanner e seus testes permanecem inalterados; novas alterações voltam a invalidar os pins.
