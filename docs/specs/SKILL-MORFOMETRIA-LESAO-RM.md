> **SUPERADO em 2026-10-07 (D-W9-57)** pela skill `analise-morfometrica-lesao-snc` v4.0.0 em `docs/specs/skill-morfometria-snc/`. Em especial ficam **revogados**: calibração por anatomia populacional, "triplo teste" de três calibrações, limiar fixo de 15% como aprovação, δpx fixo e a árvore diagnóstica automática. Mantido só como histórico.

# Skill `analise-morfometrica-lesao-rm` v4.0 · morfometria de lesão encefálica em imagem sem DICOM

> Fonte: Dr. Silas, 2026-10-06 (auditoria adversarial v1→v4 + resumo da sessão "estatística - H.bem") — D-W9-52. Reconciliação com o projeto no fim.

## Auditoria (falhas residuais que motivaram a v4)
1. **Projeção em perspectiva:** foto de monitor tem pitch/yaw; a escala varia ao longo da imagem (gradiente afim), não só kx ≠ ky.
2. **Erro humano de marcação:** 4–6 px intraobservador dominam o ruído.
3. **Limiar vs. variação:** RECIST PD ≥ 20% e RP ≥ 30%; tolerância de 15% consome a janela de decisão. Lesão de 15–18 mm tem incerteza de ~17,6% → **inapropriado para resposta longitudinal**.
4. **Volume parcial (cortes ≥ 5 mm):** o maior diâmetro pode estar entre cortes.
5. **Sem gatilho de ação:** diferenciais sem sequência prioritária nem flags de contraindicação.
Histórico (v1/v2): pseudo-convergência por cancelamento (46 px × 57 px; áreas 104 × 139 mm², −34%); médias craniométricas fixas (135/170 mm) com erro sistemático de 5–8%; média entre eixos mascarando distorção; volumetria 3D/área a partir de corte único em FLAIR (FLAIR = tumor + edema). **Correção:** metástase encefálica mede-se pelo **maior diâmetro axial em T1 pós-contraste**.

## Frontmatter da skill
```yaml
name: analise-morfometrica-lesao-rm
version: 4.0.0
rules:
  zero_hardcoding: true
  fallback_order: [regua_gravada, quadro_filme_dfov, anatomia_populacional]
  max_tolerated_instability: 0.15
  default_output_status: "DRAFT / NEEDS_REVIEW"
```

## Entradas (parametrizadas)
- paciente: identificador **anonimizado**, idade, sexo, status imunológico (competente/imunodeprimido/desconhecido), febre/leucocitose, tumor primário conhecido.
- aquisição: modalidade (TC/RM), sequência (T1 Gd, T2, FLAIR, DWI, TC contrastada), índice do corte, total de cortes, espessura nominal (mm).
- calibração: quadro interno px {x,y}, quadro externo px {x,y}, referência física mm {x,y} (DFOV ou régua), anatomia ref px e mm (default literatura 130–140 mm).
- lesão: eixo maior px, eixo menor px, localização lobar, lateralidade (D/E/linha média).

## Pipeline matemático
**Passo 0 · Distorção trapezoidal:** com os 4 cantos da tela visíveis, comparar L_topo/L_base e H_esq/H_dir; divergência > 3% ⇒ `DISTORCAO_TRAPEZOIDAL`.
**Passo 1 · Anisotropia:** kx = ref_mm.x / ref_px.x; ky = ref_mm.y / ref_px.y; Δ = |kx − ky| / ((kx + ky)/2). Δ > 0,05 ⇒ `FOTO_DISTORCIDA_EIXO_ASSIMETRICO`; usar o k do vetor do maior eixo.
**Passo 2 · Triplo teste:** D1 = px × k_quadro_interno; D2 = px × k_quadro_externo; D3 = px × k_anatomia. Instabilidade = (máx − mín) / mediana.
- ≤ 0,10 → `MEDIDA_ALTA_ESTABILIDADE`
- 0,10–0,15 → `MEDIDA_ESTAVEL_LIMITADA` (só triagem/baseline; **inválida para RECIST/RANO**)
- > 0,15 → `MEDIDA_REPROVADA_INSTAVEL` (só intervalo [Dmín, Dmáx], sem escalar)
**Passo 3 · Incerteza propagada:** δD/D = √((δpx/eixo_px)² + (δk/k)²), δpx = ±3 px. Saída: round(D) ± round(δD) mm.
**Elegibilidade RANO-BM:** ≥ 10 mm = mensurável (baseline). Proibido uso em follow-up/resposta se incerteza > 10%.

