# Harness B2 — reprodução com Playwright

O harness `tests/f1/s12/browser-b2.js` usa Playwright/Chromium para exercitar seis
famílias de prescrição com dados sintéticos. Não usa DeepSeek nem o orquestrador
DeepSeek Harness (dsh).

## Execução local

Com Node.js 24 ou superior, na raiz deste checkout:

```sh
npm ci
npx --no-install playwright install chromium
npm run test:b2
```

O pacote Playwright está fixado em `1.64.1` no manifesto e no lockfile. O Chromium
é instalado separadamente pelo comando acima. No Linux, use
`npx --no-install playwright install --with-deps chromium` para instalar também as
bibliotecas de sistema. O job `Jornadas B2 no Chromium` executa esses passos no CI.

## Evidências e alcance

O harness cria banco SQLite e evidências em diretórios temporários exclusivos.
O caminho `s12-b2-evidence-*` aparece na saída e contém log, capturas e, quando a
execução conclui, `resumo.json`. O CI publica essa pasta como artefato por sete dias.
Esses arquivos não devem ser incluídos em commits.

São verificados: recusa visível de ficha `RASCUNHO`, cálculo após promoção apenas
em memória da fixture, identidade/versão/hash da ficha recebida, preservação das
pendências e reabertura das propostas efetivamente salvas após reinício com o
mesmo SQLite. A jornada de navegador verifica ausência de requisições externas.

As seis famílias são Ewing VDC/IE, MAP, CUP carbo-paclitaxel/AUC, LV5FU2,
NTG metotrexato/ácido folínico e cemiplimabe. Uma proposta com pendências deve
permanecer bloqueada; seis famílias exercitadas não significam seis propostas
salvas. O histórico de documentos assinados pode continuar vazio: esta prova
cobre rascunhos/propostas e não comprova assinatura de QT em produção.

## Validação local em 2026-10-18

Em checkout isolado, após `npm ci`, com Windows e Node.js 24.15.0:

- `npm run test:b2`: exit 0; seis recusas visíveis e trilhas conferidas.
- Ewing, MAP e CUP mantiveram as pendências e a proposta bloqueada; LV5FU2,
  NTG MTX/FA e cemiplimabe salvaram propostas. As três reabriram com a mesma
  identidade, versão e hash após reiniciar o servidor com o mesmo SQLite.
- Zero requisições externas observadas na jornada; histórico assinado vazio.
- Typecheck, fronteiras (zero exceções), corpus (241 arquivos) e 22 testes em
  quatro arquivos de proveniência/segurança B2 passaram.

O harness e a fixture existentes foram executados sem alteração de critérios.
