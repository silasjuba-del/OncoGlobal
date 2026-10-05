# PROMPT PERSISTENTE — CURSOR · ONDA W2 · 10 FATIAS (UI da consulta, desktop v1)

> Primeiro leia e obedeça `W2-CABECALHO-COMUM.md` (integralmente). EXECUTOR = `CURSOR`.
> **Abra no Cursor a pasta:** `C:\Users\silas\Projects\OncoGlobal-wt\w2-cursor` · **Branch:** `f0/w2-cursor`
> **Seu papel:** código pesado de **interface** (React). A UI **mostra e coleta**; toda regra vem de `src/rules` (funções puras) e todo contrato de `src/contracts`. **A UI nunca calcula regra clínica, nunca decide destino, nunca monta dose.**
> **Escopo de arquivos:** `src/ui/**`, `tests/ui/**`, `index.html`, `vite.config.ts`, e `package.json` **somente na fatia CUR-01**.
> **Direção visual (R-29, decidida):** branco-gelo, superfícies claras, texto grafite, azul discreto como destaque, tipografia legível, espaçamento consistente, movimento contido. **Vermelho só para semântica clínica**; cor sempre com texto ou ícone. **A aparência é camada substituível; o significado é estável** (G-28).

---

## CUR-01 · Scaffold Vite + React + testes de UI
**Arquivos:** `package.json` (só adicionar deps `react`, `react-dom`, devDeps `vite`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`, `@types/react`, `@types/react-dom`; scripts `ui:dev`, `ui:build`), `vite.config.ts`, `index.html`, `src/ui/main.tsx`, `src/ui/App.tsx`, `tests/ui/app.test.tsx`
**Aceite:** `npm run ui:build` ok; `npm run verify` continua verde (Vitest roda `tests/ui` em jsdom via `// @vitest-environment jsdom`); App mostra "OncoGlobal — WORK" e um aviso "dados sintéticos".
**Proibido:** UI kit pesado, CSS-in-JS com runtime, estado global de terceiros. CSS puro com variáveis.

## CUR-02 · Design tokens + tema substituível + teste semântico (G-28)
**Arquivos:** `src/ui/tema/tokens.css`, `src/ui/tema/temas.ts` (claro "gelo" e alternativo "contraste"), `src/ui/tema/ThemeProvider.tsx`, `tests/ui/tema.test.tsx`
**Aceite (N26):** trocar o tema não altera o paciente ativo, o texto do escopo de "validar tudo", o autor da assinatura exibido nem a visibilidade do banner E1. Teste renderiza com os dois temas e compara um **snapshot semântico** (textos e `aria-*`), não pixels.

## CUR-03 · Cabeçalho do paciente
**Arquivos:** `src/ui/consulta/CabecalhoPaciente.tsx`, `src/ui/consulta/viewmodels.ts` (tipos de **visão**, derivados de `src/contracts`; nunca duplicar contrato), `tests/ui/cabecalho.test.tsx`
**Objetivo:** identidade · tumor/lote selecionado · episódio · linha · ciclo · **semáforo (cor + palavra)** · **completude (◐ + "N pendentes")** · contatos desde a última consulta. Com dois tumores (multitumor, K-18): seletor de lote e alergias/comorbidades **do paciente** sempre visíveis.
**Aceite:** PENDENTE nunca aparece como verde; cor sempre com texto; troca de lote não troca paciente.

## CUR-04 · Banner de emergência E1
**Arquivos:** `src/ui/consulta/BannerE1.tsx`, `tests/ui/banner-e1.test.tsx`
**Objetivo:** recebe `Alerta[]` com `presentationOverride=true`; banner fixo, **não dispensável**, com "reconhecer" (registra ciente, não some). Alvo pode ser contato não vinculado (K-08).
**Aceite:** não existe botão fechar; após "reconhecer" o banner continua visível com o horário; leitor de tela anuncia (`role="alert"`).

## CUR-05 · Painel "Desde a última consulta"
**Arquivos:** `src/ui/consulta/PainelDelta.tsx`, `tests/ui/delta.test.tsx`
**Objetivo:** mostra itens NOVO · MUDOU · PERSISTE · RESOLVEU; seta MELHOR/PIOR **só se** o item trouxer `direcao` (K-17); conflito aparece em VERMELHO com os candidatos; ausente em PENDENTE. Sem snapshot anterior (dia 1): texto "linha de base em construção".
**Aceite:** nenhum "melhorou/piorou" sem campo `direcao`; dia 1 não inventa delta.

## CUR-06 · Card de evidência com fonte
**Arquivos:** `src/ui/evidencia/CardEvidencia.tsx`, `src/ui/evidencia/GavetaFonte.tsx`, `tests/ui/evidencia.test.tsx`
**Objetivo:** cada afirmação mostra valor + estado + revisão; clique abre gaveta com a(s) `Fonte` (classe, data clínica × data de captura, localizador/página). `NAO_SE_APLICA` mostra o motivo; `CONFLITO` mostra candidatos lado a lado; `evidenceLayer` (texto do laudo × observação × inferência) rotulado.
**Aceite:** data de captura nunca aparece como data do exame; inferência sempre rotulada.

## CUR-07 · Triagem do salão (formulário + resultado)
**Dependência:** `src/rules/index.ts` (Grok). Se ausente → `BLOQUEADO_DEPENDENCIA`, faça depois.
**Arquivos:** `src/ui/salao/FormTriagem.tsx`, `src/ui/salao/ResultadoTriagem.tsx`, `tests/ui/triagem.test.tsx`
**Objetivo:** campos com unidade visível (PA sistólica mmHg; temperatura em °C, convertida para décimos **na borda**; Hb g/dL → dg/dL na borda); chama `avaliarTriagem` com o ruleset carregado; mostra destino, cortes, não-cortes, pendências e emergência. Campo vazio é permitido (vira PENDENTE). **Nunca impede salvar.**
**Aceite:** PA 161 mostra FILA_MEDICO com o motivo; 37,9 mostra corte; campo vazio aplicável mostra pendência; nenhum cálculo de regra dentro do componente.

## CUR-08 · Quadro do salão (frente, fila, salão)
**Dependência:** `ordenarFila` (Grok).
**Arquivos:** `src/ui/salao/QuadroSalao.tsx`, `tests/ui/quadro.test.tsx`
**Objetivo:** três colunas (FRENTE · FILA DO MÉDICO · SALÃO) com ordem vinda de `ordenarFila`; emergência aparece como **badge e escalonamento à parte**, sem reordenar a fila (A7); botão "liberar mesmo com corte" abre motivo obrigatório (decisão médica; a UI só coleta).
**Aceite:** ordem idêntica à função; E1 não muda posição.

## CUR-09 · Bundle e fechamento por bloco / "validar tudo"
**Arquivos:** `src/ui/consulta/Bundle.tsx`, `src/ui/consulta/BarraFechamento.tsx`, `tests/ui/fechamento.test.tsx`
**Objetivo:** lista de documentos do bundle com checkbox (pré-marcados pelo pack; o médico desmarca); "validar bloco" e **"validar tudo" sempre disponível**; com vermelho, mostra a lista de alertas que serão marcados como "ciente"; monta o payload `ConfirmarBloco` com `documentosExibidos` (só os marcados e visíveis) e `reconhecerAlertas`; **validar não imprime** (K-15); botão imprimir separado.
**Aceite:** payload passa `ConfirmarBloco.safeParse`; nunca inclui `medicoId`/`assinado`; documento não exibido nunca entra; contagem de cliques do percurso rotina ≤ 5 registrada no teste.

## CUR-10 · Calculadora de dose (exibição)
**Dependência:** `calcularDose` (Grok).
**Arquivos:** `src/ui/tratamento/CalculadoraDose.tsx`, `tests/ui/dose.test.tsx`
**Objetivo:** mostra a dose administrada no ciclo anterior (base, Q29), botões −20/−30/−40, resultado de `calcularDose`, **origem do peso sempre visível** (MEDIDO · ANTERIOR · INFORMADO PELO PACIENTE) e o contador de ciclos sem peso; peso informado mostra "diferença incerta — confirme".
**Aceite:** nenhum cálculo no componente; sem base → "PENDENTE"; reduções fora da lista não existem na UI.
