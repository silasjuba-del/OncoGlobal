# PADRÕES DE UI · modelos de referência (Triagem QT, Agenda QT, Esteira Operacional)

> Fonte: leitura integral (somente leitura) de `Triagem_QT_v20.html`, `agenda_qt_1.html` e
> `Esteira-Operacional-Skills-Pipeline.html`, nesta pasta. Data: 2026-10-06.
> Instrução do Dr. Silas: **modelo triagem = modelo QT; não valorizar arquitetura; pegar os padrões;
> não é ONCOMED → esteira interna de UI para trocar interface.**
> Este documento **não adota nada**: lista padrões e regras para decisão posterior. Onde houver conflito
> com o que já foi decidido no app (semáforo VERDE/VERMELHO/PENDENTE sem amarelo, teto de 5 estados,
> alerta sem bloquear, dois portões de triagem, E1 = badge sem reordenar, 1 clique para validar),
> **vale o app**.
> Renderização: não foi aberta no navegador. A Esteira faz `@import` de Google Fonts (requisição externa);
> como a leitura do código foi suficiente, nada foi enviado a sites externos.

---

## 1. Por arquivo

### 1.1 `Triagem_QT_v20.html` — triagem de enfermagem pré-QT

**O que faz.** App de uma coluna (máx. 620 px, pensado para celular/tablet da enfermagem) que conduz a
avaliação pré-quimioterapia em 5 etapas lineares — Identificação → Sinais vitais → Laboratório → ECOG →
Toxicidade CTCAE — e termina numa tela de Conclusão com resumo automático de alertas. A enfermeira escolhe
uma conclusão (4 opções), registra, e o resultado vira um documento texto para imprimir ou copiar.
Mantém um histórico local com chips coloridos por parâmetro e um banner global quando há alerta vermelho
pendente. Nota legal repetida: a liberação final é do médico.

**Telas / seções / campos**
| Tela | Conteúdo |
|---|---|
| Home | Cartão "Nova Triagem" (5 etapas), cartão "Histórico" com contador, alerta urgente pendente (lista nomes), caixa "Critérios mínimos para QT", aviso legal. |
| S1 Identificação | Nome*, Nº do ciclo* (ex.: C3D1), Protocolo, Data, Hora (pré-preenchidas), Enfermeira responsável. |
| S2 Sinais vitais | PAS*, PAD*, FC, FR, Temperatura*, SpO₂*, Peso, Altura → SC Mosteller calculada ao vivo. |
| S3 Laboratório | Hgb, Leucócitos, Neutrófilos, Plaquetas (com microalerta sob o campo), Creatinina, TGO, TGP, Glicemia; caixa "mínimos habituais". |
| S4 ECOG | 5 cartões selecionáveis (0–4) com ícone + descrição; um toque seleciona. |
| S5 CTCAE v5.0 | 8 itens (náusea, vômito, diarreia, mucosite, fadiga, neuropatia, mão-pé, pele), cada um com régua G0–G4 e descrição dos graus. |
| Conclusão | "Resumo dos alertas" automático + 4 opções (LIBERAR / ADIAR / ATENÇÃO / CONTRAINDICADO) + Observações + nota legal. |
| Ver | Ícone e cor da conclusão, grade 2×4 de valores-chave, CTCAE ≥G1, obs., SC; botões Imprimir / Copiar / Histórico / Nova. |
| Histórico | Lista com nome, status-pílula, protocolo·ciclo·data, enfermeira, chips (Temp, SpO₂, N, PLT, ECOG) coloridos se fora do limite; "Limpar" com confirmação. |

**Estados.** Etapa: feita (verde) / ativa (dourado) / futura (cinza). Nível calculado: `verd` / `amar` / `verm`.
Conclusão: liberar (verde) / adiar (âmbar) / atenção (azul-petróleo) / contra (vermelho). Registro: `pendente`.

**Interações.** Barra de progresso de 5 traços com rótulos curtos; botões "← Voltar" (fantasma) e
"Próximo: <nome da etapa> →" (dourado, largura cheia) — o rótulo do botão diz para onde vai. Validação
ao avançar com *toast* âmbar de 2,5 s no topo. Alertas inline recalculados a cada digitação nos campos
críticos. Seleção por cartão (ECOG, conclusão) com ✓ à direita. Régua segmentada G0–G4 com cor por grau.
Banner global vermelho pulsante clicável ("toque para ver"). Ícones casa/histórico no topo como atalhos.
Botão desabilitado até haver escolha (ECOG, conclusão). CSS de impressão dedicado. **Não há atalhos de teclado.**

