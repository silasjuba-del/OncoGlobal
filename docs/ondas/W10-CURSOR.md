# W10-CURSOR · 14 FATIAS · Porte do OncoChart (tela moderna) + Configurações + caixa única + triagem/agenda/salão

> Leia primeiro `docs/ondas/W10-COMUM.md` (inteiro). Depois `docs/design/oncochart/README.md` (especificação pixel a pixel), `docs/design/oncochart/DECISAO-UI-ALVO.md` (**ajustes obrigatórios — prevalecem sobre o desenho**), `docs/referencias/ui-modelos/PADROES-UI.md`, `docs/design/SISTEMA.md`, `src/ui/copy/pt-BR.ts`, `src/ui/icones/`.
> EXECUTOR = `CURSOR`. Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w10-cursor` · branch `f0/w10-cursor`.
> **Faixa:** `src/ui/**` **exceto** `src/ui/copy/**` e `src/ui/icones/**` (são da equipe interna: peça chaves de texto e ícones em PEDIDOS); `tests/{ui,ui-telas}/**`, `tests/w10-cursor/**`; `docs/progresso/W10-CURSOR.md`, `docs/w10/PEDIDOS-CURSOR.md`.
> **Decisão de produto (D-W9-35/40):** o **OncoChart é a UI-alvo**. Recrie-o em **React 19 + TypeScript + Vite do projeto** (não copie os `.jsx` com Babel/CDN; fontes Geist empacotadas localmente via CSS `@font-face` com arquivos dentro de `src/ui` — se exigir dependência, PEDIDOS). Tema **NOITE** = paleta oklch do desenho; **DIA** derivado dele; tokens da Muse (`docs/design/tokens-oncomed.css`) garantem contraste AA. **Frontend é extensão do backend:** a tela só mostra e coleta; nenhuma regra clínica em componente React (tudo via `src/ui/api` → regras/servidor). Enquanto a rota real não existir, use a porta fake (`src/ui/api/fake.ts`) com Paciente Teste sintético atrás da **mesma interface**.
> **Critérios do Dr. Silas:** menos cliques, consulta mais curta, comando → tela pronta → 1 clique validar; médico no centro; administração mínima; **tudo editável, nada fixo; cada caixa tem número** (D-W9-17).

## CURSOR-01 · Fundação do layout OncoChart
Canvas de referência 1680×1000 com escala responsiva (ou layout responsivo nas mesmas proporções); grade **Rail 58 px · Main · Side 396 px**; Topbar (breadcrumb, busca `Ctrl K` → paleta de comandos, alternância DIA/NOITE com revelação circular respeitando `prefers-reduced-motion`, alertas, usuário). Tokens oklch como CSS variables; motion `--ease`/`--spring`. Integra o `App.tsx` atual (APP-WIRING já aplicado) sem quebrar Agenda/Salão/Canal/APAC existentes. Testes de render e de troca de tema.

## CURSOR-02 · PatientHeader + cartão de cadastro (Modelo 08)
Avatar, nome, chips (diagnóstico, **alergia em destaque**, ECOG, biomarcadores com fonte), card de diagnóstico (CID, TNM com prefixo e edição, estádio, ECOG), botão **Consulta Flash**. Barra lateral/painel com os campos do cartão de cadastro na ordem do Modelo 08 (Matrícula = CNS quando iguais; idade "NN anos e N meses" calculada; "SEM INFORMACAO" = PENDENTE). Alergia ausente ≠ "nega alergias" (PENDENTE).

## CURSOR-03 · Timeline 2D + "Ver em 3D"
Lanes (Diagnóstico, Imagem, Sistêmico, Cirurgia·RT), eixo de meses, eventos/ciclos/miniaturas com hover, marcador **HOJE**, chip do ciclo, botão **Ver em 3D**. Dados da projeção longitudinal (Fugu) via `src/ui/api`; estados futuros tracejados. `stageHistory` mostrado como histórico (nunca sobrescreve).

## CURSOR-04 · Abas e cards da Visão geral
Abas Visão geral · Quimioterapia (Cn) · Dados clínicos · Evolução (indicador deslizante). Cards: Protocolos ativos, Documentos recentes (**área de soltar PDF/Word = caixa única**, D-W9-18), Estadiamento e avaliações (TNM/RECIST/ECOG/CTCAE — "não preenchido" = PENDENTE), Rascunho de evolução (editável, salva rascunho sem bloquear).

## CURSOR-05 · Caixa única + caixa de revisão (UI do pipeline do Fugu)
Colar texto ou soltar arquivo → mostra o que foi para cada caixa numerada, o que ficou PENDENTE e as **exceções** no formato "✓ N fatos reconciliados · ⚠ K precisam confirmação". Cada exceção: valor, fonte com trecho clicável (abre a origem), ações confirmar/corrigir/descartar/ligar ao paciente. **Junção de paciente nunca automática** (D-W9-34a): segmento sem paciente aparece com candidatos ordenados e exige clique.

## CURSOR-06 · Painel lateral: Exame selecionado + OncoBoard + fila
Exame selecionado (Resumo · Laudo · Imagens); **OncoBoard** (a fazer / em discussão / concluído); agenda/gráficos/KPIs; fila com "Chamar próximo". E1 aparece como **badge sem reordenar** a fila (A7).

## CURSOR-07 · Visualizador de imagem + OncoAssist explicando (D-W9-40)
ImageViewer com o laudo ao lado; o **OncoAssist narra o laudo e os achados já extraídos** (trecho-fonte clicável), sem diagnosticar, sem medir, sem recomendar conduta. Alertas RADS (catálogo de 30 emergências, regra do Grok) aparecem como chips VERMELHO com trecho do laudo. Voz (Web Speech pt-BR) só local, opcional, desligável. Morfometria (D-W9-57, skill SNC v4.0.0): o médico marca extremos/contorno; a função de cálculo (equipe interna) devolve a medida com modo (VISUAL / 2D_CALIBRADO / 3D_GEOMETRICO), calibração, incerteza ou "não quantificada", e a assinatura **REVIEW_REQUIRED — confirmar a medida e o contorno em DICOM nativo, com revisão médica.** Sem calibração válida = MEDIDA_METRICA_NAO_DISPONIVEL; nunca alimenta RECIST; sem diferencial diagnóstico na tela.

## CURSOR-08 · Jornada 3D + Chart3D
Recrie `journey3d`, `chart3d` e `avatar` do desenho em **CSS 3D** (preserve-3d; ≤ 200 caixas; sem react-three-fiber nesta onda). Dados reais da timeline. Chart3D em dois modos: **RECIST 1.1** (lesões-alvo confirmadas pelo médico; limiar −30% RP) e **skyline de toxicidade em CTCAE v6** (só graus confirmados; ausente = sem caixa, nunca 0). Dicas do OncoFab **sem conduta** ("trocar antes da HT" é proibido; vira "interação apontada: <fonte>"). "C11 liberado" só após validação humana dos portões. Teclado (← → espaço Esc) e `prefers-reduced-motion`.

## CURSOR-09 · Dock e overlays
Dock flutuante: mic · Novo registro · Solicitar exame · Ciclo QT · Tumor-pack · Trials · Jornada 3D · Encerrar·WhatsApp (envio externo continua desligado até vínculo + consentimento: mostra texto amigável para `CANAL_EXTERNO_NAO_HABILITADO`). Overlays: Interações (semáforo FN-16 como **achado**), Liberação QT (portões do salão/bula com motivo, sem bloquear salvar), Dx/CID versionado, paleta de comandos.

## CURSOR-10 · Prescrição (UI dos 3 produtos, D-W9-45/47)
(1) **Antineoplásica** a partir do protocolo/ciclo no layout do Modelo 05 (Dose Prot × Dose Presc × Diluente × Via × PRE-QT/QT/POS-QT × Tempo × Dias), mostrando **só as exceções** do ciclo; ajuste só pelos botões **−20/−30/−40** com motivo; diluente/tempo herdados com "ALTERAR PADRÃO → motivo". (2) **Receita pós-QT/VO** com entrada de **uma linha** (`ONDANSETRONA 8 MG VO 8/8H SN NÁUSEA`) e estrutura discreta editável (parser é da equipe interna). (3) **EV avulsa**. Classes PRÉ-QT · QT · PÓS-QT · NÃO ONCOLÓGICAS visíveis. Nada de dose calculada no componente (vem da função).

## CURSOR-11 · Configurações + caixa de número + glossário (D-W9-16/17)
Uma tela: telefone, CRM, hospital, CNES (exemplo editável 2605473), CNS, sites externos, sincronizar telefone, impressora/rede, skills, plugins, MCP (externos nascem **desligados**), layout **DIA | NOITE | PERSONALIZAR**, painel interno de "esteira de UI" (versão em uso de cada tela; padrão do `PADROES-UI.md` §4). **Caixa de número:** digita nº + dado, mostra nome e valor antigo, 1 clique salva (vira evento versionado). **Glossário** pesquisável das caixas; clicar numa caixa em qualquer tela mostra o nº.

## CURSOR-12 · Triagem do salão + agenda de QT (padrões dos HTMLs)
Triagem em 5 passos (Identificação → Sinais → Lab → ECOG → CTCAE) com botão que diz o destino ("Próximo: Laboratorial →"), alerta embaixo do campo enquanto digita (resultado vem da regra do Grok: corte do salão D-W9-37/38), ECOG em cartões de um toque, resumo final copiável/imprimível; **nunca trava avanço** por campo vazio (vira PENDENTE). Agenda: grade de poltronas por hora, arrastar sessão, 1 clique abre status (5 estados), geração por 1º dia + nº de ciclos, visão farmácia, aviso LGPD; regras ≥ 5 h até 12h e 5 inícios/30 min mostradas como alerta.

## CURSOR-13 · Acessibilidade e desempenho
Foco visível, rótulos, ordem de tabulação, contraste AA nos dois temas, cor nunca é o único sinal (ícone + texto), alvo de toque ≥ 44 px no Dock, `prefers-reduced-motion` desliga 3D/typewriter. Orçamento: primeira pintura da consulta sem a Jornada 3D (carregar sob demanda).

## CURSOR-14 · Percursos e fechamento
Testes de percurso: (a) consulta de rotina — abrir paciente → revisar exceções → validar em ≤ 5 cliques; (b) colar laudo sintético PT08 → alerta RADS hidronefrose → ver trecho; (c) prescrição pós-QT de uma linha → impressão. Relatório `docs/progresso/W10-CURSOR.md` com capturas (se houver navegador), PEDIDOS (chaves de copy/ícones, rotas de servidor, contratos) e `[VERIFICAR]`.
