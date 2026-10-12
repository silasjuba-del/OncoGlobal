# F1 · Prompt: auditoria das 50 receitas validadas (averiguação por LLM)

Referências: `docs/ondas/F1-CORPUS-BUSCAS-CONSOLIDADAS.md` (buscas consolidadas, GLM, 2 loops) e `docs/ondas/F1-CORPUS-PROMPTS.md` frente 3. As 50 receitas são as do Dr. Silas, validadas fora do repo; este prompt as coloca sob averiguação **antes** de entrarem como corpus. A LLM que audita não redige receita e não corrige dose: só aponta divergência com fonte. A palavra final é sempre do Dr. Silas.

Sugestão de alocação seguindo o padrão do repo (quem escreve ≠ quem revisa): auditoria pelo **DeepSeek** (dono da frente RECEITAS) com revisão do relatório por outra LLM; ou qualquer LLM com acesso às fontes, desde que não seja quem redigiu as receitas.

---

## PROMPT (colar no chat da LLM auditora, junto com o anexo das 50 receitas)

```
[BLOCO COMUM do docs/ondas/F1-CORPUS-PROMPTS.md, com estas alterações:
- PAPEL: auditor de curadoria. Você NÃO redige receita, NÃO altera dose, NÃO corrige texto clínico; você averigua contra fonte e relata.
- SAÍDA: nenhum arquivo de corpus é escrito; a saída é o relatório de auditoria abaixo.]

REPO: silasjuba-del/OncoGlobal. Base: f1/integrado. Lei: AGENTS.md (PR #5).
FRENTE: AUDITORIA-50-RECEITAS (verificação, não redação).
ENTRADA: as 50 receitas validadas do Dr. Silas, fornecidas em anexo/coladas abaixo ({{RECEITAS_50}}). Trate-as como documento do médico: intocável.
BASE DE CRUZAMENTO (leia antes): docs/ondas/F1-CORPUS-BUSCAS-CONSOLIDADAS.md — §3.1 (interações com severidade/conduta e contraindicações com cortes confirmados), §4 (correções factuais), §5 (pendências SEM_FONTE).
FONTE: todo apontamento precisa de fonte real {tipo∈DECISAO_MEDICA|DIRETRIZ|NORMA|LITERATURA|BULA, referencia, trecho literal curto}. Sem fonte = campo null + pendencia:"SEM_FONTE". PROIBIDO inventar fonte, dose, corte ou artigo de lei. Bulas em português: priorizar ANVISA (portal ou espelho Consulta Remédios, re-verificáveis); SmPC/DailyMed como fallback, sempre dizendo qual.
PHI: nenhum. Se uma receita trouxer dado de paciente, denuncie no relatório e trate como item a sanitizar.

AVERIGUAÇÃO EM 2 PASSAGENS:
PASSAGEM 1 — CADA RECEITA ISOLADA (checklist de 8):
 1. Posologia × bula: dose, via, intervalo, duração — divergência exige trecho da bula.
 2. Ajuste renal/hepático: o fármaco pede? A receita prevê? Use os cortes consolidados (cisplatina ClCr<60, pemetrexede <45, capecitabina <30, doxorrubicina bilirrubina >5 não iniciar, carboplatina Calvert).
 3. Contraindicação/gestação: cruzar fármaco × §3.1 do documento-base.
 4. Apresentação no SUS: existe no RENAME? Se não, apontar SEM_CODIGO_SUS/análogo não disponível.
 5. Controle especial Portaria 344/98: a receita usa o tipo certo (A/B/C, duração de validade)?
 6. Orientação ao paciente: tem 1 frase, linguagem até 8ª série?
 7. Fonte declarada na própria receita: real e citável?
 8. Id único e header coerente com o padrão do corpus.
PASSAGEM 2 — CRUZAMENTO ENTRE RECEITAS E COM O KIT DO DIA (interações que só aparecem no conjunto):
 9. Pares de fármacos entre receitas concomitantes do mesmo paciente-tipo (ex.: antiemético+opioide, AINE+quimio, anticoagulante+capecitabina, ondansetrona quando há outro QT-longo no kit, tamoxifeno+antidepressivo).
10. Cada par achado: severidade ∈ {GRAVE, MODERADA, MENOR} + conduta em 1 frase + fonte (bula/diretriz). Pares já previstos no §3.1 do documento-base: citar a entrada em vez de re-buscar.

VEREDITO POR RECEITA: CONFORME | CONFORME_COM_RESSALVA | DIVERGE_FONTE | SEM_FONTE.
- CONFORME: 8/8 do checklist sem achado.
- CONFORME_COM_RESSALVA: falha formal (orientação ausente, id, RENAME) sem risco clínico.
- DIVERGE_FONTE: dose/ajuste/contraindicação/interação diverge de fonte citada (anexe trecho).
- SEM_FONTE: item clínico sem fonte localizável.
Em nenhum caso a auditoria reescreve a receita; ação sugerida em 1 frase, decisão do Dr. Silas.

RELATÓRIO FINAL — docs/ondas/F1-CORPUS-AUDITORIA-50-RECEITAS.md:
 1. Tabela das 50: nº, fármacos, veredito, motivo em 1 linha, fonte do apontamento.
 2. Métricas AGREGATIVAS: % por veredito, taxa de cobertura do checklist (itens verificados/verificáveis), densidade de apontamentos por receita (média), distribuição por categoria (posologia/ajuste/interação/SUS/controle especial).
 3. Métricas SOMATÓRIAS: totais por veredito, total de apontamentos, total de fontes únicas citadas, total SEM_FONTE, total de pares de interação achados na passagem 2.
 4. Divergências clínicas primeiro (GRAVE antes), depois formais.
 5. Pendências SEM_FONTE e perguntas ao Dr. Silas em 1 frase cada.
NÃO FAZER: escrever em corpus/**, src/**, alterar as receitas, desligar testes, inferir dose "pelo senso clínico".
```

---

## Notas de uso

1. Anexar as 50 receitas no ponto `{{RECEITAS_50}}` (o repo não as contém hoje; quando entrarem, a auditoria roda contra `corpus/2-receitas/` diretamente).
2. As pendências SEM_FONTE do documento-base se aplicam: enquanto tamoxifeno×TEV, ODP e afins não tiverem fonte formal, apontamentos que dependam desses itens herdam a pendência — não complete por inferência.
3. Resultado da auditoria alimenta a frente 3 (DeepSeek) do `F1-CORPUS-PROMPTS.md`: só depois da decisão do Dr. Silas as receitas entram como corpus com `consultavel:true, alerta:false` até a promoção (D-F1-05).
