# Tipologia documental · 3 kits reais de primeira consulta (desidentificados) · 2026-10-08

> Fonte: 3 PDFs do Dr. Silas (37 páginas), lidos só para conhecer a **tipologia** do que entra no app ("teste apenas"). Nenhum identificador aqui: casos = Kit A/B/C, datas relativas à consulta (D0). O resumo clínico em si será feito no chat, com a skill de resumo do Dr. Silas (template/prompt em uso há mais de 1 ano).

## Padrão comum
O kit começa por um bloco administrativo (ficha de recepção, SISREG, RG/SUS/CPF, conta de luz) e depois vem um bloco clínico fora de ordem. O resumo do encaminhador (relatório CRE) é o único texto que junta tudo, mas cita exames sem anexar o laudo. Nenhum dos 3 kits traz APAC, receita, laboratório com laudo original, NGS, PET ou relatório cirúrgico. O CID do SISREG foi **R63.8 nos 3** (próstata, tireoide e esôfago).

| | Kit A | Kit B | Kit C |
|---|---|---|---|
| Sítio / cenário | Próstata, risco intermediário, possível lesão óssea; encaminhado para TDA+RT | Tireoide, Bethesda III; diagnóstico **não confirmado** | Esôfago CEC, avaliar neoadjuvância; achado incidental em parótida |
| Páginas | 11 | 12 | 14 |
| Páginas administrativas com dados pessoais | 3 | 4 | 5 (+1 em branco) |
| Laudos originais | USG, AP (2 pág.), IHQ, cintilografia, parecer cardiológico | USG (2 pág.), PAAF (×2) | USG ×2, citologia, TC crânio, TC tórax, EDA |
| Só citados, sem laudo | PSA, RM | 2ª USG | AP (CEC), TC de abdome |
| Manuscrito / riscado | assinatura | círculo no nódulo, data reescrita, texto riscado | correção de nome, telefones |
| Duplicatas | AP quebrado em 2 páginas | PAAF ×2; bloco da USG ×2 | página em branco |
| Conflito principal | cT2**N1**M0 sem achado nodal; M0 × cintilografia suspeita; volume prostático 36 cm³ (USG) × 85 g (RM) | lateralidade dentro da PAAF (esquerdo × direito); 2 USGs discordantes com ~1 semana | data da EDA 2 anos no futuro; esôfago médio (EDA) × distal (TC); 2º sítio |
| ECOG | 1 (X em formulário) | 1, conflitando com o texto | 1 |

## Armadilhas por kit
- **A:** parecer cardiológico sem data e com plano superado (prostatectomia); o AP diz "ASAP" e a IHQ (+11 dias) confirma adenocarcinoma, então a IHQ substitui o AP. Cabeçalho da cintilografia com **login e senha** de portal. Grafia do nome varia entre os documentos.
- **B:** hipótese "neoplasia" com citologia indeterminada; "sem queixas" × "dor à deglutição há 7 meses"; a especialidade do relatório (cirurgia de cabeça e pescoço) ≠ agenda (oncologia clínica); conta de luz em nome de terceiro; o círculo manuscrito marca o nódulo relevante, mas não é OCR-ável.
- **C:** AP e TC de abdome só citados ("SED" = sigla local); HAS(−)/DM(−) e "comorbidade: arritmia" no mesmo formulário; peças antigas não oncológicas (TC crânio, USG abdome) misturadas à linha do tempo; placeholder de template visível na ficha.

## 10 lições para "caixa de entrada → resumo → revisão médica"
1. **Classificar cada página antes de extrair.** De 30 a 40% são administrativas: descartar ou mascarar antes de qualquer LLM ou armazenamento.
2. **CID do SISREG = regulação, nunca diagnóstico** (reforça a skill SILAS NEGRÃO).
3. **Laudo original × citação no relatório:** cada dado leva proveniência. Exame só citado vira pendência ("trazer laudo").
4. **Deduplicar** páginas repetidas, laudo quebrado entre páginas e laudo transcrito no relatório (agrupar por tipo, data e serviço).
5. **Lateralidade e topografia = conflito obrigatório** (G-07); nunca escolher um lado sozinho.
6. **Validar datas:** futura, ausente ou ano errado. A linha do tempo segue a data do exame, não a ordem das páginas; sem data = "data desconhecida".
7. **Estadiamento e hipótese do encaminhador × laudos:** mostrar como "afirmado pelo encaminhador" e sinalizar a divergência (N1 sem base; "neoplasia" com Bethesda III).
8. **Tumor-índice × outros achados:** vários sítios e incidentais não se misturam (Warthin de parótida × CEC de esôfago).
9. **OCR robusto:** página rodada, margem ou topo cortado, entidades HTML quebradas, checkbox (X do ECOG), manuscrito sobre o laudo. O manuscrito vira **sinal visual** para o médico, não texto.
10. **Varrer segredos e identificadores:** login e senha de portais, telefones manuscritos, conta de terceiro. Mascarar antes de persistir. Laboratório e estadiamento faltam com frequência (vazio = PENDENTE).
