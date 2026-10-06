# ragGRAFO/oncologia · grafo de conhecimento das aulas PRO 2026

Fonte: `C:\Users\silas\.aside\u\0\sessions\2026-10-06_0ihhrP1OmLV0syHe\artifacts\slides-pro-2026` (10 módulos, 96 aulas). Extraído em 2026-10-06. **Todo nó = NAO_VERIFICADO** (material de aula, não evidência primária). Esquema: `ESQUEMA.md`.

## Grafo consolidado (`dados/`)
**2.746 nós · 8.024 arestas · 0 arestas órfãs.**
Nós: 803 regimes · 737 trials · 312 fármacos · 286 cenários · 157 diagnósticos · 106 estadiamentos · 104 biomarcadores · 73 tumores · 46 temas · 26 achados · 96 fontes (aulas).
Arestas: FONTE 2.981 · USA_FARMACO 1.665 · TRATA_COM 908 · TESTOU 801 · SUSTENTADO_POR 757 · TEM_CENARIO 295 · EXIGE_BIOMARCADOR 230 · DIAGNOSTICA_POR 160 · ESTADIA_POR 106 · MANEJA 94 · ALERTA 27.
Fusão entre módulos: mesmo id = um nó com lista `fontes` (216 fármacos, 23 biomarcadores, 4 trials, 1 regime). Resultado do trial unificado no campo `status_resultado` (os módulos usaram status_trial/status_estudo).

| Módulo | Nós | Arestas |
|---|---|---|
| 01 introdução | 3 | 2 |
| 02 gastrointestinal | 698 | 2.001 |
| 03 ginecológico | 305 | 861 |
| 04 mama | 278 | 890 |
| 05 pulmão | 355 | 941 |
| 06 cabeça e pescoço | 177 | 435 |
| 07 genitourinário | 364 | 959 |
| 08 diversos | 326 | 813 |
| 09 onco-hematologia | 288 | 750 |
| 10 temas gerais | 196 | 373 |

## Cuidados (detalhe em cada `modulos/*/RESUMO.md`)
- GI: correções da avaliação aplicadas (TOPGEAR, TRIBE, INT-0116, FOENIX, RADIANT-4; valor da lâmina em `aula_literal`); atualizações externas marcadas (CheckMate 577, MATTERHORN, EMERALD-1, LEAP-012, 9DW, CARES-310). Sem aula de GIST no módulo 2 (GIST está no 08).
- Divergências aula × tabelas de desfechos registradas em `trial.obs` (ex.: LITESPARK-005, TALAPRO-2, DUO-E, PAOLA-1); a própria aula se contradiz em OlympiAD/EMBRACA (duas páginas).
- Cirurgia/RT/TACE/HIPEC só como observação de cenário (esquema modela regimes com fármaco).
- HR/IC lidos de gráfico e números ambíguos estão sinalizados ou omitidos; conferir pela página.
- Ausentes nas aulas: tireoide/NET/CUP no 08; AJCC 9 de orofaringe.