**Microcopy notável.** "Próximo: Sinais Vitais →" (CTA nomeia o destino) · "Toque para ver" · "Sem alertas
identificados" · "Valores limítrofes — revisar com médico" · "Médico pode autorizar ou adiar o ciclo" ·
nota legal "a liberação final … é de responsabilidade exclusiva do médico plantonista" · descrições CTCAE
compactas por grau ("G1: 1-2×/dia · G2: 3-5×/dia …").

### 1.2 `agenda_qt_1.html` — agenda de quimioterapia por poltrona

**O que faz.** Agenda de salão com 13 poltronas, 08:00–18:00, em 5 abas (Agenda, Pacientes, Regimes,
Farmácia, Ajustes). O cadastro de paciente + regime + D1 + nº de ciclos **gera todas as sessões** do
tratamento automaticamente, respeitando dias consecutivos, fins de semana/feriados, tratamentos longos
de manhã e limite de inícios simultâneos. O "Mapa do dia" é uma grade poltrona × hora (Gantt) com
arrastar-e-soltar; há visão de farmácia que agrupa preparos por regime e uma agenda em texto copiável.

**Telas / seções / campos**
| Aba | Conteúdo |
|---|---|
| Agenda | Data + ◀ Anterior / Próximo ▶, "Otimizar dia", "Copiar agenda", Imprimir; 3 KPIs (sessões, ocupação %, regimes agrupados); legenda de cores dos regimes do dia; grade 13 linhas × 10 colunas-hora; textarea com agenda em texto. |
| Pacientes | Nome, Regime (select), D1, Nº de ciclos, Preferência (Automático/Manhã/Tarde); aviso LGPD; tabela de ativos (paciente, regime, sessões, próxima = data·hora·poltrona, remover). |
| Regimes | Catálogo (19 de fábrica) com cor, frequência, dias do ciclo, tempo 1ª sessão, tempo manutenção, compartilhável; formulário de edição; "Restaurar catálogo padrão". |
| Farmácia | Data; KPIs (preparos, regimes agrupáveis); grupos por regime com tabela (paciente, início, poltrona, ciclo) e nota de agrupamento. |
| Ajustes | Backup exportar/importar JSON; "Máximo de inícios a cada 30 min"; feriados/bloqueios como pílulas removíveis. |

**Estados da sessão (5).** agendado · confirmado · faltou · remarcado · cancelado. Faltou/cancelado ficam
esmaecidos e riscados no Gantt; os demais mostram a inicial do status no bloco.

**Interações.** Abas no cabeçalho (ativa = petróleo com borda dourada). Bloco do Gantt: posição/largura
proporcionais ao horário/duração, cor do regime, ★ se droga compartilhável; **arrastar** muda poltrona/hora
(encaixe de 15 min, trilho destacado com borda tracejada dourada); **clicar** abre `<dialog>` modal com
dados + select de status + Salvar/Remover/Fechar. Mensagens de sucesso em caixa verde ("✔ … sessões
agendadas. N não couberam"). Confirmações nativas para ações destrutivas. Fonte grande (17–18 px,
negrito em campos) — legibilidade de salão. **Não há atalhos de teclado.**

**Microcopy notável.** "agenda segura, ciclos corretos e menor desperdício" · "💡 Arraste um bloco para
mudar de poltrona/horário. Clique para ver detalhes…" · aviso LGPD "registre apenas nome + protocolo +
data + horário" · farmácia: "Este painel é apoio operacional. A decisão de preparar é da farmácia" e
"O app apenas sinaliza" · "Obs.: confirmar presença/liberação antes do preparo pela farmácia" · erros
de encaixe diretos ("Conflito: poltrona ocupada nesse horário.").

### 1.3 `Esteira-Operacional-Skills-Pipeline.html` — esteira interna (não clínica)

**O que faz.** Página única (bundle React + Tailwind) que mostra um **pipeline sequencial de 5 etapas**
("Projeto Imersivo"): Design DNA → Sistema visual/MASTER.md → Cena 3D → Timeline/scroll → Motion/export.
Cada etapa é um cartão com número, papel, descrição, **INPUT → OUTPUT**, "prompt exemplo" e comando de
instalação copiável. Uma barra superior "Instalação rápida" lista as etapas como chips com copiar
individual e "COPIAR TUDO". Não é produto clínico; é o modelo de **painel interno de esteira de UI**.

