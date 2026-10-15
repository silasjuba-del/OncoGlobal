# PEDIDOS · ANTIGRAVITY (W8)

## 1. Fronteiras de importação em `src/rules/` (`scripts/check-boundaries.mjs`)
- **Situação:** A regra em `scripts/check-boundaries.mjs` linha 9 é:
  `{ from: "src/rules/", forbid: ["src/"], allow: ["src/contracts/"], why: "funções puras: só contratos (corpus injetado)" }`
  Isso proíbe qualquer arquivo em `src/rules/` de importar outro arquivo em `src/rules/` (inclusive dentro de `src/rules/w8/`).
- **Impacto no W8:** A especificação `W8-ANTIGRAVITY.md` previa `só importa src/contracts e arquivos de src/rules/w8/`. Para não violar as fronteiras existentes nem editar arquivos restritos, cada arquivo de regra em `src/rules/w8/` foi mantido autônomo, importando estritamente de `src/contracts/`.
- **Pedido futuro:** Se o Tech Lead desejar que módulos de `src/rules/` possam importar tipos compartilhados locais dentro de sua própria pasta, sugere-se incluir `sameDirOk: true` ou `allow: ["src/contracts/", "src/rules/w8/"]` na regra de fronteiras.
