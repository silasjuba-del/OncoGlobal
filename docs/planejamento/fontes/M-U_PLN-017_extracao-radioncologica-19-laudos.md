# Fonte M-U · PLN-017 · 2026-10-07 · material do Dr. Silas (DESIDENTIFICADO)

> **Não é cópia literal.** A mensagem original (saída de outro chat/LLM colada pelo Dr. Silas) continha **nomes reais de 19 pacientes, datas de exame e dados clínicos identificáveis**. Regra do projeto: PHI não entra no repositório. Esta fonte mantém a estrutura, os achados clínicos e o código proposto; nomes viram "Paciente Teste NN" e datas exatas viram [data]. O texto integral com PHI **não** foi gravado aqui.
> Atenção: o texto original colado no chat do planejamento já contém PHI; ele permanece só na conversa. Recomendação ao Dr. Silas: não repassar o original ao operacional nem a executores externos.

# EXTRAÇÃO E RESUMO RADIONCOLÓGICO — ANÁLISE DE 19 LAUDOS (resultado de outro chat)

Lendo todos os documentos com foco exclusivamente oncológico.

## Casos oncológicos detectados (2 casos)

### 1) Paciente Teste 01
- Diagnóstico: neoplasia indiferenciada epitelióide (CEC ou CBC) frontal
- Localização: região frontal — órbita direita
- Data: [data]
- Achados: lesão infiltrativa de seio frontal 20×19 mm; extensão para canto ocular, lesão lítica em seio maxilar e arco zigomático; erosão de ducto lacrimal; infiltração cortical óssea
- Indicação (como no original): "RT antiálgico em região umeral esquerdo" ← **inconsistência de sítio** (achados frontais × indicação umeral)
- Histórico: tratado cirurgicamente (abril/2026)
- Status: seguimento oncológico ativo

### 2) Paciente Teste 02
- Diagnóstico: lipossarcoma pleomórfico em coxa
- Localização: músculo vasto intermédio, terço médio de coxa esquerda
- Data: [data]
- Achados: formação expansiva 6,9×5,9×3,4 cm; heterogênea ao contraste paramagnético; edema em fáscia lateral; possível "remascência" neoplásica pós-cirúrgica (no original; provável "remanescente")
- Recomendação: correlacionar com clínica para acompanhamento

## Casos classificados como não oncológicos (17)

| Paciente | Exame | Achado | Status atribuído |
|---|---|---|---|
| Paciente Teste 03 | TC tórax + abdome/pelve | espessamento pleural, granuloma calcificado, micronódulos | pós-tuberculose |
| Paciente Teste 04 | TC tórax | enfisema bilateral, fibrose atelectásica | DPOC |
| Paciente Teste 05 | TC tórax + abdome | cistos renais simples, esteatose hepática | degenerativo |
| Paciente Teste 06 | TC abdome/pelve | hérnia umbilical, esteatose hepática | banal |
| Paciente Teste 07 | TC abdome/pelve | microcálculo renal esquerdo, cisto hiatal | banal |
| Paciente Teste 08 | RM pelve | endometriose, lesão miometrial | ginecológico |
| Paciente Teste 09 | TC abdome superior + pescoço + crânio + tórax | cisto renal cortical, assimetria de cordas vocais, gliose microangiopática | banal/neurológico |
| Demais 10 casos | diversos | ateromatose, degeneração, espondilartrose etc. | não maligno |

## Prompt/código proposto (para "Claude Code")

```python
# radioncologic_extractor.py
"""
INSTRUÇÕES CRÍTICAS:
1. Busque APENAS palavras-chave oncológicas absolutas
2. RECUSE tudo que não seja neoplasia maligna declarada
3. Retorne JSON estruturado com 4 blocos obrigatórios
4. Falhe rápido em achados benignos/degenerativos
"""

ONCOLOGIC_STRICT = [
    "carcinoma", "adenocarcinoma", "sarcoma", "liposarcoma",
    "neoplasia maligna", "tumor maligno", "lesão maligna",
    "SUVmax", "hipermetabólico", "captação anômala",
    "metástase", "invasão", "infiltração tumoral",
    "linfonodomegalia maligna", "destruição óssea secundária"
]

BENIGN_EXCLUDERS = [
    "granuloma", "calcificado", "degenerativo", "fibrose",
    "cisto", "hérnia", "esteatose", "ateromatose", "espondilartrose",
    "endometriose", "gliose", "residual", "pós-infeccioso"
]

def extract_radioncologic_case(laudo_dict: dict) -> dict | None:
    """
    Parse laudo completo → retorna estrutura oncológica ou REFUSE

    Inputs:
      - laudo_dict: {paciente, data, exame_tipo, indicacao, descricao, conclusao}

    Outputs:
      {
        "é_oncológico": bool,
        "diagnóstico_primário": str,
        "cid10": str,
        "localização_anatômica": str,
        "dimensões_cm": str,
        "suv_max": float | None,
        "estadiamento": str | None,
        "progressão_temporal": str | None,
        "recomendação_clínica": str
      }
    """

    # 1. TRIAGEM RÁPIDA
    texto_completo = f"{laudo_dict.get('indicacao', '')} {laudo_dict.get('descricao', '')} {laudo_dict.get('conclusao', '')}"

    # 2. BUSCA BOOLEANA
    tem_oncologic = any(k in texto_completo.lower() for k in ONCOLOGIC_STRICT)
    tem_benign = any(k in texto_completo.lower() for k in BENIGN_EXCLUDERS)

    if not tem_oncologic or (tem_benign and not tem_oncologic):
        return None  # ❌ REFUSE

    # 3. EXTRAÇÃO DOS 4 BLOCOS
    return {
        "é_oncológico": True,
        "diagnóstico_primário": extract_diagnosis(texto_completo),
        "cid10": extract_icd10(texto_completo),
        "localização_anatômica": extract_location(texto_completo),
        "dimensões_cm": extract_dimensions(texto_completo),
        "suv_max": extract_suv(texto_completo),
        "estadiamento": extract_staging(texto_completo),
        "progressão_temporal": extract_progression(texto_completo),
        "recomendação_clínica": extract_recommendation(texto_completo)
    }

# Funções auxiliares (regex + NLP)
def extract_diagnosis(text): ...
def extract_icd10(text): ...
def extract_location(text): ...
def extract_dimensions(text): ...
def extract_suv(text): ...
def extract_staging(text): ...
def extract_progression(text): ...
def extract_recommendation(text): ...
```

## Indicação do texto original para "Claude Code" (próximo passo) — NÃO EXECUTADA pelo planejamento

```
@claude-code execute
file: /home/claude/radioncologic_extractor.py
input: [ {"paciente": "<nome real>", "data": "[data]", ...}, {"paciente": "<nome real>", "data": "[data]", ...} ]
output_format: JSON
```

## Resultado esperado (como descrito no original)

Documento PDF estruturado (ReportLab) com: cabeçalho (paciente | CRM do médico | data | ID do laudo); BLOCO 1 identificação oncológica (diagnóstico, CID-10, TNM); BLOCO 2 achados estruturais (lesão primária, linfonodos, metástases com SUVmax); BLOCO 3 progressão (comparação temporal: novo/aumento/estável); BLOCO 4 conclusão clínica (estadiamento, resposta terapêutica, conduta). Fecha com "PRONTO PARA RODAR? Avisa quando quer que eu execute o código ou refine a extração."
