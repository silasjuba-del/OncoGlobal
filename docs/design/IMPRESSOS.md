# ONCOMED · impressos A4 (W8-MUSE · MU-09)

> Protótipo: [`prototipos/impressos.html`](prototipos/impressos.html) (6 folhas,
> com interruptores "Assinado/Rascunho" e "Modelo em branco").
> Consumidor: Codex (W7) em `src/impressao`. Fonte do texto do kit:
> `docs/referencias/kit-oncologia-2026-05.txt` (DECISAO_MEDICA, intocado).

## 1. Geometria (vale para as 6 folhas)

- Papel A4 (210 × 297 mm), margens 15 mm laterais, 12 mm topo/base.
  CSS: `@page { size: A4; margin: 12mm 15mm; }`.
- Tipografia de impressão: 11 pt corpo, 9 pt notas, 14 pt título do documento.
  Preto `#000` sobre branco; sem cor de fundo (economia de toner).
- Regiões fixas, nesta ordem: **cabeçalho institucional → linha do médico →
  bloco do paciente → corpo → assinatura → rodapé**. Nada fora dessa ordem.
- Quebra: `break-inside: avoid` em bloco do paciente, item de receita, linha
  da grade de exames e bloco de assinatura. Tabela longa pode quebrar entre
  linhas, repetindo o cabeçalho (`thead { display: table-header-group; }`).

## 2. Regiões

| Região | Conteúdo | Fonte |
|---|---|---|
| Cabeçalho institucional | `{ nomeInstituicao, linha2, cidadeUf }` + aviso "cabeçalho de exemplo: altere nas configurações" quando for o valor inicial | configuração (D-W5-03); nunca fixo |
| Linha do médico | nome, CRM, RQEs | perfil do médico; nunca do hospital |
| Bloco do paciente | NOME, NASC., CIDADE, IDADE (+ CPF/CID no relatório pericial) | cadastro/ledger; ausente = **PENDENTE**, nunca linha em branco que pareça completa |
| Corpo | texto do kit ou do laudo | kit = TEXTO_FIXO verbatim; laudo = campos mapeados (ADENDO CDX-05) |
| Assinatura | data + "CARIMBO E ASSINATURA" / "ASSINATURA DO MÉDICO" | data do app; sem assinatura → marca d'água |
| Rodapé | `doc · versão · hash curto · página N/M` | hash do conteúdo exibido/assinado |

## 3. Regras de estado no papel

1. **Sem assinatura → marca d'água "RASCUNHO — NÃO VÁLIDO"** diagonal, 48 pt,
   cinza 15%, em todas as páginas. Assinado → sem marca, com data e hash.
2. **Ausente = PENDENTE** impresso no lugar do valor (ex.: `CNS: PENDENTE`).
3. **Modelo em branco** (médico preenche à mão): mesma diagramação, bloco do
   paciente vazio com linhas, faixa "MODELO EM BRANCO — para preencher à mão".
4. Trecho riscado/baixa confiança nunca gera valor impresso como fato; o
   impresso mostra PENDENTE e o recorte fica no app.
5. Finalidade APAC: herdada visível ou PENDENTE; nunca derivada da intenção.
6. SIGTAP sem tabela importada: `PENDENTE [VERIFICAR]`. AUTORIZAÇÃO e
   PERÍODO DE VALIDADE: sempre em branco.

## 4. Diagramação por documento

1. **Orientação nutricional** — 1–2 págs. Duas colunas: PREFERIR / EVITAR;
   DICAS PRÁTICAS em largura total; bloco do paciente no topo.
2. **Sinais de alarme** — 1–2 págs. Chamada de febre em destaque (negrito +
   borda, não só cor); SINAIS/COMPLICAÇÕES em lista com ☐; ANOTAÇÕES DO
   PACIENTE (pressão, vômitos, diarreia, dor) como grade de marcação.
3. **Receita de sintomáticos** — tabelas VO e EV: coluna MEDICAMENTO +
   ORIENTAÇÃO; cada item é uma linha **selecionável** (o médico desmarca o
   que não sai no impresso); OBSERVAÇÃO AO PLANTONISTA em caixa ao fim.
   Doses são texto do médico: o app não calcula nem altera.
4. **Requisição de exames** — grade exame × ciclo 1–4 com caixas de marcação
   e data por ciclo; EXAMES ADICIONAIS em linhas livres com caixas.
5. **Relatório pericial** — bloco estendido (NOME/IDADE/NASC./CIDADE/CPF/CID);
   DECLARAÇÃO (prazo e início = campos do médico); DIREITOS SOCIAIS em lista
   com ☐; observação de perícia em 9 pt; assinatura do médico ao fim.
6. **Laudo APAC** — blocos na ordem do formulário oficial: estabelecimento
   solicitante → paciente → procedimento principal + até 5 secundários →
   diagnóstico/CID → justificativa/observações → SOLICITAÇÃO preenchida →
   AUTORIZAÇÃO em branco → período em branco (ver MU-07).

## 5. Checklist para o Codex (`src/impressao`)

- [ ] 6 folhas a partir dos templates do kit + `apac-laudo.v1.json`.
- [ ] Cabeçalho/linha do médico vindos de configuração e perfil.
- [ ] Todo campo do `apac-laudo-campos.txt` aparece; AUTORIZAÇÃO vazia.
- [ ] Marca d'água condicional à assinatura; rodapé com hash.
- [ ] Reimprimir com a mesma chave não gera arquivo novo (CDX-06).
- [ ] Impressão via janela do sistema (`window.print()`); sem contato direto.
- [ ] Opção "imprimir modelo em branco" marcada como tal.