## Árvore diagnóstica (lesão expansiva encefálica com realce anelar)
- **DWI com restrição central** → ABSCESSO (urgência, prioridade #1).
- Sem restrição + **história oncológica** → METÁSTASE (mais comum).
- Sem primário, lesão solitária: **idoso + parede irregular** → GBM; **periventricular + imunossupressão** → LINFOMA PRIMÁRIO → **FLAG: corticoide antes da biópsia/líquor contraindicado**.

## Saída obrigatória (PARECER MORFOMÉTRICO — DRAFT / NEEDS_REVIEW)
1. Calibração e auditoria: qualidade (CONFORME/FOTO_DISTORCIDA, % anisotropia); D1, D2, D3; variação inter-métodos e status; limitação formal (proibido seguimento/RECIST/RANO; só baseline).
2. Dimensões: maior diâmetro axial ± intervalo; RANO-BM elegível (≥ 10 mm) ou não; edema perilesional não medido como tumor; efeito de massa/herniação.
3. Hipóteses ranqueadas: a favor · contra · exame discriminatório decisivo (ex.: DWI; perfusão rCBV/espectroscopia; RM com gadolínio; TC TAP para primário).
4. Alertas de segurança (ex.: linfoma → não iniciar corticoide antes de biópsia/líquor; desvio de linha média > 5 mm → acionar neurocirurgia).
Cláusula fixa: *"Medição indireta sobre captura não-DICOM. Não substitui pós-processamento em estação nativa nem decisão médica."*

## Script de 4 cliques (referência; Python)
```python
import numpy as np
def calcular_morfometria_4cliques(p_ref1, p_ref2, d_ref_mm, p_lesao1, p_lesao2):
    px_ref = np.hypot(p_ref2[0]-p_ref1[0], p_ref2[1]-p_ref1[1])
    px_lesao = np.hypot(p_lesao2[0]-p_lesao1[0], p_lesao2[1]-p_lesao1[1])
    k = d_ref_mm / px_ref
    d = px_lesao * k
    delta_px = 3.54  # ±2,5 px por clique
    inc = d * (delta_px / px_lesao)
    return {"diametro_nominal_mm": round(d, 1),
            "intervalo_seguro_mm": (round(d - inc), round(d + inc)),
            "fator_escala_mm_por_px": round(k, 4),
            "mensuravel_rano_bm": d >= 10.0}
```

## Caso de validação (sintético a partir do caso discutido)
Mulher idosa, lesão encefálica: maior diâmetro ≈ 17 mm (15–18 mm), triplo teste 12,2% (≤ 15%, estável limitada). Hipóteses: metástase › GBM › abscesso (exige DWI) › linfoma (alerta corticoide).

---
## Reconciliação (tech lead)
| Ponto | Encaixe |
|---|---|
| Quem mede | **Código** (fórmulas acima) sobre pontos clicados pelo **médico**; IA não mede nem lê pixel (D-W9-40 até G-27). |
| Status | Sempre `DRAFT / NEEDS_REVIEW`; nunca alimenta RECIST/Chart3D de resposta; só baseline/triagem. |
| Hipóteses ranqueadas | Exibidas como apoio com "a favor/contra/exame decisivo"; não viram diagnóstico no prontuário sem o médico. |
| "Conduta imediata" | Vira **ALERTA de segurança** (corticoide × linfoma; desvio > 5 mm), nunca ordem — IA não define conduta (D-W9-24). |
| Identificador | Só anonimizado/pseudônimo (G-02). |
| Imagem | Foto/print do médico entra pela caixa única; laudo oficial prevalece sobre a medida estimada. |
| Linguagem | Script Python é referência; no app a função é TypeScript pura em `src/rules` (sem dependência nova). |
