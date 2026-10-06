# ONCOMED · acessibilidade (W8-MUSE · MU-10)

> Piso de qualidade (não de compliance formal): a consulta acontece sob luz
> variável, com o paciente ao lado, contra o relógio. Revisão dos 6
> protótipos contra este guia na §6.

## 1. Teclado

- Tudo opera sem mouse: abas (Tab + Enter), accordion nativo (`<details>`),
  modal/gaveta (Esc fecha, foco vai para o botão Fechar ao abrir), carrossel
  (botões anterior/próxima + miniaturas focáveis), toggles (`aria-pressed`).
- Ordem de foco = ordem visual (sem `tabindex` positivo em nenhum lugar).
- "Pular para o conteúdo" como primeiro elemento de cada tela.
- Nenhuma armadilha de foco: overlay fecha ao clicar fora e com Esc.

## 2. Foco visível

- `:focus-visible` global: contorno 2 px + deslocamento 2 px, nunca só cor
  (ver `tokens-oncomed.css`).
- Ao abrir modal/gaveta, o foco move para dentro; ao fechar, volta para o
  controle que abriu (Cursor implementa o retorno no app real).

## 3. Leitores de tela

- `html lang="pt-BR"`; um `h1` por tela; regiões com `aria-label`.
- Estado nunca só visual: semáforo = ícone + palavra; chips têm texto.
- Ícones SVG sempre `aria-hidden="true"`; o rótulo mora no uso (texto do
  botão/link ou `aria-label`).
- Controles de estado usam `aria-pressed` (ECOG, filtros, toggles de
  impressão) e `aria-selected` (abas); carrossel anuncia "corte N de M".
- `role="alert"` **só** no banner E1. Toasts usam `role="status"`.
- Tabelas densas têm `th` real; barras de progresso usam
  `role="progressbar"` com `aria-valuenow/min/max/label`.

## 4. Alvos e contraste

- Alvo mínimo 24×24 px (WCAG 2.2 AA); ações clínicas frequentes ≥ 40 px
  (ECOG 40, checkboxes do kit 20 px + rótulo clicável grande).
- Texto: pares AA da tabela do MU-01 (todos ≥ 4,5:1 medidos).
- Links de diretriz sublinhados; foco nunca removido.

## 5. Movimento e impressão

- Toda transição usa os tokens `--om-transicao-*`; com
  `prefers-reduced-motion`, tudo vira 0 ms (sem fade/slide).
- Nada anima em loop; contagem regressiva do break-glass é texto, sem piscar.
- Impresso: preto no branco, marca d'água com texto (não só cor).

## 6. Revisão dos protótipos (MU-10, contra este guia)

| Item | consulta | salao | agenda | apac | centro-comando | impressos |
|---|---|---|---|---|---|---|
| `lang=pt-BR` + skip link | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `role=alert` só E1 | ✓ (nenhum) | ✓ (só banner E1) | ✓ (nenhum) | ✓ (nenhum) | ✓ (nenhum) | ✓ (nenhum) |
| SVG `aria-hidden` | ✓ | ✓ | ✓ (nenhum) | ✓ (nenhum) | ✓ (nenhum) | ✓ (nenhum) |
| Botões nomeados | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `aria-pressed/selected` | ✓ | n/a | ✓ | n/a | n/a | ✓ |
| Diálogos rotulados + Esc | ✓ modal+gaveta | n/a | ✓ modal | ✓ gaveta | ✓ modal | n/a |
| Alvo ≥ 24 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `prefers-reduced-motion` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Foco visível | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Verificação: varredura automatizada (`role=alert`, svg sem `aria-hidden`,
botões/inputs sem nome, `lang`, skip link, diálogos, `prefers-reduced-motion`)
+ conferência manual de alvos e ordem de foco. Achados corrigidos antes do
fechamento: avatar repetido no salão, `</div>` sobrando no salão, linha da
receita que sumia com o próprio checkbox, impressos sem skip link/foco/
`reduced-motion`.