**Seções.** Selo "ESTEIRA OPERACIONAL" + versão/contagem ("v1.0 • 5 SKILLS"); título + subtítulo;
indicador de prontidão com ponto pulsante; barra de chips; grade de 5 cartões (1/2/5 colunas conforme
largura) ligados por setas; rodapé com regra do fluxo.

**Estados.** Etapa ativa (hover ou foco no chip: borda/brilho na cor da etapa, filete inferior colorido) vs
inativa; botão copiar: ícone copiar → ✓ por 2 s.

**Interações.** Passar o mouse num chip **ou** num cartão sincroniza a etapa ativa nos dois lugares;
copiar com retorno visual; setas entre cartões (horizontais no desktop, verticais giradas no mobile).
Tema escuro/bege, grade sutil de fundo, tipografia Inter + mono. Sem teclado, sem persistência.

**Microcopy notável.** "Cada skill entrega insumo para a próxima etapa." · rodapé "FLUXO SEQUENCIAL •
NÃO PULE ETAPAS • CADA SAÍDA ALIMENTA A PRÓXIMA" · rótulos curtos em caixa alta (INPUT, OUTPUT, PROMPT
EXEMPLO).

---

## 2. Padrões reaproveitáveis

1. **Etapas com trilho de progresso** · traços horizontais feito/ativo/futuro com rótulo curto (Ident.,
   Sinais, Lab, ECOG, CTCAE) · **Salão/Triagem** (triagem do ciclo), **esteira interna**. No app, as
   etapas não podem travar avanço (ver §3) — trilho informa, não bloqueia.
2. **CTA que nomeia o destino** · "Próximo: Laboratorial →" em vez de "Avançar" · **Salão/Triagem**,
   **Consulta**, **Configurações**.
