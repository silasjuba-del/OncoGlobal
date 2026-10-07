# ONCOMED · semântica de estado na UI (W8-MUSE · MU-02)

> Fonte de verdade: `src/contracts/estados.ts` (teto de 5 por dimensão — Q9).
> Este documento só define **como cada estado aparece**. Nada aqui cria estado
> novo. Regra-mãe: **cor sempre com texto/ícone**; estado nunca some sozinho.

## 1. Semáforo (D1) — a palavra é obrigatória

| Estado | Palavra na tela | Cor | Ícone | Significado (Q10) |
|---|---|---|---|---|
| `VERDE` | Verde | `--om-verde` `#1f6b45` | ● cheio | "nenhum alerta com os dados disponíveis" — **nunca** "liberado" |
| `VERMELHO` | Vermelho / nome do problema | `--om-vermelho` `#8f1d1d` | ⚠ triângulo | conflito ou alerta que exige o médico |
| `PENDENTE` | Pendente | `--om-pendente` `#5c6770` | ◐ meio-círculo | ausente, aguardando, não resolvido |

Markup padrão (Cursor usa `classeSemaforo()` de `src/ui/tema/temas.ts`):

```html
<span class="semaforo semaforo-pendente">
  <svg aria-hidden="true"><!-- ícone pendente --></svg>
  <span>Pendente</span>
</span>
```

- Proibido: ponto colorido sem palavra; "OK"/"Ativo"/"Normal" como sinônimo
  de VERDE; PENDENTE com verde em qualquer tema (teste `tema.test.tsx`).
- Contador de grupo ("3 pendências") usa a palavra no plural + número; o
  badge só é vermelho se houver item VERMELHO no grupo.

## 2. Conflito (D3 `CONFLITO`) — vermelho com candidatos

- O cartão/registro em conflito mostra **VERMELHO + a palavra "Conflito"** e
  lista **todos os candidatos com fonte** (valor, origem, data clínica).
- Nunca `last-write-wins`: os candidatos coexistem até o médico escolher.
  A escolha vira fato com fonte `MANUAL` + revisão `CONFIRMADO`; os demais
  continuam visíveis como "não escolhidos".
- Exemplo (I1): campo "Cartão SUS" com CPF de 11 dígitos → conflito VERMELHO
  "Rótulo × valor": candidato A "CPF 11 dígitos (validado pelo valor)",
  candidato B "CNS 15 dígitos rotulado Matrícula". Ligação silenciosa: proibida.

## 3. `ausente` × `não descrito` × `não se aplica`

Três frases diferentes, três aparências diferentes (CASO-REAL-01 §3, K-02):

| Situação | Frase na tela | Aparência |
|---|---|---|
| Negação explícita na fonte ("sem linfonodomegalia") | **Ausente** | texto normal + tag de origem; conta como informação |
| Campo não mencionado na fonte ("PIRADS" sem número) | **Não descrito** | PENDENTE (◐ + palavra) + fonte citada |
| Requisito aplicável sem valor (sem hemograma válido) | **Pendente** | PENDENTE (◐ + palavra) |
| `NAO_SE_APLICA` com motivo + fonte | **Não se aplica** + motivo | texto suave, sem pendência, sem VERDE |

Proibido: "não descrito" virar "ausente"; `NAO_SE_APLICA` gerar pendência ou
pintar VERDE; linha em branco que pareça completa (impresso mostra PENDENTE).

## 4. Rascunho × confirmado × assinado (D2 Revisão)

| Revisão | Chip | Tratamento visual |
|---|---|---|
| `RAW` | "Recebido" | cinza; só aparece em trilhas técnicas, nunca como fato |
| `INFERIDO` | "Sugestão da IA" | borda tracejada + prefixo no texto; **nunca** vira fato sem o médico |
| `REVISAR` | "Revisar" | PENDENTE + destaque na fila de revisão |
| `CONFIRMADO` | "Confirmado" + autor/data | texto final; autor sempre visível ("confirmado por …") |
| `ASSINADO` | "Assinado" + autor/data/hash curto | selo + marca d'água em impresso; escopo da assinatura exibido (A1) |

