from pathlib import Path
import csv,io,json,hashlib,re,openpyxl
ROOT=Path(__file__).resolve().parent.parent
def rows(p):
    return list(csv.DictReader(io.StringIO('\n'.join(x for x in p.read_text(encoding='utf-8-sig').splitlines() if not x.startswith('#')))))
def norm(s):return re.sub(r'\s+',' ',str(s or '-')).strip()
official={str(r[0]):r for r in list(openpyxl.load_workbook(ROOT/'auditoria/ctcae-v6.0-oficial.xlsx',data_only=True)['CTCAE v6.0 Clean Copy'].values)[1:]}
diff=[]
fields={'soc_en':1,'term_en':2,'grade1_en':3,'grade2_en':4,'grade3_en':5,'grade4_en':6,'grade5_en':7,'definition_en':8,'nav_note_en':9,'v6_change_en':10}
for r in rows(ROOT/'02-ctcae-v6.csv'):
    o=official.get(r['meddra_llt_code'])
    if not o:diff.append({'term':r['term_en'],'missing':True});continue
    for f,i in fields.items():
        if norm(r[f])!=norm(o[i]):diff.append({'term':r['term_en'],'field':f,'local':r[f],'official':o[i]})
out={'ctcae_rows':len(rows(ROOT/'02-ctcae-v6.csv')),'ctcae_differences':diff,'csv':{},'text_flags':{}}
for p in ROOT.glob('*.csv'):
    rr=rows(p); out['csv'][p.name]={'rows':len(rr),'malformed':sum(None in r or any(v is None for v in r.values()) for r in rr)}
for p in ROOT.glob('*.md'):
    t=p.read_text(encoding='utf-8-sig');out['text_flags'][p.name]={'unverified':len(re.findall('NÃO_VERIFICAD|não verificad|a conferir',t,re.I)),'replacement_char':t.count('\ufffd'),'urls':len(set(re.findall(r'https?://[^\s<>|)]+',t)))}
(ROOT/'auditoria/inspecao.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
