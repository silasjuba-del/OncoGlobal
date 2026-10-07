# Modelo 05 · Prescrição de QT (layout institucional real) + 4 fichas observadas

> Fonte: 4 prescrições reais do Dr. Silas (imagens, 2026-10-06). **Identificação dos pacientes retirada** (nome, nascimento, CPF, matrícula/CNS, prontuário, nº de entrada/prescrição). Fica só o layout e o conteúdo dos protocolos.

## Layout (cabeçalho)
| Esquerda | Direita |
|---|---|
| Paciente | Prontuário |
| Nascimento (data + "NN anos e N meses") | Cód. Entrada (prontuário.sequência) |
| Convênio (ex.: SUS BPA) | N. da Prescrição |
| Matrícula (= CNS) | Data Prescrição |
| Médico Assistente (nome + CRM PB) | Protocolo (código `P####` + nome) |
| CPF | Ciclo |
| — | Dia |
Faixa "Alergias" (texto livre; ex.: "Paciente nega alergias a medicações"; vazio = PENDENTE, nunca "nega").

## Layout (tabela)
`Medicamentos | Dose Prot | Dose Presc | Diluente | Via | Intervalo | Tempo Inf | Dia(s)`
- Medicamento numerado; aditivos da mesma bolsa em sub-linhas `> DROGA - dose`; observação em `- Obs: ...`.
- `Dose Prot` = dose do protocolo (mg/m², AUC, mg); `Dose Presc` = dose calculada/prescrita. **`Dose Prot = 0` aparece em fichas antigas** (sem base por m²) → no app vira PENDENTE da base de cálculo, nunca 0.
- `Intervalo` ∈ PRE-QT | QT | POS-QT. `Dia(s)` = d1, d8…

## Fichas observadas (pré-medicação real do serviço)
**P1603 AT — doxorrubicina + paclitaxel (ciclo 1)**
1. Prometazina 25 mg VO — PRE-QT d1
2. SF 0,9% 100 mL EV 15 min + cimetidina 300 mg + dexametasona 20 mg + ondansetrona 16 mg — PRE-QT d1
3. Doxorrubicina 60 mg/m² em SF 100 mL EV 15 min — QT d1
4. Paclitaxel 175 mg/m² em SF 500 mL EV 3 h — QT d1
5. SF 0,9% 100 mL EV push — POS-QT d1

**P1456 — docetaxel + carboplatina AUC 5 (ciclo 3)**
1. Prometazina 25 mg VO — Obs: 30 min antes do docetaxel — PRE-QT d1
2. SF 100 mL 15 min + dexametasona 20 mg + ondansetrona 16 mg + cimetidina 300 mg — PRE-QT d1
3. Docetaxel 75 mg/m² em SF 250 mL EV 60 min — QT d1
4. Carboplatina AUC 5 em **SG** 250 mL EV 60 min — QT d1
5. SF 100 mL push — POS-QT d1

**P1477 — CDDP + gencitabina (d1, d8; ciclo 2)**
1. SF 100 mL 15 min + dexametasona 20 mg + ondansetrona 16 mg — PRE-QT d1, d8
2. SF 500 mL 60 min pré-cisplatina + sulfato de magnésio 10% 10 mL + KCl 19,1% 4 mL — PRE-QT d1
3. Cisplatina (dose fixa na ficha, Dose Prot 0) em SF 500 mL 60 min + manitol 20% 200 mL — Obs: taxa máxima 1 mg/min — QT d1, d8
4. Gencitabina (dose fixa, Dose Prot 0) em SF 250 mL 30 min — QT d1, d8
5. SF 500 mL 60 min pós-cisplatina + KCl 19,1% 4 mL — POS-QT d1

**P1393 — paclitaxel semanal (ciclo 1)**
1. Prometazina 25 mg VO — PRE-QT d1
2. SF 100 mL 15 min + cimetidina 300 mg + dexametasona 10 mg + ondansetrona 8 mg — PRE-QT d1
3. Paclitaxel (dose fixa, Dose Prot 0) em SF 250 mL EV 60 min — QT d1
4. SF 100 mL push — POS-QT d1

## Achados do tech lead `[VERIFICAR]` com o Dr. Silas
1. **Antiemese/pré-medicação real = prometazina VO + cimetidina + dexametasona + ondansetrona** (taxanos e AT). D-W9-23c diz "ondansetrona + dexametasona + difenidramina". Prometazina (anti-H1) faz o papel da difenidramina? Cimetidina (anti-H2) entra no padrão de taxano?
2. P1477: hidratação pré e pós (Mg/K) só no d1, mas cisplatina também no d8. Confirmar se d8 tem hidratação (dose menor, esquema tipo vias biliares 25 mg/m²).
3. Fichas com Dose Prot 0 (P1477, P1393): falta a base mg/m²/AUC → impede conferência de cálculo; o app exige a base na ficha (D-W9-24).
4. Carboplatina diluída em SG 5% e demais em SF: diluente vem da ficha (D-W9-24 §8).

**P1426 — docetaxel + CDDP (ciclo 1)** (adicionada em 2026-10-06)
1. SF 100 mL 15 min + dexametasona 20 mg + ondansetrona 16 mg — PRE-QT d1
2. SF 500 mL 60 min pré-cisplatina + sulfato de magnésio 10% 10 mL + KCl 19,1% 4 mL — PRE-QT d1
3. Prometazina 25 mg VO — PRE-QT d1
4. Docetaxel 75 mg/m² em SF 250 mL EV 60 min — QT d1
5. Cisplatina 75 mg/m² em SF 500 mL EV 2 h + manitol 20% 200 mL — Obs: taxa máxima 1 mg/min — QT d1
6. SF 500 mL 60 min pós-cisplatina + KCl 19,1% 4 mL — POS-QT d1
Nota: aqui não há cimetidina (P1456, também com docetaxel, tem). Padrão de cimetidina por taxano `[VERIFICAR]`.