- Impresso sem assinatura: marca d'água **"RASCUNHO — NÃO VÁLIDO"** (D-W5-05,
  MU-09). Assinatura cobre só o que foi exibido no bundle (G-25).
- "Sugestão da IA — sem laudo" (R-32) aparece **junto da imagem**, com
  limitações; o médico registra/ corrige/descarta — registrar não vira laudo.

## 5. Baixa confiança / riscado à mão — PENDENTE com recorte

- Campo de OCR/foto com confiança baixa ou ilegível (C1): PENDENTE +
  miniatura do **recorte da imagem** ao lado do campo + texto
  "conferir no recorte". O médico confirma ou corrige; o recorte fica
  anexado à decisão.
- Trecho riscado à caneta (R1): PENDENTE + recorte + texto fixo
  **"trecho riscado à mão: não usar sem revisão"**. Nenhum valor de trecho
  riscado aparece como fato, nem como sugestão preenchida.
- QR code sobre texto (C2): nunca seguido automaticamente; aparece como anexo
  neutro, sem pré-visualização externa.

## 6. E1 (emergência) — banner, não reordenação

- E1 ativo = **banner vermelho** no topo da tela E na folha operacional do
  salão (K-12), `role="alert"` (único da tela), texto + ação de
  escalonamento. **Nunca** entra na evolução impressa como objeto Alerta.
- Na fila: E1 é **badge** no paciente, sem reordenar ninguém (A7).
- E1 nunca some sozinho: some só com ação registrada do médico; "validar
  tudo" com vermelho registra `reconhecidoEm` (ciente), sem autorização
  implícita (K-14).

## 7. Outros estados que a UI exibe (sem inventar nenhum)

- **Destino do salão (D4):** `FRENTE` · `FILA_MEDICO` · `SALAO` como coluna do
  quadro (MU-06); FRENTE exige zero cortes E zero pendências (K-11).
- **APAC (D5):** `RASCUNHO` · `EMITIDA` · `AUTORIZADA` · `NEGADA` · `VENCIDA`
  como chip + linha do tempo do lote; `AUTORIZADA` só chega de fora.
- **Artefato (D6):** `PRONTO` · `EM_REVISAO` · `BLOQUEADO` — bloqueia o
  documento, nunca o médico (salvar rascunho nunca falha).
- **Delta (D7):** `NOVO` · `MUDOU` · `PERSISTE` · `RESOLVEU` + seta de direção
  só quando houver regra clínica (`MELHOR`/`PIOR`); sem regra, sem seta (K-17).
- **Conversa (D8):** `NOVA` · `TRIADA` · `AGUARDA_MEDICO` · `RESPONDIDA` ·
  `ENCERRADA`; urgência = semáforo VERMELHO **sobre** a conversa.
- **Farmácia (D9):** `ENVIADA` · `CONFERIDA` · `CORRECAO_PEDIDA` · `ACEITA`;
  correção pedida chega no chat, 1 clique aceita/recusa (Q37).
- **Capacidade (D10 → campo):** `SPECIFIED` · `TESTED` · `VALIDATED` ·
  `OPERATING` · `DISABLED` como chip no centro de comando (MU-08);
  OncoAssist nesta onda = `DISABLED` ("capacidade não habilitada").
- **Intensidade (●●●○○):** aceita em alertas/pendências **só** se o número de
  pontos vier de regra com fonte e houver texto ao lado; nunca "impacto"
  inventado pela IA (CASO-REAL-01 §3).

## 8. Composição (o que nunca acontece)

1. Conflito nunca some; nunca resolve em silêncio; nunca `last-write-wins`.
2. Ausente nunca é VERDE; VERDE nunca significa liberado/assinado/normal.
3. Sugestão da IA nunca veste roupa de fato (borda tracejada + prefixo).
4. E1 nunca some, nunca reordena fila, nunca entra em evolução impressa.
5. Rascunho nunca se perde (K-01) e nunca é promovido por salvar.
6. Nada assina, prescreve ou libera QT sozinho: toda ação final tem autor
   médico + data + escopo visíveis.
