---
name: aee
description: Análise Estruturada de Erros (AEE) – "Pergunte antes de codificar". Use ANTES de gerar, modificar ou revisar código no OncoGlobal, sobretudo quando houver dados clínicos, PI/PHI, testes, contratos entre módulos ou idempotência. Aciona com "AEE", "modo AEE", "analise erros", "onde posso errar", "antes de codificar". Antecipa erros (mín. 3), lista perguntas pendentes, classifica cada erro (tipo universitário, frequência, causa raiz Slip/Mistake/Lapse, impacto clínico/técnico, correção imediata+definitiva, modalidade preventiva, evidência) e só propõe código após as dúvidas serem respondidas.
---

# Análise Estruturada de Erros (AEE)

Princípio: **antecipar, não corrigir depois.** Antes de gerar ou alterar código, pergunte-se:
_"Onde posso errar com estes dados que o usuário está me pedindo?"_ — e traga as dúvidas ao usuário em vez de assumir.

## Fluxo obrigatório

1. **Questionário pré-análise** (seção 3): responda o que der a partir do código/pedido; o que não der vira pergunta pendente.
2. **Antecipação de erros** (mín. 3 itens), em tabela:
   | # | Possível erro | Risco clínico | Risco técnico | Probabilidade | O que confirmar |
   (Alto/Médio/Baixo; Alta/Média/Baixa)
3. **Perguntas pendentes** — só as necessárias para eliminar/mitigar os erros.
   **PARE aqui** se houver pergunta que muda o código. Não proponha código corrigido antes da resposta (não-adivinhação).
4. **Análise estruturada por erro** — os 7 itens abaixo, erros de **Alto** risco (clínico ou técnico) no topo.
5. **Contratos, listas configuráveis e barreiras** quando aplicável.
6. **Código** — só após respostas; depois rodar lint/typecheck/testes do repo.

## 1. Os 7 itens por erro

1. **Tipo** (nomenclatura da seção 2)
2. **Frequência estimada**: Alta | Média | Baixa + porquê
3. **Causa raiz**: Slip | Mistake | Lapse | Outra + explicação
4. **Impacto**: clínico (A/M/B + justificativa), técnico (A/M/B + justificativa), consequência prática
5. **Solução**: correção imediata (trecho) + correção definitiva (melhor prática)
6. **Modalidade preventiva** (≥1 ação concreta): processo | técnica | automação | educação | arquitetura
7. **Evidência**: trecho exato ou `arquivo:linha`

## 2. Nomenclatura

### 2.1 Linguagem/compilação
| Categoria | O que é | Exemplo | Detecta |
|---|---|---|---|
| Léxico | Token inválido | Caractere não permitido | Lexer |
| Sintático | Estrutura gramatical incorreta | Chave não fechada; redeclaração de `const` | Parser |
| Semântico | Sintaxe ok, sentido inválido | Variável não declarada; tipos incompatíveis | Analisador semântico/TS |
| Lógico | Algoritmo incorreto | Condição invertida; filtro errado | Testes/revisão |
| Runtime | Falha em execução | Divisão por zero; `undefined`; I/O | Execução |

### 2.2 Engenharia de software
| Categoria | Exemplo |
|---|---|
| Requisitos | Não exigir janela laboratorial quando necessário |
| Projeto (design) | `@` em nome de arquivo sem sanitização; semântica de idempotência incorreta |
| Codificação | Regex sem normalização; copiar/colar com redeclaração |
| Interface/integração | `idempotencyKey` com semântica ambígua entre escopos |
| Validação/dados | Comparação estrita de HTML com conteúdo não determinístico |
| Concorrência | SQLite `database is locked` |
| Segurança | PI/PHI em nome de arquivo ou mensagem de erro |
| Desempenho | Loop aninhado desnecessário |
| Usabilidade/UX | Não limpar resultados antigos após atualização |
| Teste | `mockResolvedValueOnce` com ordem frágil; `toBe` estrito com dados variáveis |

### 2.3 Causa raiz humana
| Causa | Significado | Exemplo |
|---|---|---|
| Slip | Descuido manual | Redeclarar `const arquivo` ao copiar/colar |
| Mistake | Modelo mental incorreto | Achar que comparação estrita serve para HTML com metadados variáveis |
| Lapse | Esquecimento | Não documentar regra de descontinuação de arquivo legado |
| Outra | Não enquadrada | Decisão intencional mal documentada (justificar) |

## 3. Questionário pré-análise

1. O que se pretende fazer com este trecho?
2. Quais dados de entrada podem variar (datas, IDs, timestamps, timezone)?
3. Há dados sensíveis (PI/PHI)?
4. Há regras de negócio implícitas (ex.: legado + novo por retrocompatibilidade, prazo de remoção)?
5. Quais contratos estão envolvidos (ex.: idempotência por requisição ou por escopo)?
6. Há risco de ambiente (SO, filesystem, nomes de arquivo Windows/Linux)?
7. O que pode quebrar em CI e não localmente (flakiness)?
8. Há casos de alto risco clínico?
9. Quais suposições estou fazendo?
10. O que precisa ser confirmado antes de corrigir?

## 4. Checklist final

- [ ] Questionário respondido / dúvidas convertidas em perguntas
- [ ] ≥3 erros antecipados com risco clínico, técnico e probabilidade
- [ ] Perguntas pendentes respondidas pelo usuário antes do código
- [ ] 7 itens completos por erro; Alto risco no topo
- [ ] Causa raiz classificada; impacto clínico × técnico × prático separados
- [ ] Correção imediata + definitiva; ≥1 modalidade preventiva por erro
- [ ] Riscos de PI/PHI, portabilidade e flakiness avaliados

## Regras de segurança clínica

- Nunca inventar dado clínico, dose, CID ou desfecho para "fazer o teste passar".
- PI/PHI nunca em nome de arquivo, log, mensagem de erro ou fixture versionada.
- Em dúvida entre duas interpretações com impacto clínico, perguntar — não escolher.
