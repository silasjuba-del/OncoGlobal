# F1 · Árvore do corpus (D-F1-06) e biblioteca × alerta (D-F1-05)

Decisões do Dr. Silas em 2026-10-11. Este documento é a referência da migração. Nenhum arquivo mudou de lugar ainda.

## Regra da biblioteca (D-F1-05)

- **Biblioteca (consulta):** todo item redigido com fonte aparece na página do tema, para o médico consultar. Não dispara alerta. Item ainda não curado aparece marcado "não curado".
- **Alerta (motor):** só gera vermelho ou pendente na tela do tema o item com `alerta: true`, e esse campo só liga com a aprovação do Dr. Silas, item a item.
- O campo único `ativo` se divide em `consultavel` e `alerta`. A Flash continua sem semáforo (D-F1-01).
- O volume de dados não pesa no código: o motor é genérico e lê qualquer quantidade de itens.

## Árvore

```
corpus/
├── 1-exames/
│   ├── catalogo/                (exames-sigtap.v1.json: 141 itens, D-F1-02)
│   ├── labs/                    (limiares, regras de unidade, labs por ciclo)
│   ├── rads/                    (pedido de imagem + resumo do caso para o radiologista, D-F1-04; leitura de laudo)
│   ├── path/                    (anatomopatológico, IHQ, biomarcadores)
│   └── endoscopicos/            (EDA, colonoscopia, broncoscopia, cistoscopia)
├── 2-receitas/
│   ├── simples/                 (sintomáticos, antiemese, dor, constipação)
│   ├── especiais/
│   │   ├── cardio/
│   │   ├── nefro/
│   │   ├── infecciosas/
│   │   └── endocrino/
│   └── classes/                 (lista por classe farmacológica)
├── 3-laudos/
│   ├── inss/                    (perícia)
│   ├── afastamento/
│   ├── loas/
│   ├── transporte/              (TFD e passe livre)
│   ├── judicializacao-drogas/
│   ├── fraldas/
│   ├── fgts/
│   ├── nutricao/                (dieta enteral e suplemento)
│   ├── oxigenio/
│   └── incapacidade/
├── 4-interacoes-contraindicacoes/
├── 5-ctcae-acao/                (grau CTCAE 6 + conduta por classe de droga × grau)
├── 6-pack-tumor/
│   ├── mama/
│   ├── prostata/
│   ├── pulmao/
│   ├── colorretal/
│   └── gastrico/
├── 7-orientacoes/
│   ├── dieta/                   (geral, por tumor, por toxicidade)
│   ├── atividade-fisica/
│   └── sinais-alarme/
└── 8-encaminhamentos/
    ├── mastologia/
    ├── cirurgia-oncologica/
    └── radioterapia/

Infraestrutura (fica onde está; não é biblioteca clínica):
fichas/  rulesets/ (motor)  prompts/  glossario/  regulatorio/  f0c/sigtap/  clusters/  matriz/
```

## De onde vem o que já existe

| Hoje | Vai para |
|---|---|
| `exames/exames-sigtap.v1.json` | `1-exames/catalogo/` |
| `rulesets/lab-thresholds.v1.json`, `dedupe-exame.v1.json` | `1-exames/labs/` (o motor continua lendo pelo loader) |
| `rulesets/rads-*.json`, `rad-emergencia.v1.json`, `templates/pedido-exame.v1.json` | `1-exames/rads/` |
| `rulesets/patologia-agregacao.v1.json` | `1-exames/path/` |
| `receitas/comuns.v1.json`, `templates/receita.v1.json`, `templates/kit/receita-sintomaticos.v1.json` | `2-receitas/simples/` |
| `regulatorio/medicamentos-controlados.v1.json` | `2-receitas/classes/` (referência) |
| `templates/kit/relatorio-pericial.v1.json` | `3-laudos/inss/` |
| `templates/laudo-judicial.v1.json` | `3-laudos/judicializacao-drogas/` |
| `templates/kit/apac-laudo.v1.json` | fica em `regulatorio/` (APAC não é laudo social) |
| `rulesets/interacoes.v1.json`, `f0c/condicionais.v1.json`, `f0c/classes-farmacos.v1.json` | `4-interacoes-contraindicacoes/` |
| `rulesets/salao-ctcae.v1.json`, `receitas/toxicidade.v1.json` | `5-ctcae-acao/` |
| `packs/*.v1.json` (mama, colorretal, próstata, pulmão) | `6-pack-tumor/` (+ gástrico, novo) |
| `templates/kit/orientacao-nutricional.v1.json` | `7-orientacoes/dieta/` |
| `templates/sinais-alarme.v1.json`, `templates/kit/sinais-alarme.v1.json`, `redflags/sinais-alarme.v1.json` | `7-orientacoes/sinais-alarme/` |

## Regras de migração

1. A migração é tarefa do Codex: mudar o loader e os caminhos com `git mv`, para preservar o histórico. Nenhum conteúdo clínico muda.
2. O validador do corpus e a suíte inteira continuam verdes. Os IDs não mudam.
3. Pasta nova sem arquivo leva só um `README.md` dizendo o que vai ali.
4. Conteúdo novo entra como `RASCUNHO`, com `consultavel: true` e `alerta: false`, e só é promovido com a aprovação do Dr. Silas.
