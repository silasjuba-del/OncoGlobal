from pathlib import Path
import zipfile,xml.etree.ElementTree as ET,re,json,hashlib,csv,io
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from xml.sax.saxutils import escape
from pypdf import PdfReader
R=Path(__file__).resolve().parent.parent; A=R/'auditoria'; w={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
p=R/'ONCO-REFERENCIA-COMPLETA.docx'
with zipfile.ZipFile(p) as z:entries=[(i,z.read(i.filename)) for i in z.infolist()]
for ix,(item,data) in enumerate(entries):
 if item.filename!='word/document.xml':continue
 x=ET.fromstring(data)
 for para in x.findall('.//w:p',w):
  tt=para.findall('.//w:t',w);text=''.join(t.text or '' for t in tt);new=re.sub(r'\[proxy para[^\]]+\]','[termo específico; não substitui infecção genérica]',text)
  if text.startswith('Absoluta: a bula') and 'ou manda' in text:new='Categorias distintas: contraindicação formal, evitar/não recomendado, suspensão temporária, descontinuação definitiva, ajuste e cautela não são sinônimos. A coluna Absoluta/Relativa é editorial e não autoriza bloqueio automático.'
  if new!=text and tt:
   tt[0].text=new
   for t in tt[1:]:t.text=''
 entries[ix]=(item,ET.tostring(x,encoding='utf-8',xml_declaration=True))
tmp=A/'consolidado.tmp.docx'
with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as z:
 for item,data in entries:z.writestr(item,data)
tmp.replace(p)
# Revised PDF is a text reflow, not a reproduction of original pagination.
pdfmetrics.registerFont(TTFont('ArialAudit',r'C:\Windows\Fonts\arial.ttf'))
styles=getSampleStyleSheet();style=ParagraphStyle('Audit',fontName='ArialAudit',fontSize=8.5,leading=12,spaceAfter=4,splitLongWords=True)
heading=ParagraphStyle('AuditHeading',parent=style,fontSize=12,leading=16,spaceBefore=10,spaceAfter=6)
story=[Paragraph('ONCO REFERÊNCIA — versão corrigida / auditoria parcial',heading),Paragraph('PDF recomposto a partir do Markdown corrigido. Paginação, tabelas e diagramação diferem do original. Original preservado em auditoria/originais.',style)]
t=(R/'ONCO-REFERENCIA-COMPLETA.md').read_text(encoding='utf-8')
for line in t.splitlines():
 if not line.strip():continue
 # Display all content, including URLs, without executing markup.
 line=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1 (\2)',line)
 line=line.replace('**','').replace('`','')
 story.append(Paragraph(escape(line),heading if line.startswith('#') else style))
def footer(c,d):
 c.setFont('ArialAudit',7);c.drawString(36,22,'Referência documental — revisão parcial — 06/10/2026');c.drawRightString(559,22,str(d.page))
SimpleDocTemplate(str(R/'ONCO-REFERENCIA-COMPLETA.pdf'),pagesize=(595,842),leftMargin=36,rightMargin=36,topMargin=36,bottomMargin=36).build(story,onFirstPage=footer,onLaterPages=footer)
checks=[]
def ck(name,ok):checks.append({'id':name,'status':'PASS' if ok else 'FAIL'})
for p in R.glob('*.md'):
 text=p.read_text(encoding='utf-8');ck(p.name+':UTF8', '\ufffd' not in text);ck(p.name+':sem-proxy', 'proxy para' not in text);ck(p.name+':ressalva', 'REVISÃO PARCIAL' in text)
for p,n in [(R/'01-sigtap.csv',52),(R/'02-ctcae-v6.csv',55),(R/'03-interacoes-qt.csv',30)]:
 rr=list(csv.DictReader(io.StringIO(p.read_text(encoding='utf-8'))));ck(p.name+':parse-contagem',len(rr)==n and all(None not in row and all(v is not None for v in row.values()) for row in rr));ck(p.name+':cabecalho-importavel',not p.read_text(encoding='utf-8').startswith('#'))
z=zipfile.ZipFile(R/'ONCO-REFERENCIA-COMPLETA.docx');ck('DOCX:ZIP',z.testzip() is None);x=ET.fromstring(z.read('word/document.xml'));doc=' '.join(a.text or '' for a in x.findall('.//w:t',w));ck('DOCX:sem-proxy','proxy para' not in doc);ck('DOCX:sem-legendaconflitante','contraindicação ou manda' not in doc)
pdf=PdfReader(R/'ONCO-REFERENCIA-COMPLETA.pdf');first=pdf.pages[0].extract_text();ck('PDF:legivel-com-ressalva','auditoria parcial' in first.lower());ck('Consolidado:Galsky','Galsky: critérios' in t);ck('SIGTAP:uso-automatico-nao',all(r['uso_apac_automatico']=='NAO' for r in list(csv.DictReader(io.StringIO((R/'01-sigtap.csv').read_text(encoding='utf-8'))))))
results={'checks':checks,'passed':sum(c['status']=='PASS' for c in checks),'failed':sum(c['status']=='FAIL' for c in checks),'pdf_pages':len(pdf.pages),'runtime_llm':'NOT_RUN','clinical_full_validation':'PARTIAL'}
(A/'verificacao-rodada-2.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in results.items() if k!='checks'},ensure_ascii=False))
assert results['failed']==0
