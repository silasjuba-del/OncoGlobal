# ONCOMED · sistema visual (W8-MUSE · MU-01)

> Tokens: [`tokens-oncomed.css`](tokens-oncomed.css) (os protótipos em `prototipos/**` o importam).
> Consumidor: Cursor (W6) monta as telas; este documento é a referência de aparência.
> Regra-mãe (R-29/G-28): **a aparência é substituível; o significado é estável.**
> Trocar tema/layout nunca muda paciente ativo, escopo de "validar tudo",
> autoria de assinatura nem visibilidade de E1.

## 1. Princípios

1. **Consulta rápida, menos cliques, médico no centro.** Densidade serve à
   decisão. Cada tela resolve a etapa clínica inteira (Q17/Q18: ≤ 5 cliques
   no retorno de rotina).
2. **Cockpit, não startup.** Branco-gelo, superfícies claras, texto grafite,
   verde-petróleo do modelo como destaque. Sem gradiente decorativo, sem
   glassmorphism, sem métrica gigante de fintech.
3. **Vermelho só clínico** (conflito, alerta, E1). Ação, navegação e seleção
   usam o verde-petróleo — nunca vermelho, nunca roxo.
4. **Cor sempre com texto/ícone.** Nenhum estado depende só de cor
   (alergia, redução de dose, ECOG/CTCAE, semáforo).
5. **Ausente = PENDENTE, no próprio cartão.** Nunca vazio que pareça completo,
   nunca VERDE por falta de dado.
6. **IA propõe, código calcula, médico decide e assina.** Sugestão da IA é
   visualmente distinta de fato confirmado (ver MU-02).
7. **Movimento só comunica estado** (abrir/fechar, trocar seleção). Nada
   anima em loop; tudo respeita `prefers-reduced-motion`.

## 2. Cor

Paleta fechada. Novos tons só com par de contraste AA documentado aqui.

| Token | Hex (gelo) | Uso |
|---|---|---|
| `--om-fundo` | `#f2f5f6` | fundo da página |
| `--om-superficie` | `#ffffff` | cartões, modais, gavetas |
| `--om-superficie-sutil` | `#eef3f4` | poços, trilhas, zebrado |
| `--om-linha` / `-forte` | `#d5dee5` / `#b9c6cf` | bordas |
| `--om-texto` | `#232b31` | texto principal |
| `--om-texto-suave` | `#4d5a63` | texto secundário |
| `--om-destaque` / `-hover` | `#14685c` / `#0e4f45` | ações, ativo, selecionado |
| `--om-destaque-suave` | `#e0efec` | trilho de selecionado |
| `--om-link` | `#0e4f45` | links (sempre sublinhados) |
| `--om-lateral-fundo` | `#0f222e` | barra lateral escura |
| `--om-lateral-texto` / `-suave` | `#ffffff` / `#b9c8d1` | texto na lateral |
| `--om-verde` | `#1f6b45` | semáforo VERDE ("sem alerta") |
| `--om-vermelho` | `#8f1d1d` | semáforo VERMELHO, E1, conflito |
| `--om-pendente` | `#5c6770` | semáforo PENDENTE |
| `--om-estadio-fundo` | `#f3e8ff` | cartão de estadiamento (decorativo) |
| `--om-info-fundo` / `-texto` | `#e4f0fa` / `#174a7c` | avisos neutros |

### Contraste AA (WCAG 2.x, texto normal ≥ 4,5:1) — valores medidos

| Par (texto sobre fundo) | Razão | Veredito |
|---|---|---|
| `#232b31` sobre `#ffffff` | 14,37 | AA |
| `#4d5a63` sobre `#ffffff` | 7,10 | AA |
| `#4d5a63` sobre `#f2f5f6` | 6,48 | AA |
| `#14685c` sobre `#ffffff` | 6,64 | AA |
| `#ffffff` sobre `#14685c` | 6,64 | AA |
| `#ffffff` sobre `#0e4f45` | 9,45 | AA |
| `#ffffff` sobre `#0f222e` | 16,30 | AA |
| `#b9c8d1` sobre `#0f222e` | 9,50 | AA |
| `#1f6b45` sobre `#ffffff` | 6,47 | AA |
| `#8f1d1d` sobre `#ffffff` | 8,89 | AA |
| `#5c6770` sobre `#ffffff` | 5,79 | AA |
| `#ffffff` sobre `#1f6b45` | 6,47 | AA |
| `#ffffff` sobre `#8f1d1d` | 8,89 | AA |
| `#6b21a8` sobre `#f3e8ff` | 7,39 | AA |
| `#0e4f45` sobre `#ffffff` (links) | 9,45 | AA |

Proibido: texto `#4d5a63` sobre `--om-pendente-fundo`; qualquer texto sobre
`--om-destaque-suave` que não seja `--om-destaque-hover`; vermelho fora de
semântica clínica; roxo fora do cartão de estadiamento.

## 3. Tipografia, espaçamento, raio, sombra, movimento

- **Fonte:** pilha do sistema (`Segoe UI`, system-ui…); mono do sistema para
  hashes, horários de log e doses. Sem fonte externa.
