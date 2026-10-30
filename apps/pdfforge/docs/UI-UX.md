# Lote UI/UX — Browser IA OncoGlobal

Data: 2026-10-25. Pedido: "FAÇA UI E UX". Referências consultadas: guia Chrome *Build with AI* / Modern Web Guidance
(acessibilidade, desempenho, APIs modernas da plataforma), 21st.dev (padrões "Sidebar with Browser-like Tabs",
"Apple Spotlight", "AI Chat Input") e o catálogo local 21st (9.246 itens). Os componentes 21st são Tailwind/shadcn;
o projeto usa React + CSS próprio, então os **padrões** foram reimplementados com os tokens do app (sem instalar pacotes).
A skill `modern-web-guidance` não foi instalada (instalação de skills passa pelo seu protocolo de admissão).

## Auditoria (antes)

| Gravidade | Achado | Correção |
|---|---|---|
| Alta | Página inicial era só "Abrir arquivo": o produto virou navegador de IA, mas não havia barra de busca/endereço | Página "Nova aba" com omnibox (endereço, busca na web, pergunta à IA, busca local) |
| Alta | ~40 destinos sem atalho nem busca global | Paleta de comandos `Ctrl+K` + atalhos de navegador |
| Média | Botões do topo direito empilhados (apps e tema) | `.tabbar-actions` em linha |
| Média | Vermelho em links, títulos e ações secundárias compete com a ação principal | Destaque só em ação primária e estado ativo |
| Média | Fundo preto puro, cards com pouco contraste de camada | Escala de superfícies neutra e bordas consistentes |
| Média | Barra lateral mistura ícones de traço e letras coloridas de tamanhos diferentes | Ícones 18 px alinhados e "chip" de provedor discreto |
| Média | Campo do chat espalhado (seletor largo, botão alto) | Campo único com barra de ferramentas interna |
| Baixa | Abas sem menu de contexto e sem clique do meio | Menu: fechar, fechar outras, fechar à direita, duplicar |

## Decisões de projeto

- **Identidade preservada**: tema escuro, densidade compacta, raio configurável e a cor de destaque escolhida em Aparência.
- **Plataforma moderna** (Chromium do Electron): `<dialog>` nativo na paleta (foco preso, Esc), `:focus-visible`,
  `color-mix()`, `prefers-reduced-motion`, `color-scheme`.
- **Teclado primeiro**: `Ctrl+K` paleta · `Ctrl+L` omnibox · `Ctrl+T` nova aba do navegador · `Ctrl+W` fecha aba ·
  `Ctrl+Tab`/`Ctrl+Shift+Tab` alterna · `Ctrl+1…9` vai para a aba · `Ctrl+B` recolhe a barra · `Ctrl+O` abre PDF.

## Aceite

- Omnibox: URL abre aba do navegador; texto livre oferece pesquisar na web, perguntar ao Claude e resultados locais.
- Paleta encontra telas, ferramentas, recentes, biblioteca, prompts e atalhos de apps, com setas, Enter e Esc.
- Atalhos funcionam sem conflitar com campos de texto (exceto `Ctrl+K`/`Ctrl+L`).
- Tema claro e escuro, largura de 1024 px sem rolagem horizontal, foco visível, sem regressões nos testes.
