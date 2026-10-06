# Auditoria loop 2 · uso cruzado (2026-10-06, colada pelo Dr. Silas)

Loop 1 caça contradição de número/código/frase; loop 2 exige que o achado sobreviva a uma segunda leitura contra a própria fonte.

## Mortos no loop 2 (não são erro)
JCOG1008 (HR 0,69, IC 99,1% 0,374–1,273 < margem 1,32; seguimento longo é outra análise) · KEYNOTE-689 (2+15 = 2+3+12) · SIGTAP (52 códigos formatado = 10 dígitos; organização oficial; CA 19-9 sem código corretamente em branco) · CTCAE v6 (neutrófilos, plaquetas, febre, creatinina, QTc, HAS grau 1 conferem; "1,2,4,3,6,8 kHz" é typo do original já marcado).

## Sobreviventes (mudam conduta ou dose se cruzados)
1. **Pack recusa o que a planilha afirma.** TPF (pack 10 NÃO_VERIFICADO; planilha 75/75/750 D1–5 ×3 sem dizer TAX 323 ou 324; TAX 324 = cis 100 / 5-FU 1.000 ×4d). ddMVAC (pack NÃO_VERIFICADO; planilha MTX 30 D1, VBL 3 D2, DOXO 30 D2, CIS 70 D2 q14 ×4; filgrastim "7–10 d" escrito como 7; VESPER planejou 6 neoadjuvantes).
2. **Mesmo nome, dose diferente.** Gem+Cis bexiga (cis 70 D1) × vias biliares (cis 25 D1+D8, ABC-02/KEYNOTE-966). Carbo+Pacli 21/21: próstata AUC 5 × mama AUC 6. Cisplatina semanal+RT: colo/vulva ×6 × cabeça e pescoço ×7; 40 mg/m² do JCOG1008 é adjuvante; planilha lista 100 q21 ×3 e 40 semanal ×7 sem dizer o padrão.
3. **Erro de formulação.** Capecitabina em mg/m² com "1 cp 12/12h" (CAPOX 1.000, mono 1.250, esôfago 1.000, gem+cape 830). FOLFOX/FOLFIRI de reto "D1+D2, 8 h, sem bomba" ≠ 2.400 em 46 h (5-FU depende de schedule). IFL (Saltz) e Mayo sem carimbo de obsoleto.
4. **Suporte abaixo do risco.** Cis 70–100, TPF, ddMVAC só com ondansetrona 8 + dexa 10 no D1, sem NK1. Docetaxel com dexa 10 IV uma vez (bula: 3 dias). Zoledrônico 4 mg q84d sem fase mensal. Hidratação de cis 100: 500 mL antes/depois, 60 min — se for protocolo local, tem de estar escrito como desvio.
5. **Limiar de bula × grau CTCAE.** N <1.500 é grau 1 (ou nenhum) na v6; bula de taxano segura em <1.500. Plaquetas <100.000 é bula (docetaxel/gencitabina); grau 2 v6 começa <75.000. Febre: serviço chama 37,9; CTCAE grau 1 = 38,0; neutropenia febril = pico >38,3 ou ≥38 por >1 h. Fronteiras: N 1.000 = grau 1, 999 = grau 2; Hb 8,0 = grau 2, <8,0 = grau 3; PLQ 10.000 = grau 3, <10.000 = grau 4.
6. **Compilação.** No docx, fluxograma 10 virou placeholder e a tabela QT-RT de cabeça e pescoço foi achatada; o .md mantém o mermaid. **Fonte de verdade = .md.**

## Conflitos do material com as diretivas do Dr. Silas
- "Comorbidades impeditivas" / "não iniciar" / "absoluta" → no app vira **alerta**; quem bloqueia é o financeiro (só exportação).
- ECOG 3–4 → **fila do médico**, não banimento de tratamento.
- Febre/infecção: febre não suspende QT por si; olha vital e neutrófilo. Grau 1 CTCAE (38,0) ≠ chamado da triagem (37,9) ≠ corte do salão (>37,8).
- Silêncio de laboratório: a IA não avisa Hb >8, TGO <70, Cr <1,6, N >1.500, PLQ >100.000; graus CTCAE 1–2 não podem virar aviso nessa faixa.
- **Dois dutos sem merge:** prescrição não gera APAC; APAC não calcula dose nem edita prescrição assinada; conduta assinada deriva APAC e só alerta.
- Bula FDA/EMA ≠ bula ANVISA (marcada NÃO_VERIFICADO): nunca fundir fonte.
- Dois portões separados: triagem do ciclo (febre 37,9, PA >14/9, FC >110) × corte do salão (febre >37,8, PA >16, FC >120). Não são inconsistência.
