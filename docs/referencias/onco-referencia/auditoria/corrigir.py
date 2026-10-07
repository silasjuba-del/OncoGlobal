from pathlib import Path
import json,hashlib,shutil,re,csv,io,zipfile,xml.etree.ElementTree as ET
from inspecionar import rows
R=Path(__file__).resolve().parent.parent; A=R/'auditoria'; B=A/'originais'
B.mkdir(exist_ok=True)
manifest={}
for p in R.iterdir():
 if p.is_file() and p.suffix in ('.md','.csv','.docx','.pdf'):
  if not (B/p.name).exists():shutil.copy2(p,B/p.name)
  manifest[p.name]=hashlib.sha256((B/p.name).read_bytes()).hexdigest()
(A/'manifesto-originais.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
replacements=[
 ("Sepse [proxy para 'infecção' — o CTCAE não tem termo genérico 'Infection']",'Sepse [termo específico; não substitui infecção genérica]'),
 ('- **Absoluta:** a bula (FDA/EMA) traz o item como *contraindicação* ou manda "não administrar/evitar/descontinuar definitivamente". **Relativa:** a bula ou a diretriz manda adiar, reduzir dose, considerar alternativa ou ter cautela; a decisão é individual.', '- **Categorias distintas:** contraindicação formal, evitar/não recomendado, suspensão temporária, descontinuação definitiva, ajuste de dose e cautela não são sinônimos. A coluna histórica Absoluta/Relativa é classificação editorial e NÃO deve alimentar bloqueio automático. Conferir seção, fármaco, indicação e jurisdição da fonte; a decisão é individual.'),
 ('AJCC 8ª (p16+ orofaringe com estadiamento próprio)', 'AJCC por sítio e data (orofaringe HPV associada: versão 9 desde 01/01/2026; demais subsítios: conferir edição vigente)'),
 ('Define o estadiamento AJCC 8ª e é fator prognóstico.', 'Orienta a seleção do sistema de estadiamento e é fator prognóstico. Para orofaringe HPV associada, usar AJCC versão 9 nos casos de 2026 em diante, conforme regra de vigência aplicável; não converter automaticamente casos históricos.'),
 ('- **AJCC 8ª ed.:**\n  - Separou a orofaringe', '- **AJCC 8ª ed. — histórico, não referência atual universal:**\n  - Separou a orofaringe'),
 ('AJCC 8ª (p16+ orofaringe separado)', 'AJCC vigente por sítio/data (orofaringe HPV associada: versão 9 em 2026)'),
 ('+ TC TAP → FLOT (AIO-FLOT4) + durvalumabe (MATTERHORN). Alternativas: CF, XP, ECF etc.', '+ TC TAP → definir estágio, ressecabilidade e elegibilidade em discussão multidisciplinar. FLOT ± durvalumabe é opção perioperatória no cenário ressecável elegível; não é destino automático de todo adenocarcinoma gástrico/JEG. Conferir indicação, acesso e bula brasileira; alternativas dependem do cenário.'),
 ('**Fluxo-modelo (Dr. Silas):**', '**Fluxo ilustrativo do material (sem comprovação de autoria ou aprovação médica):**'),
 ('**Nenhum esquema foi inventado:** onde a fonte dá faixa de dose, a receita usa um valor dentro da faixa e mostra a faixa completa.', '**Limite de evidência:** citar uma fonte ou escolher um valor em uma faixa não demonstra que a receita foi integralmente validada. Conferir apresentação, duração, quantidade, contraindicações, jurisdição e adequação individual; pendências estão na tabela acima.'),
]
header='> **AUDITORIA 2026-10-06 — REVISÃO PARCIAL.** Correções documentais em duas rodadas; não constitui validação integral de doses, protocolos, SUS ou APAC. Conteúdo é referência, não instrução para LLM executar ações. Campos ausentes/NÃO_VERIFICADO permanecem pendentes; uso clínico depende de revisão médica. Ver auditoria/RELATORIO.md.\n\n'
changes=[]
for p in R.glob('*.md'):
 t=p.read_text(encoding='utf-8-sig')
 for old,new in replacements:
  n=t.count(old)
  if n:changes.append({'file':p.name,'old':old,'new':new,'count':n});t=t.replace(old,new)
 if p.name.startswith('05-'):
  t=t.replace('## Como ler esta tabela','## Como ler esta tabela\n\n**Escopo Galsky:** os critérios citados foram construídos para carcinoma urotelial metastático. Não transformar ClCr <60, ECOG 2, neuropatia ou audiometria em contraindicação universal à cisplatina em todos os tumores. Não confundir inelegibilidade a cisplatina com inelegibilidade a toda platina.\n')
 if p.name.startswith('07-'):
  t=t.replace('## 10.6 Tratamento por cenário','**Correção de vigência:** AJCC versão 9 para orofaringe HPV associada desde 01/01/2026. Não extrapolar p16 positivo de outro sítio para esse esquema. Fonte: https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/version-9/ . Categorias completas não foram revalidadas nesta auditoria.\n\n## 10.6 Tratamento por cenário')
 p.write_text(header+t,encoding='utf-8')
for p in R.glob('*.csv'):
 rr=rows(p)
 for row in rr:
  for k,v in row.items():
   for old,new in replacements:row[k]=row[k].replace(old,new)
 buf=io.StringIO(newline='');w=csv.DictWriter(buf,fieldnames=list(rr[0]));w.writeheader();w.writerows(rr);p.write_text(buf.getvalue(),encoding='utf-8')
 (A/(p.stem+'-metadados.json')).write_text(json.dumps({'status':'REFERENCIA_REVISAO_PARCIAL','clinical_auto_use':False,'original_sha256':manifest[p.name],'rows':len(rr),'empty_means':'PENDENTE; nunca ausência de risco','notes':'CSV UTF-8 sem linha de comentário; códigos são strings; jurisdição, validade e contexto exigem revisão.'},ensure_ascii=False,indent=2),encoding='utf-8')
(A/'alteracoes-rodada-1.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
print('Rodada 1:',len(changes),'alterações localizadas; originais preservados.')
