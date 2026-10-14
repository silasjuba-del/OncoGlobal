# F1 · Esquema único do pack de tumor v2 (D-F1-07)

Vale para todo arquivo `corpus/6-pack-tumor/<slug>/pack-<slug>.v2.RASCUNHO.json`. Substitui os packs v1 (GLM) e o lote 1 do Mistral (Markdown), que ficam como histórico.

## Fontes (ordem de precedência)

1. Diretriz SBOC 2025/2026 local — `C:\Users\silas\OneDrive\ONCO-DOCS ((TUDOAQUI)\SBOC\sboc\diretrizes` (texto extraído por página em `scratchpad/fontes/sboc/*.txt`).
2. Bula (ANVISA; na falta, rótulo FDA via openFDA/DailyMed) para dose, ajuste e contraindicação.
3. Aula do Onco PRO 2026 — `...\slides-pro-2026` (texto em `scratchpad/fontes/pro26/*.txt`): apoio e ordenação; dado numérico do curso só entra se a SBOC ou a bula confirmar, ou marcado `fonte.tipo = "CURSO"` com `estado = "INFERIDO"`.
4. NCCN/ESMO/ASCO/NCI PDQ abertos na web, para o que a SBOC não cobre (ex.: hematologia).
5. ClinicalTrials.gov (API v2: `https://clinicaltrials.gov/api/v2/studies/NCTxxxxxxxx`) para NCT. NCT só com o registro aberto; senão `"nct": null, "nctEstado": "NAO_VERIFICADO"`.

Toda afirmação de prioridade A (dose, corte, indicação de exame ou de tratamento, estádio) leva `fonte`:
`{"tipo": "SBOC|BULA|DIRETRIZ|CURSO|ENSAIO|NORMA", "referencia": "<arquivo ou URL>", "pagina": <n ou null>, "trecho": "<≤14 palavras literais>", "estado": "VERIFICADO|INFERIDO|CONFLITANTE|DADO_AUSENTE"}`.
Sem fonte = valor `null` + `"pendencia": "SEM_FONTE"`. Proibido estimar.

## Estrutura

```json
{
  "header": { "id": "pack-<slug>", "versao": "2.0.0", "vigenteDesde": "2026-10-11",
    "fonte": { "tipo": "DIRETRIZ", "referencia": "<SBOC principal + edição>", "trecho": null, "edicao": "<v e ano>" },
    "curador": "Dr. Silas Negrão", "aprovadoEm": "2026-10-11" },
  "status": "RASCUNHO", "consultavel": true, "alerta": false,
  "substitui": ["<id v1 se houver>"],
  "identidade": { "tumor": "", "cid10": [""], "subtipos": [""], "cenarios": ["localizado", "localmente_avancado", "metastatico", "..."], "limitesAplicabilidade": "" },
  "diagnostico": {
    "imagem": [ { "catalogoId": "<id do catálogo ou null>", "rotulo": "", "indicacao": "universal|condicional", "quando": "", "fonte": {} } ],
    "endoscopicos": [ "...mesmo formato..." ],
    "patologico": {
      "obtencao": [ { "tipo": "core|PAAF|excisional|endoscopica|cirurgica|outra", "quando": "", "catalogoId": "", "fonte": {} } ],
      "laudoDeveConter": [""],
      "molecular": [ { "alvo": "", "metodo": "H&E|IHQ|FISH/CISH|PCR|NGS|outro", "catalogoId": "", "quandoPedir": "universal|condicional|pesquisa", "cenario": "", "consequencia": "", "disponivelSUS": "sim|nao|parcial|DADO_AUSENTE", "fonte": {} } ]
    }
  },
  "estadiamento": {
    "sistema": "AJCC|FIGO|BCLC|Lugano|R-ISS|outro", "edicao": "", "fonte": {},
    "exames": [ { "catalogoId": "", "rotulo": "", "cenario": "", "indicacao": "universal|condicional", "fonte": {} } ],
    "gruposConduta": [ { "grupo": "", "conduta": "", "fonte": {} } ],
    "marcadores": { "uteis": [ { "catalogoId": "", "uso": "", "fonte": {} } ], "naoPedirDeRotina": [""] }
  },
  "tratamento": {
    "cenarios": [ { "cenario": "", "intencao": "curativa|paliativa", "modalidades": [""], "criterio": "", "fonte": {} } ],
    "protocolos": [ {
      "id": "<slug>-<esquema>", "nome": "", "cenario": "", "linha": "",
      "drogas": [ { "droga": "", "dose": 0, "unidade": "mg/m2|mg/kg|AUC|mg|UI|mcg|mcg/kg|UI/m2|kBq/kg|GBq|mg/m2/dia", "via": "EV|VO|SC|IM|intravesical|intratecal|intra-arterial|topica", "dias": "D1", "observacao": "" } ],
      "cicloDias": 21, "numeroCiclos": null, "premedicacao": "", "ajusteObrigatorio": "",
      "fichaId": "<id em corpus/fichas, se existir>", "sus": { "disponivel": "sim|nao|parcial|DADO_AUSENTE", "fonte": {} },
      "fonte": {}
    } ],
    "radioterapia": [ { "cenario": "", "doseTotalGy": null, "fracoes": null, "concomitante": "", "fonte": {} } ],
    "cirurgia": [ { "procedimento": "", "quando": "", "fonte": {} } ],
    "biomarcadorTratamento": [ { "seAlvo": "", "opcao": "", "evidencia": "", "sus": "", "fonte": {} } ],
    "suporte": { "emetogenicidade": "", "riscoNeutropeniaFebril": "", "outros": [""], "fonte": {} },
    "ensaios": [ { "nome": "", "nct": null, "nctEstado": "VERIFICADO|NAO_VERIFICADO", "populacao": "", "bracos": "", "desfecho": "", "resultado": "", "fonte": {} } ],
    "seguimento": [ { "periodo": "", "exames": ["<catalogoId>"], "periodicidade": "", "fonte": {} } ]
  },
  "ligacoes": {
    "exames": ["<todos os catalogoId usados>"],
    "interacoesConsultar": [ { "droga": "", "com": "", "ref": "<id INAT/CI se existir>" } ],
    "ctcaeAcao": [ { "classe": "", "termosCTCAEv6": [""] } ],
    "suporteReceitas": [""],
    "orientacoes": [""],
    "encaminhamentos": ["<id em 8-encaminhamentos ou nome>"],
    "laudos": [""],
    "formulasXYZ": [ { "x": "", "y": "", "z": "", "fonte": {} } ]
  },
  "pendencias": [""],
  "conflitos": [ { "tema": "", "fonteA": {}, "fonteB": {}, "escolhaSeguranca": "" } ],
  "curadoria": { "redator": "", "redigidoEm": "2026-10-11", "fontesLidas": [""], "aprovacaoClinica": null }
}
```

## Regras duras

- Exame só por `catalogoId` existente em `corpus/exames/exames-sigtap.v1.json`. Sem id: `catalogoId: null` e `rotulo` + `"pendencia": "SEM_ID_NO_CATALOGO"`.
- Dose com número, unidade, via, dias e ciclo. Sem um deles, a linha não entra.
- Nunca transferir dose ou corte entre tumores, cenários, vias ou edições de classificação.
- Neoadjuvante × definitivo × adjuvante × paliativo nunca misturados no mesmo protocolo.
- Diretriz × SUS: quando não incorporado, dizer e dar a alternativa SUS.
- Nenhum semáforo, cor ou alerta no texto (D-F1-01). Pack propõe; médico decide.
- Conflito entre fontes: registrar em `conflitos`, escolher o mais seguro.