- **Escala:** xs 12 · sm 14 · md 16 (corpo) · lg 18 (seção) · xl 20 (paciente)
  · 2xl 24 (número hero). Altura de linha 1,5 (1,35 em tabelas densas).
- **Espaçamento:** base 4px (`--om-espaco-1…8`). Ritmo vertical: 8 dentro do
  cartão, 16 entre cartões, 24 entre regiões.
- **Raio:** 6 campos/chips/botões · 8 cartões · 12 modais/gavetas/heros ·
  pílula em avatares e badges numéricos.
- **Sombra:** um nível por camada (repouso `sm`, flutuante `md`, modal `lg`).
  Sombra comunica "isto flutua"; cartão em repouso usa borda, não sombra dupla.
- **Movimento:** rápida 120ms (hover/foco/chips) · média 180ms (modal/gaveta)
  · lenta 260ms (carrossel/abas). Curva `ease-out`. Com
  `prefers-reduced-motion`, tudo vira 0ms (ver MU-10).

## 4. Vocabulário de componentes (o que os protótipos usam)

| Componente | Quando usar | Anatomia mínima |
|---|---|---|
| **Hero clínico** | topo da consulta: identidade + tumor + episódio fixos | avatar de iniciais + nome + chips de estado; cartões de diagnóstico/estádio/CID/TNM/subtipo (MU-05) |
| **Card** | um fato ou grupo com fonte | título + corpo + estado (texto+ícone); borda 1px, raio 8 |
| **Chip de escolha** | opções mutuamente exclusivas (ECOG 0–4, ciclos, filtros) | botão pílula; selecionado = fundo destaque + texto branco + `aria-pressed` |
| **Tag de evidência** | marcador vindo de fato confirmado ou regra (RECIST/CTCAE) | pílula pequena + origem no `title`; nunca texto livre da IA |
| **Badge numérico** | contadores (pendências, fila, anexos) | pílula ≤ 2 dígitos; vermelho só se houver item clínico |
| **Accordion** | detalhe que expande no lugar (antecedentes, anexos, log) | cabeçalho botão + `aria-expanded`; um aberto por grupo |
| **Modal** | foco obrigatório curto (Resumo 2, confirmar impressão) | overlay + diálogo `role=dialog` + foco preso + Esc fecha |
| **Drawer (gaveta)** | detalhe lateral sem perder contexto (biópsia, fonte) | painel direito 360–420px + overlay leve + Esc fecha |
| **Carrossel** | sequência de imagens do mesmo exame | miniaturas + anterior/próxima + contador "3/24" + tela cheia |
| **Banner E1** | emergência ativa | faixa vermelha + texto + ação; `role=alert`; nunca some sozinho |
| **Semáforo** | estado do dado | ponto + palavra (VERDE/VERMELHO/PENDENTE); ver MU-02 |
| **Avatar OncoAssist** | identidade da IA no painel e no chat | círculo com "OA" + anel de estado (ativo/ouvindo/desligado); desligado = cinza + rótulo |
| **Timeline** | longitudinalidade (consultas, exames, marcos) | trilho + nós clicáveis + data clínica (nunca data de emissão) |
| **Tabela densa** | labs, prescrição, lote APAC | cabeçalho fixo, zebrado sutil, altura 1,35, número à direita |
| **Toast** | confirmação de ação (salvo, impresso, enviado) | canto inferior, 4s, com ação "desfazer" quando couber |

## 5. Mapeamento para os tokens do app (`src/ui/tema/tokens.css`)

O Cursor mantém `tokens.css` (não editar). O destaque do modelo
(verde-petróleo) entra **num arquivo novo** `src/ui/telas/tema-oncomed.css`
que sobrescreve variáveis, sem editar o original (ADENDO-W6-W7):

| App (`tokens.css`) | Este sistema (`tokens-oncomed.css`) |
|---|---|
| `--cor-fundo` | `--om-fundo` |
| `--cor-superficie` | `--om-superficie` |
| `--cor-texto` / `-suave` | `--om-texto` / `--om-texto-suave` |
| `--cor-destaque` | `--om-destaque` (troca o azul pelo petróleo) |
| `--cor-linha` | `--om-linha` |
| `--cor-verde` / `-vermelho` / `-pendente` | idênticos (`--om-verde` etc.) |
| `--raio` | `--om-raio-md` |

## 6. Regras que o desenho nunca vence

- Sem foto do paciente: **iniciais** (ex.: "MT" para Paciente Teste 07).
- Sem badge inventado ("Ativo" e afins): só estados do contrato.
- Links de diretriz (NCCN/ESMO/INCA/PubMed/ClinicalTrials) abrem no navegador
  **sem nenhum dado do paciente na URL**.
- OncoAssist nesta onda fica **desligado** ("capacidade não habilitada"):
  botões existem, não chamam nada.
- Imprimir/enviar passam pela porta (`/acao`); nada imprime sozinho.
- Cabeçalho institucional é configuração com aviso "cabeçalho de exemplo:
  altere nas configurações"; linha do médico vem do perfil, nunca do código.
