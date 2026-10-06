# W8-MUSE · progresso (EXECUTOR = MUSE)

> Retomada: primeira fatia não FEITA. Base `f0/w1-integrado` @ 243dcae.
> Verify por fatia: `npx tsc --noEmit` + `npm run check:boundaries` +
> `npm run check:corpus` + `npx vitest run <minhas pastas>
> tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Nunca `git push`.

| Fatia | Estado | Commit | Verify (resumo) | Pendências |
|---|---|---|---|---|
| MU-01 · Sistema visual | FEITA | a8ef6a8 | tsc 0 · fronteiras 81 arq · corpus 20 arq · regressão 9/9 | – |
| MU-02 · Semântica de estado | FEITA | b5395c9 | tsc 0 · fronteiras 81 arq · corpus 20 arq · regressão 9/9 | – |
| MU-03 · Microcopy pt-BR | FEITA | 3886138 | tsc 0 · fronteiras 82 arq · corpus 20 arq · ui-copy 5/5 + regressão 9/9 | – |
| MU-04 · Ícones SVG | FEITA | b87c7b7 | tsc 0 · fronteiras 86 arq · corpus 20 arq · ui-copy 7/7 + regressão 9/9 | – |
| MU-05 · Protótipo: consulta pronta | FEITA | efc6c27 | tsc 0 · fronteiras 86 arq · corpus 20 arq · ui-copy 7/7 + regressão 9/9 · HTML balanceado · URLs sem dado | – |
| MU-06 · Protótipo: salão e agenda | FEITA | 3fc4412 | tsc 0 · fronteiras 86 arq · corpus 20 arq · ui-copy 7/7 + regressão 9/9 · HTML balanceado | – |
| MU-07 · Protótipo: APAC em bloco e laudo | FEITA | b64ba2a | tsc 0 · fronteiras 86 arq · corpus 20 arq · ui-copy 7/7 + regressão 9/9 · HTML balanceado | – |
| MU-08 · Protótipo: centro de comando | FEITA | (neste commit) | tsc 0 · fronteiras 86 arq · corpus 20 arq · ui-copy 7/7 + regressão 9/9 · HTML balanceado | – |
| MU-04 · Ícones SVG | A_FAZER | – | – | – |
| MU-05 · Protótipo: consulta pronta | A_FAZER | – | – | – |
| MU-06 · Protótipo: salão e agenda | A_FAZER | – | – | – |
| MU-07 · Protótipo: APAC em bloco e laudo | A_FAZER | – | – | – |
| MU-08 · Protótipo: centro de comando | A_FAZER | – | – | – |
| MU-09 · Impressos | A_FAZER | – | – | – |
| MU-10 · Acessibilidade e fechamento | A_FAZER | – | – | – |

## Arquivos criados

- `docs/design/SISTEMA.md` — princípios, paleta, contraste AA medido, tipografia,
  espaçamento, raio, sombra, movimento, vocabulário de componentes, mapeamento
  para `src/ui/tema/tokens.css`.
- `docs/design/tokens-oncomed.css` — variáveis CSS (+ tema contraste, foco,
  `prefers-reduced-motion`).
- `docs/design/ESTADOS.md` — como VERDE/VERMELHO/PENDENTE aparecem, conflito
  com candidatos, ausente × não descrito × não se aplica, rascunho ×
  confirmado × assinado, baixa confiança/riscado com recorte, E1, demais
  estados do contrato. Nenhum estado novo.
- `src/ui/copy/pt-BR.ts` — catálogo de microcopy (~150 chaves: botões,
  navegação, vazios, erros, confirmações, avisos legais exatos, estados,
  consulta, salão, agenda, APAC, documentos, farmácia, canal, OncoAssist,
  centro de comando, acessibilidade). Sem corte clínico, sem jargão de TI,
  sem nome próprio.
- `tests/ui-copy/copy.test.ts` — chaves únicas/camelCase, sem texto vazio,
  sem corte clínico (lista + allowlist de números), avisos exatos, sem
  jargão/nomes.
- `src/ui/icones/{Icone,navegacao,estados}.tsx` + `index.ts` — 18 ícones SVG
  próprios (11 navegação + 7 estado), traço 24, `aria-hidden`, rótulo no uso.
- `tests/ui-copy/icones.test.tsx` — 18 expostos; todos renderizam `svg` com
  `viewBox` 24, `aria-hidden` e conteúdo.
- `docs/design/prototipos/consulta.html` — Paciente Teste 07: hero clínico
  (iniciais, PENDENTE nos cartões), abas Evolução/Prescrição/Exames, accordion,
  chips de escolha ECOG (rascunho), tags com origem, 6 exames com Resumo 1,
  modal Resumo 2, gaveta da biópsia, carrossel ilustrativo, labs com coleta,
  alertas (1 conflito + 3 pendentes), diretrizes sem dado na URL, canal
  WhatsApp, OncoAssist desligado + avatar, modo Flash sem rolagem.
- `docs/design/prototipos/salao.html` — banner E1 (`role=alert`), quadro
  FRENTE/FILA DO MÉDICO/SALÃO (ordem ECOG4→ECOG3→cama→cadeira→>80, E1 como
  badge sem reordenar), triagem em accordion, progresso de infusão, chat.
- `docs/design/prototipos/agenda.html` — dia com semáforo + pendências por
  consulta, filtros por tipo, agrupamento manhã/tarde, modal remarcar,
  resumo de pendências do dia.
- `docs/design/prototipos/apac.html` — lote diário multipaciente, uma
  competência, D85 aviso, D90 fora, competência errada fora; gaveta com
  laudo oficial (SOLICITAÇÃO preenchida, AUTORIZAÇÃO em branco, PENDENTE
  destacado, SIGTAP [VERIFICAR], finalidade herdada visível).
- `docs/design/prototipos/centro-comando.html` — 6 módulos (estado, skills,
  prompt, ativar/desativar com motivo), log append-only, break-glass com
  confirmação, contagem regressiva real, volta sozinha e texto de que
  nenhuma trava é liberada.

## [VERIFICAR]

(nenhum até MU-01)

## Perguntas ao tech lead

(nenhuma até MU-01)