3. **Alerta inline ao vivo sob o campo** · microlinha colorida abaixo do valor ("Abaixo do limite —
   comunicar médico") recalculada ao digitar · **Salão/Triagem**, **Consulta** (labs). Mapear só para
   VERMELHO (fora do portão) / VERDE (dentro) / PENDENTE (vazio).
4. **Resumo automático de alertas antes de concluir** · lista ícone + parâmetro + valor só do que está
   fora; "Sem alertas identificados" quando vazio · **Salão/Triagem** (antes do 1 clique de validar),
   **Consulta**.
5. **Seleção por cartão grande com ✓** · ECOG 0–4 com ícone e descrição de uma linha; um toque escolhe e
   já confirma · **Salão/Triagem**, **Consulta** (ECOG).
6. **Régua segmentada de grau (G0–G4)** · 5 botões contíguos, padrão G0, descrição dos graus acima ·
   **Salão/Triagem** (toxicidade), **Consulta**. Cor por grau precisa ser reduzida ao semáforo do app.
7. **Cálculo derivado instantâneo** · SC (Mosteller) aparece assim que peso e altura existem ·
   **Salão/Triagem**, **Consulta**.
8. **Banner global de pendência crítica** · faixa fixa no topo com contagem e 1º nome, clicável para a
   lista · **Salão** (fila do médico), **Agenda**. Sem pulsar contínuo (fadiga visual); sem reordenar
   fila (E1 = badge).
9. **Histórico com chips de parâmetro coloridos** · cada linha mostra 4–5 valores-chave, coloridos só
   quando fora do limite · **Salão/Triagem**, **Consulta** (linha do tempo do paciente).
10. **Nota de responsabilidade curta e fixa** · "avaliação de enfermagem; liberação é do médico" ·
    **Salão/Triagem**, **Agenda/Farmácia** ("o app apenas sinaliza"). Coerente com "app alerta, nunca
    bloqueia".
11. **Saída em texto copiável + impressão** · documento texto padronizado (cabeçalho, blocos, rodapé) com
    "Copiar" e CSS de impressão · **Salão/Triagem**, **Agenda** (agenda do dia em texto), **Consulta**.
12. **Gantt poltrona × hora** · linhas = poltronas, colunas = horas, blocos proporcionais à duração com cor
    do regime, legenda só dos regimes do dia · **Agenda**, **Salão** (ocupação ao vivo).
13. **Arrastar para remanejar com destino destacado** · trilho de destino com borda tracejada, encaixe em
    15 min, mensagem clara se não couber · **Agenda**. No app: conflito vira alerta VERMELHO, não veto
    silencioso.
14. **Clique no bloco abre modal de status** · dados + select de status + Salvar/Remover/Fechar ·
    **Agenda**, **Salão**. Candidato a 1 clique (botões de status diretos em vez de select + salvar).
15. **5 estados da sessão** · agendado/confirmado/faltou/remarcado/cancelado; inativos esmaecidos e
    riscados · **Agenda**. Cabe no teto de 5 estados.
16. **KPIs no topo do dia** · 2–3 caixas (sessões, ocupação %, agrupáveis) · **Agenda**, **Salão**.
17. **Navegação de dia com ◀ ▶ + seletor de data** · **Agenda**, **Salão**.
18. **Geração de série a partir de D1 + regime + nº de ciclos** · um formulário cria todas as sessões e
    devolve "N agendadas, M não couberam" · **Agenda**.
19. **Catálogo editável com "restaurar padrão"** · tabela + formulário de edição + reset que não toca em
    dados de paciente · **Configurações** (regimes, tempos de poltrona), **esteira interna**.
20. **Visão por papel (Farmácia)** · mesma agenda reagrupada por regime para outro profissional ·
    **Agenda** (farmácia/enfermagem).
21. **Feriados/bloqueios como pílulas removíveis** · **Configurações**, **Agenda**.
22. **Parâmetro operacional com explicação embaixo** · "Máximo de inícios a cada 30 min" + porquê ·
    **Configurações**.
23. **Aviso de minimização de dados no formulário** · nota LGPD junto ao campo · **Agenda**, **Canal**,
    **Configurações**.
24. **Cartão de etapa INPUT → OUTPUT** · número, papel, descrição, entrada/saída, exemplo · **esteira
    interna**.
25. **Chips sincronizados com cartões** · foco/hover no chip destaca o cartão e vice-versa · **esteira
    interna**, **Configurações** (pré-visualizar opção de layout).
26. **Copiar com ✓ temporário** · ícone troca por ✓ por 2 s · **esteira interna**, **Salão/Agenda**
    (copiar texto), **Chat**.
27. **Indicador de prontidão** (ponto + rótulo curto) · **esteira interna**, **Configurações** (estado de
    conexões — todas nascem desligadas).
28. **Estado vazio com ação** · "Nenhuma triagem registrada" + "+ Nova Triagem" · todas as telas.

---

## 3. Regras clínicas e operacionais embutidas nos HTMLs × app

Legenda: **IGUAL** · **DIFERENTE** (valor do HTML) · **NOVO** (não existe no app). Nada aqui é adotado.

### 3.1 Triagem (`Triagem_QT_v20.html`)
| Regra no HTML | Linha(s) | Comparação com o app |
|---|---|---|
| Temperatura **≥ 37,8 °C** → alerta vermelho "investigar neutropenia febril" | 478, 690 | **DIFERENTE**: triagem do ciclo usa 37,9; corte do salão é **> 37,8** (o HTML dispara já em 37,8, inclusivo). |
| Temperatura **≥ 38,5** → nível vermelho; ≥ 37,8 → nível amarelo | 708–709 | **DIFERENTE** (segundo degrau 38,5 e uso de amarelo; o app não tem amarelo). |
| Home: "Temp < 37,8 °C" como critério mínimo | 358 | **DIFERENTE** (mesma discrepância de limite). |
| SpO₂ **< 94 %** alerta; **< 90 %** nível vermelho | 479, 708–709 | **NOVO**. |
| PAS **< 90** → hipotensão (alerta âmbar) | 480 | **NOVO** (o app só tem limite superior). |
| Hipertensão | — | **Ausente no HTML**; app: PA > 14/9 (ciclo) e PA > 16 (salão). |
| FC | — | **Ausente no HTML** (campo opcional, sem limiar); app: FC > 110 (ciclo) e > 120 (salão). |
| Neutrófilos **< 1.500** → atenção | 546, 560, 693 | **IGUAL** ao corte do salão (N < 1500). |
| Neutrófilos **< 500** → crítico "NÃO iniciar QT" | 545, 559 | **NOVO** (degrau crítico). |
| Plaquetas **< 100.000** → atenção | 552, 560, 695 | **IGUAL** ao corte do salão (PLQ < 100.000). |
| Plaquetas **< 50.000** → crítico | 551, 559 | **NOVO**. |
| Hgb **< 8,0** atenção; **< 7** crítico | 357, 559–560, 696 | **NOVO**. |
| Creatinina **> 1,5** → "ajuste de dose pode ser necessário" | 493, 563 | **NOVO**. |
| Leucócitos com limites 3.000/4.000 nos atributos `data-lo`/`data-warn` | 502 (e 498–513) | **NOVO**, porém **inativo** (atributos nunca lidos pelo código). |
| ECOG **≥ 3** → alerta vermelho "revisar indicação" / nível amarelo | 591, 697, 709 | **IGUAL** no limiar (ECOG 3–4); **DIFERENTE** na consequência (HTML só alerta; app manda para a fila do médico). Home diz "ECOG ≤ 2 (em geral)" (358). |
| Qualquer CTCAE **G3/G4** → nível vermelho, "comunicar médico" | 613, 626, 707 | **NOVO**. |
| Itens CTCAE avaliados: 8 (náusea, vômito, diarreia, mucosite, fadiga, neuropatia, mão-pé, pele) | 602–611 | **NOVO**. |
| Obrigatórios: nome, ciclo, PAS e PAD, temperatura, SpO₂, ECOG | 263–277 | **DIFERENTE** no comportamento: o HTML **bloqueia o avanço** sem eles; o app alerta e nunca bloqueia (campo ausente = PENDENTE). |
| Conclusão tem 4 desfechos (liberar/adiar/atenção/contraindicado) escolhidos pela enfermagem | 640–645 | **DIFERENTE**: 4 cores incluindo âmbar e azul; app = VERDE/VERMELHO/PENDENTE e quem libera é o médico. |
| SC por Mosteller | 484 | **NOVO** (cálculo de apoio). |
| Um único conjunto de limiares (não separa ciclo × salão) | todo o arquivo | **DIFERENTE**: o app tem **dois portões distintos** (triagem do ciclo e corte do salão). |

### 3.2 Agenda (`agenda_qt_1.html`) — regras operacionais
| Regra no HTML | Linha(s) | Comparação |
|---|---|---|
| 13 poltronas, funcionamento 08:00–18:00 | 250 | **NOVO** (confirmar capacidade real do salão). |
| Tratamento longo (**≥ 300 min**) só inicia até **12:00** | 250, 321–326, 483 | **NOVO**. |
| Máx. **5 inícios por janela de 30 min** (configurável 1–13) | 281–282, 317–320, 595 | **NOVO**. |
| Encaixe em passos de **15 min** | 331, 479 | **NOVO**. |
| Sábado, domingo e feriados cadastrados bloqueados | 296–298 | **NOVO**. |
| Dias consecutivos (ex.: D1+D2) mantidos colados, preferindo antecipar 1 dia | 299–310 | **NOVO**. |
| Drogas "compartilháveis" agrupadas no mesmo dia (janela ± 3 dias) | 343–355 | **NOVO** (implica mover data do ciclo — decisão clínica/farmácia). |
| "Otimizar dia" reorganiza todas as sessões (longas de manhã) | 491–502 | **NOVO**; atenção: reordenação em massa contrasta com o princípio E1 (badge, sem reordenar). |
| 5 status de sessão | 233–238 | **NOVO**; cabe no teto de 5 estados. |
| Tempo de poltrona: 1ª sessão × manutenção, por regime (19 regimes de fábrica) | 254–274 | **NOVO** (catálogo seria configuração, não regra clínica). |
| LGPD: só nome + protocolo + data + horário na agenda | 138 | **NOVO** (alinhado com minimização). |

### 3.3 Esteira — nenhuma regra clínica.

---

## 4. Esteira interna de UI → painel interno (não clínico)

**Objetivo.** Um painel dentro de **Configurações** (D-W9-16: "layout da UI DIA | NOITE | PERSONALIZAR"),
visível só para o perfil administrador/médico-dono, para **trocar interface** sem mexer em código clínico
e ver em que etapa está cada troca. Não lê nem mostra dado de paciente.

**Estrutura proposta (herda os padrões 24–27):**
1. **Cabeçalho**: selo "ESTEIRA DE UI" + versão do tema ativo + indicador de prontidão (ponto + rótulo).
2. **Seletor de layout** (chips sincronizados com pré-visualização): **DIA** (tokens atuais
   `tokens-oncomed.css`, claro) · **NOITE** (variante escura derivada das paletas escuras da Triagem/Agenda,
   *mantendo* contraste AA e o semáforo VERDE/VERMELHO/PENDENTE) · **PERSONALIZAR** (ajustes limitados:
   densidade, tamanho de fonte base — a Agenda mostra que 17–18 px funciona no salão —, cor de destaque
   dentro de uma lista aprovada). Um clique aplica; desfazer visível.
3. **Trilho de etapas da troca** (cartões INPUT → OUTPUT, sem bloquear):
   01 Tokens (paleta/tipo) → 02 Sistema (`SISTEMA.md` · vocabulário de componentes) → 03 Telas
   (Agenda, Salão, Consulta, Canal, APAC, Chat, BarraComando: qual variante cada uma usa) →
   04 Verificação (contraste AA, alvo de toque, teto de 5 estados, sem amarelo) → 05 Publicar variante.
   Cada cartão mostra estado VERDE (ok) / VERMELHO (falhou verificação) / PENDENTE (não feito).
   O rodapé pode trazer a regra "cada saída alimenta a próxima" como orientação, não trava.
4. **Mapa de telas**: lista das 7 telas com a variante ativa e miniatura; trocar variante por tela é
   escolha local, reversível.
5. **Ações**: "Copiar especificação" (texto com tokens/variantes, ✓ por 2 s) e "Restaurar padrão" (padrão 19).

**Regras do painel.** Persistência por usuário; nenhuma instalação de pacote ou chamada externa a partir
da UI (toda conexão nasce desligada e passa pelo Action Gateway, como em D-W9-16); skills/plugins/MCP
apenas listados com estado, não executados daqui; alteração de tema nunca altera limiar, ordem de fila ou
texto clínico.

---

## 5. O que NÃO aproveitar

- **Arquitetura**: HTML único com `innerHTML` e re-render total a cada tecla (Triagem), variáveis globais,
  `onclick` inline, `confirm()/alert()` nativos, `window.open` + `document.write` para impressão.
- **Persistência**: `localStorage` como banco (chaves `tqt_hist`, `qt_*`), backup/importação JSON manual,
  "Limpar histórico" com apagamento local definitivo.
- **Dados embutidos**: catálogo de 19 regimes com tempos e cores fixos (Agenda 254–274); limiares
  hardcoded; nome, CRM/RQE e hospital do autor fixos no código e no rodapé (Triagem 6, 146–147, 179–184,
  195–197) — no app isso vem de Configurações.
- **Bloqueios**: validação que impede avançar etapa, drag-drop que recusa o destino, botões desabilitados
  até escolha — contrariam "alerta, nunca bloqueia".
- **Paleta/semântica de cor**: âmbar/amarelo e azul como estados clínicos; 4 desfechos de conclusão;
  emojis como ícones de estado; banner pulsante contínuo.
- **Reordenação automática** ("Otimizar dia") sem revisão humana.
- **Esteira**: bundle React 18.3.1 + Tailwind compilado + ícones lucide embutidos (176 KB, `lang="en"`,
  título "React Artifact"); `@import` de Google Fonts (requisição externa); comandos `npx skills add` de
  repositórios de terceiros (zanwei, AThevon, CloudAI-X, greensock, LottieFiles) — **não executar**;
  conteúdo das 5 skills (3D, GSAP, Lottie) não se aplica ao produto.
- **Segurança**: a Triagem não escapa HTML dos campos ao renderizar histórico (só escapa aspas) — não
  copiar o padrão. A Agenda tem `esc()`, mas o modelo de dados continua local.

---

## Verificação de dado real de paciente

- **Nenhum CPF, CNS, prontuário ou nome real de paciente** encontrado nos três arquivos.
- `agenda_qt_1.html` linha 124: nome fictício genérico usado como *placeholder* do campo Nome.
  Linha 138: a palavra "CPF" aparece só no aviso LGPD (instrução para **não** registrar).
- `Triagem_QT_v20.html`: placeholders genéricos (ex.: "Nome do paciente"). Contém dados profissionais do
  **médico autor** (nome, CRM, RQE, hospital) nas linhas 6, 146–147, 179–184, 195–197 e no documento gerado
  — não são dados de paciente.
- `Esteira-Operacional-Skills-Pipeline.html`: sem dado de pessoa.
