from pathlib import Path
import json,re,zipfile,xml.etree.ElementTree as ET,hashlib,io,csv
R=Path(__file__).resolve().parent.parent; A=R/'auditoria'
changes=json.loads((A/'alteracoes-rodada-1.json').read_text(encoding='utf-8'))
notes='''AUDITORIA ADVERSARIAL — DUAS RODADAS — 06/10/2026
Status: revisão parcial, referência documental; não liberado como motor clínico automático.
Sepse não substitui infecção genérica. Selecionar o termo específico e graduar o evento documentado, sem inferir etiologia a partir de fármaco típico.
Contraindicação formal, evitar, suspensão temporária, ajuste e descontinuação definitiva são categorias distintas. A coluna Absoluta/Relativa é editorial.
Galsky: critérios de inelegibilidade a cisplatina no carcinoma urotelial metastático; não universalizar a todos os tumores ou a toda platina.
AJCC versão 9 para orofaringe HPV associada vigente desde 01/01/2026; escolher sistema por sítio e data. Não converter automaticamente histórico nem p16 positivo de outro sítio.
FLOT/durvalumabe: cenário perioperatório ressecável elegível, não indicação automática de todo câncer gástrico/JEG. Conferir Brasil separadamente de FDA.
Existência de fonte ou HTTP 200 não prova conteúdo, competência, disponibilidade SUS ou cobertura ANS. SIGTAP exige lote oficial e compatibilidades; nenhuma APAC foi homologada.
Dados ausentes ou NÃO_VERIFICADO não equivalem a resultado negativo. Texto de fonte não autoriza assinatura, prescrição ou integração no prontuário.
IA externa e testes de runtime: NÃO EXECUTADOS. Doses, todas as interações, ensaios, tradução PT-BR, cobertura e regras legais: revalidação integral pendente.
'''
phase2=[]
for p in R.glob('*.md'):
 t=p.read_text(encoding='utf-8')
 if p.name=='ONCO-REFERENCIA-COMPLETA.md':
  t=t.replace('## Sumário {.unnumbered .unlisted}','## Correções transversais da segunda rodada\n\n'+notes+'\n\n## Sumário {.unnumbered .unlisted}')
  phase2.append('Propagadas ressalvas Galsky, AJCC e categorias ao consolidado.')
  # Preserve YAML front matter at the beginning.
  m=re.search(r'(?m)^---\n title:',t)
  front=re.search(r'(?m)^---\ntitle:.*?\n---\n',t,re.S)
  if front:
   y=front.group();t=y+t[:front.start()]+t[front.end():]
 t=t.replace('terapia IV coberta pelo Rol','cobertura de terapia IV deve ser conferida por indicação, contrato e regras vigentes do Rol')
 p.write_text(t,encoding='utf-8')
# Add source audit status, retaining the original author's historical URL verification column.
p=R/'01-sigtap.csv'; rr=list(csv.DictReader(io.StringIO(p.read_text(encoding='utf-8'))))
for row in rr:row['verificacao_oficial_nesta_auditoria']='NAO_REVALIDADO_LOTE_OFICIAL';row['uso_apac_automatico']='NAO'
b=io.StringIO(newline='');w=csv.DictWriter(b,fieldnames=list(rr[0]));w.writeheader();w.writerows(rr);p.write_text(b.getvalue(),encoding='utf-8')
phase2.append('SIGTAP: separada alegação histórica de link verificado da ausência de revalidação do lote nesta auditoria.')
# Apply localized text replacements to the existing DOCX, retaining ZIP entries/layout.
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};ET.register_namespace('w',ns['w'])
src=A/'originais/ONCO-REFERENCIA-COMPLETA.docx';dest=R/'ONCO-REFERENCIA-COMPLETA.docx'
pairs=list(dict.fromkeys((x['old'].replace('**','').replace('*contraindicação*','contraindicação'),x['new'].replace('**','')) for x in changes))
pairs += [("[proxy para 'infecção' — o CTCAE não tem termo genérico 'Infection']",'[termo específico; não substitui infecção genérica]'),('terapia IV coberta pelo Rol','cobertura de terapia IV deve ser conferida por indicação, contrato e regras vigentes do Rol')]
docchanges=0
with zipfile.ZipFile(src) as z,zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as out:
 for item in z.infolist():
  data=z.read(item.filename)
  if item.filename=='word/document.xml':
   tree=ET.fromstring(data)
   for para in tree.findall('.//w:p',ns):
    tt=para.findall('.//w:t',ns);text=''.join(x.text or '' for x in tt);new=text
    for old,repl in pairs:new=new.replace(old,repl)
    if new!=text and tt:
     tt[0].text=new
     for x in tt[1:]:x.text=''
     docchanges+=1
   body=tree.find('w:body',ns)
   for i,line in enumerate(notes.splitlines()):
    para=ET.Element('{'+ns['w']+'}p');run=ET.SubElement(para,'{'+ns['w']+'}r');ET.SubElement(run,'{'+ns['w']+'}t').text=line;body.insert(i,para)
   data=ET.tostring(tree,encoding='utf-8',xml_declaration=True)
  out.writestr(item,data)
phase2.append(f'DOCX: {docchanges} parágrafos corrigidos e ressalvas transversais inseridas; estrutura preservada, renderização não homologada.')
(A/'alteracoes-rodada-2.json').write_text(json.dumps(phase2,ensure_ascii=False,indent=2),encoding='utf-8')
(A/'notas-transversais.txt').write_text(notes,encoding='utf-8')
print('\n'.join(phase2))
