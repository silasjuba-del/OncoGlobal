# F1 · Decisões e pendências que ficam com o Dr. Silas (gerado em 2026-10-11)

Fonte: campos `conflitos` (com `decisaoNecessaria: true`) e `pendencias` (classes `DECISAO_CLINICA_DR_SILAS` e `DEPENDE_BULA_ANVISA`) dos packs v2 de oncologia clínica. Hematologia e radioterapia estão marcadas como aceno geral e ficaram fora desta lista, por decisão do Dr. Silas.

## bexiga

- **Conflito:** Dose da BCG — escolha de segurança registrada: MOC: 81 mg por 6 semanas + manutenção. Não substitui a bula da cepa (NÃO VERIFICADA).
- **DEPENDE_BULA_ANVISA:** BCG: dose depende da cepa (SBOC 120 mg/40 mg EORTC × aula PRO Connaught 81 mg/Tice 50 mg); esquema de indução/manutenção sem fonte SBOC — conferir bula da cepa disponível no SUS.
- **DEPENDE_BULA_ANVISA:** PD-L1: corte e clone para pembrolizumabe 1ª linha não definidos na SBOC; conferir bula ANVISA (aula PRO: CPS ≥ 10 para pembrolizumabe).
- **DECISAO_CLINICA_DR_SILAS:** Seguimento pós-cistectomia, pós-trimodal e da doença avançada: periodicidade sem fonte na SBOC 2026.

## esofago

- **Conflito:** Dose de RT na QT/RT neoadjuvante — escolha de segurança registrada: 50,4 Gy fica restrito à QT/RT definitiva; CROSS neoadjuvante = 41,4 Gy. A tabela de doença localmente avançada (p.17) reaproveita os esquemas definitivos sem dose de RT: para cisplatina+5-FU e mFOLFOX4 neoadjuvantes, RT = null (SEM_FONTE). 

## gastrico

- **Conflito:** mDCF: dia da cisplatina e 5-FU (SBOC × MOC/Shah) — escolha de segurança registrada: Doses totais coincidem; diverge o dia da cisplatina (D2 × D3). Manter a SBOC até decisão.

## gliomas

- **Conflito:** Fracionamento da RT no astrocitoma IDH-mutado graus 3-4 — escolha de segurança registrada: Manter 59,4 Gy e deixar frações em aberto para o radio-oncologista; 33 frações (1,8 Gy/fr) é a forma clássica e menos intensa por fração
- **DECISAO_CLINICA_DR_SILAS:** Reirradiação (aceno de RT) e platina na recorrência ficam fora como protocolo. TMZ protraída 50 mg/m² resolvida por D-F1-17 34B (gliomas-tmz-protraida-recorrencia).

## mama

- **DEPENDE_BULA_ANVISA:** Doses dos protocolos metastáticos novos vêm de rótulo FDA/ensaio; conferir bula ANVISA das apresentações disponíveis.

## pancreas

- **Conflito:** Duração da infusão de 5-FU (48 h na SBOC pâncreas × 46 h na SBOC vias biliares) — escolha de segurança registrada: Mantido 48 h no pack de pâncreas conforme a fonte do tumor; registrar para padronização da ficha do serviço.
- **DEPENDE_BULA_ANVISA:** Olaparibe: dose de bula FDA (openFDA); bula ANVISA não consultada

## penis

- **DECISAO_CLINICA_DR_SILAS:** Conduta específica para cN1 vem só da aula PRO (CURSO/INFERIDO); SBOC não detalha cN1 isoladamente.
- **DECISAO_CLINICA_DR_SILAS:** Tabela de seguimento (SBOC p.15) para pN+ tem leitura ambígua quanto à imagem no 3º–5º ano.
- **DEPENDE_BULA_ANVISA:** 5-FU creme e imiquimode creme (Ta/Tis): unidade '% creme' e via 'topica' fora do enum numérico usual; cobertura SUS não verificada; bula FDA do imiquimode exclui pele anogenital no sBCC (off-label).

## prostata

- **DEPENDE_BULA_ANVISA:** Doses de agonistas/antagonistas LHRH tiradas de bula FDA (openFDA); confirmar com bula ANVISA das apresentações disponíveis no serviço. Indicação de bula = câncer de próstata avançado; uso com RT no localizado sustentado pela SBOC (classe e duração).
- **DECISAO_CLINICA_DR_SILAS:** Definição de alto risco mHSPC (SBOC p.10) impressa como 'Gleason > 8' e '3 lesões ósseas' — conferir com o PDF/LATITUDE (Gleason ≥ 8, ≥ 3 lesões). Texto extraído do PDF confirma a grafia da SBOC (p.10).

## sarcomas

- **DECISAO_CLINICA_DR_SILAS:** Sem id no catálogo v1.1: USG de partes moles, RM de membro, RX de segmento ósseo, NGS/TMB e testes germinativos (códigos SIGTAP anotados nos itens). Inclusão depende de D-F1-02.

## testiculo

- **DEPENDE_BULA_ANVISA:** Audiometria (cisplatina) e ajuste renal da bleomicina apoiados em rótulo FDA (openFDA); bula ANVISA não consultada

