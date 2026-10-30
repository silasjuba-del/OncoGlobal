# Como adicionar uma ferramenta

Toda ferramenta é um `ToolDef` em `src/tools/catalog.ts`. A interface (tile, aba, cartões de arquivo,
formulário de opções, progresso, resultado, histórico, encadeamento) é gerada a partir dele.

## 1. Operação

- Sem DOM (só pdf-lib): função pura em `src/engine/ops.ts` → `(input: InputFile, opts) => Promise<OutputFile[]>`.
  Escreva o teste em `tests/engine.test.ts`.
- Com canvas/pdf.js/OCR: função em `src/engine/render.ts`. Renderize com `renderPage()` (usa `intent: 'print'`,
  que não depende de `requestAnimationFrame` e não congela com a janela minimizada).
- Erros para o usuário: `throw new ToolError('mensagem em português')`. Outros erros aparecem como "Erro inesperado".
- Use `loadPdf(input)`: já trata senha de proprietário vazia e senha informada no cartão do arquivo.

## 2. Registro

```ts
{
  id: 'grayscale',
  name: 'PDF em tons de cinza',
  category: 'Editar PDF',
  glyph: 'B/W',
  color: '#A35FC9',
  actionText: 'Converter',
  description: 'Remove cores para impressão econômica.',
  accepts: 'pdf',          // 'pdf' | 'image' | 'office' | 'none'
  multiple: true,          // aceita vários arquivos
  status: 'ready',         // 'planned' mostra "Em breve" + plannedReason
  defaults: { dpi: 150 },
  fields: [
    { key: 'dpi', label: 'Resolução', type: 'segmented',
      options: [{ value: '96', label: '96' }, { value: '150', label: '150' }] },
  ],
  run: (files, o, ctx) => perFile(files, ctx, (f, c) => grayscalePdf(f, Number(o.dpi), c)),
}
```

Tipos de campo: `select`, `segmented`, `number` (com `unit`), `slider` (com `format`), `text`, `password`,
`color`, `checkbox`; todos aceitam `help` e `showIf(options)`. Para UI especializada, use `custom`
(exemplo: `OrganizeEditor`).

## 3. Verificação mínima

```bash
npm test
```

```bash
npm run build
```

Depois, `npm run dev`, execute a ferramenta com um PDF real e confira o resultado no visualizador.
