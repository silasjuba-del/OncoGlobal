# W8-ANTIGRAVITY · 10 FATIAS · regras puras do caso real (identidade, patologia, dedupe, fonte, imagem)

> Leia primeiro `docs/ondas/W8-COMUM.md` e `docs/referencias/CASO-REAL-01-LICOES.md` (inteiro). EXECUTOR = `ANTIGRAVITY`. Abra a pasta `C:\Users\silas\Projects\OncoGlobal-wt\w8-antigravity` · branch `f0/w8-antigravity`.
> **Faixa:** só **arquivos novos** em `src/rules/w8/**` e `tests/rules-w8/**`, + `docs/progresso/W8-ANTIGRAVITY.md`. Não edite regras existentes; se precisar, `docs/w8/PEDIDOS-ANTIGRAVITY.md`.
> **Regras puras:** sem I/O, sem `Date.now()`, sem `Math.random`, "hoje" e offset injetados; só importa `src/contracts` e arquivos de `src/rules/w8/` (o check de fronteiras proíbe `src/rules` importar outras camadas; regra existente que você precise reutilizar entra por parâmetro). Tipos de entrada/saída locais em `src/rules/w8/tipos.ts` (derivados dos contratos; nunca duplicar contrato).
> **Não use o agente de navegador** para nada que envolva dado; não instale dependência.

## AG-01 · Identificador por valor (lições I1–I2)
`src/rules/w8/identificadores.ts`: `classificarIdentificador({rotulo, valor})` → `{tipoPorValor: "CPF"|"CNS"|"DESCONHECIDO", valido, conflitoRotulo: boolean}`. CPF = 11 dígitos + DV; CNS = 15 dígitos + regra de validação **[VERIFICAR]** (implemente a verificação conhecida publicamente, isolada numa função com comentário de fonte `[VERIFICAR]`). Rótulo "Cartão SUS" com valor de 11 dígitos → `tipoPorValor:"CPF"`, `conflitoRotulo:true`. **Aceite:** testes com números sintéticos; nenhum número real.

## AG-02 · Vínculo de documento ao paciente (I3–I5)
`src/rules/w8/vinculoDocumento.ts`: comprovante de terceiro, assinatura de acompanhante, médico solicitante ≠ assistente → nunca ligam paciente nem preenchem dado do paciente; saída `{liga:false, motivo}`. Só identificador exato **válido por valor** liga.

## AG-03 · Data clínica (T1–T2)
`src/rules/w8/dataClinica.ts`: escolhe a data clínica entre `{dataClinica, dataEmissao, dataAssinaturaDigital, dataExtracaoSistema}`; ausente → PENDENTE (nunca usar emissão/extração no lugar). `idadeNaData(nascimento, dataRef, offset)` derivada, nunca copiada do laudo.

## AG-04 · Deduplicação de exame (D1–D3)
`src/rules/w8/dedupeExame.ts`: chave por tipo (patologia/IHQ: laboratório + número + data de entrada; imagem: serviço + registro + data do exame). Mesma chave + mesmo conteúdo = duplicata (1 exame); mesma chave + conteúdo diferente = **conflito VERMELHO**; chaves diferentes com conclusão igual = concordância (2 exames). **Aceite:** caso 07: 8 páginas → 6 exames.

## AG-05 · Hierarquia de fonte (E1–E3)
`src/rules/w8/hierarquiaFonte.ts`: primária × secundária × documento administrativo. Primária prevalece; secundária só corrobora/conflita; valor só em secundária → `{origem:"MENCIONADO_SEM_LAUDO"}`; categoria sem número (ex.: "PIRADS" sem valor) → PENDENTE.

## AG-06 · Trecho riscado e baixa confiança (R1, C1)
`src/rules/w8/rasura.ts`: campo com `riscado:true` ou `confianca` abaixo do limiar → PENDENTE com `motivo` e `recorteRef`; o limiar **não** é fixado no código: vem de parâmetro (ruleset `[VERIFICAR]`).

## AG-07 · Patologia por sítio (P1–P3)
`src/rules/w8/patologiaSitio.ts`: valida a estrutura por sítio (soma de percentuais Gleason = 100, primário/secundário coerentes com o grupo de grau ISUP por tabela **com fonte**: a tabela ISUP de correspondência é conhecimento estável; cite "ISUP 2014/OMS" com `[VERIFICAR edição]`). Inconsistência → conflito. `agregarCaso(sitios, ruleset)` existe mas **retorna PENDENTE enquanto o ruleset `patologia-agregacao` estiver inativo**.

## AG-08 · Resumo de imagem em 2 níveis
`src/rules/w8/resumoImagem.ts`: recebe a saída do RADS@1.1 e monta `resumo1` (sede + tamanho) e `resumo2` (8 campos, uma palavra), distinguindo `ausente` × `nao_descrito` × PENDENTE; captação articular/degenerativa nunca vira "osso: lesão".

## AG-09 · Interações (G-09) sem fonte = PENDENTE
`src/rules/w8/interacoes.ts`: lê o ruleset `interacoes.v1.json` (injetado); par sem regra ativa → PENDENTE ("não verificado"), **nunca** "sem interação"; regra ativa com fonte → alerta com severidade da fonte. Nenhuma regra ativa hoje: teste prova que tudo sai PENDENTE.

## AG-10 · Índice e fechamento
`src/rules/w8/index.ts` exporta tudo; teste do caso 07 sintético ponta a ponta nas suas funções (resultado da §4); relatório com saídas reais e `[VERIFICAR]`.
