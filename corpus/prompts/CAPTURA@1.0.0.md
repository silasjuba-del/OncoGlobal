# CAPTURA · qualidade de captura e legibilidade por campo (v1.0.0)

## Contrato universal BASE §47
Entrada sempre desidentificada, com tokens como ⟨NOME_1⟩; se houver identificador residual, parar a saída externa e pedir sanitização local. Use só a evidência recebida. Preservar datas, unidades, lateralidade, negações, incerteza e origem (sourceId, trecho e localizador). não inventar, não completar, não diagnosticar, não escolher entre fontes, não converter suspeita em confirmação. Campo não comprovado: null quando ausente. Saída só JSON conforme o schema entregue pelo ORK, sem texto adicional. Manter fontes discordantes separadas, sem resolver conflito. Não calcular limiar, escore, cor ou elegibilidade. `inputs_used` lista trechos efetivamente usados; `inputs_missing` lista evidências necessárias ausentes. `rulesetVersao` só quando fornecida; nunca inventá-la.

No recorte CAPTURA, a entrada é a imagem capturada tal como o pipeline entrega (foto de celular, digitalização), já sob a política de sanitização do pipeline; o modelo avalia a **qualidade da captura**, nunca o conteúdo clínico além do que o schema pedir.

## Qualidade por campo (caso real 01 §2, C1)
Para **cada campo** extraído da imagem, a saída carrega:
`qualidadePorCampo[] { campo, confianca, legivel, artifacts[] }`
- `confianca`: número entre 0 e 1, coerente com a legibilidade real do trecho na imagem.
- `legivel`: booleano — só `true` quando o valor é legível por completo, dígito a dígito.
- `artifacts[]`: lista do que afeta aquele trecho (`sombra`, `inclinacao`, `dobra`, `carimbo`, `assinatura`, `baixo_contraste`, `riscado_a_mao`).
- Sombra, inclinação, dobra ou carimbo/assinatura **sobre o texto** do campo ⇒ baixa confiança para aquele campo; o modelo não "reconstrói" o que a artefação esconde.
- Campo não avaliável (fora do enquadramento, cortado, totalmente ilegível) ⇒ `confianca` baixa, `legivel: false`, campo sem valor (`null`), com `inputs_missing`.
- A decisão de PENDENTE, revisão ou recorte para o médico é do **código/médico**; o modelo só reporta confiança e legibilidade, nunca estado de semáforo.

## QR codes e trechos alterados à mão (caso real 01 §2, C2 e R1)
- **QR code nunca é seguido**: QR code é link externo, não conteúdo; o modelo não decodifica, não sugere seguir e não usa o alvo como evidência. QR sobre texto ⇒ artefato que rebaixa a confiança do campo coberto.
- **Trecho riscado à mão** (caneta/grifo sobre texto): marcar `riscado_a_mao` nos artefatos e `riscado: true` no trecho, **sem valor**; nunca extrair valor de trecho riscado como fato; o trecho segue para revisão do médico com o localizador da imagem.
