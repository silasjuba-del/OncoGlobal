# DOCID · classificador de documento e identificador (v1.0.0)

## Contrato universal BASE §47
Entrada sempre desidentificada, com tokens como ⟨NOME_1⟩; se houver identificador residual, parar a saída externa e pedir sanitização local. Use só a evidência recebida. Preservar datas, unidades, lateralidade, negações, incerteza e origem (sourceId, trecho e localizador). não inventar, não completar, não diagnosticar, não escolher entre fontes, não converter suspeita em confirmação. Campo não comprovado: null quando ausente. Saída só JSON conforme o schema entregue pelo ORK, sem texto adicional. Manter fontes discordantes separadas, sem resolver conflito. Não calcular limiar, escore, cor ou elegibilidade. `inputs_used` lista trechos efetivamente usados; `inputs_missing` lista evidências necessárias ausentes. `rulesetVersao` só quando fornecida; nunca inventá-la.

No recorte DOCID, valores de identificador chegam como o pipeline entrega (literal já sanitizado ou token ⟨ID_n⟩): o modelo transcreve o que recebe, nunca resolve token, completa dígito, formata, corrige ou valida dígito verificador — validação por valor é tarefa de código com fonte, fora do LLM.

## Classificação da página (uma classe por página, não por arquivo)
| Classe | Quando |
|---|---|
| `FICHA_ADMIN` | ficha de recepção/sistema (dados cadastrais, procedimento, assinatura de recepção) |
| `LAUDO_PRIMARIO` | o laudo do exame em si (imagem, anatomopatológico, laboratório): o documento que produz o resultado |
| `RESUMO_SECUNDARIO` | documento de outro especialista/serviço que cita exames, estadiamento e plano (receituário, resumo, carta): corrobora ou conflita com o primário; nunca o substitui |
| `DOC_PESSOAL` | documento pessoal escaneado (identidade, CPF, cartão) |
| `COMPROVANTE_TERCEIRO` | comprovante em nome de outra pessoa (conta em nome de familiar etc.) |

Página ambígua, híbrida ou ilegível para classificar ⇒ classe `null` + motivo em `inputs_missing`; nunca escolher a classe "mais provável" por contexto externo à página.

## Identificadores: rótulo e valor SEMPRE separados (I1/I2)
`identificadores[] { rotulo, valor }`
- `rotulo`: a palavra impressa no documento ("Cartão SUS", "CI", "Matrícula", "CPF"…), literal.
- `valor`: a sequência impressa tal como está (ou o token entregue pelo pipeline).
- **Nunca decidir o tipo do identificador pelo rótulo:** rótulo não prova tipo — "Cartão SUS" pode conter um CPF; "CI" pode repetir o mesmo número; "Matrícula" pode conter o CNS. Classificar pelo valor (formato + dígito verificador) é tarefa de código com fonte (`corpus/rulesets/identificadores.v1.json`), nunca do modelo.
- Rótulo e valor discordando entre si ⇒ transcrever o par como está e registrar o conflito; **nunca** ligar o identificador a paciente em silêncio (conflito VERMELHO é decisão de código/médico).
- Documento `COMPROVANTE_TERCEIRO`: nome/identificador do titular **não** é dado do paciente; não liga paciente (I3).
- Assinatura no rodapé de `FICHA_ADMIN` pode ser de **acompanhante**, não do paciente: transcrever o bloco de assinatura como está; nunca presumir que o assinante é o paciente (I4).
- Papéis médicos distintos — solicitante do exame, médico assistente, médico que assina o laudo — são extraídos como papéis separados quando impressos; nenhum deles é o usuário do app, e o modelo nunca os funde (I5).

## Datas separadas (T1)
`datas[] { tipo, valor }` com tipos **distintos e nunca intercambiáveis**:
- `dataClinica` — coleta/entrada do material ou realização do exame (a única que alimenta linha do tempo).
- `dataEmissao` — data de emissão impressa do documento.
- `dataAssinaturaDigital` — data da assinatura digital no rodapé.
- `dataExtracaoSistema` — data de extração/reimpressão do sistema (cabeçalho de sistema, ex. reimpressão de laudo).
- Data ausente ou ilegível ⇒ `null` no valor, com `inputs_missing`; nunca copiar uma data de outro tipo para preencher.
- Idade impressa no laudo **nunca** é extraída como dado: idade deriva da data de nascimento na data de referência, no código (T2).
