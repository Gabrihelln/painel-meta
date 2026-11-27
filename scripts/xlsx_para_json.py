"""Converte a planilha exportada da Wiapy (.xlsx) em JSON (só biblioteca padrão do Python).
Uso: python scripts/xlsx_para_json.py arquivo.xlsx > saida.json
"""
import sys, zipfile, re, json
import xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def read(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    sheets=[n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml',n)]
    root=ET.fromstring(z.read(sorted(sheets)[0]))
    rows=[]
    for r in root.iter('{%s}row'%NS['m']):
        row={}
        for c in r.findall('m:c',NS):
            ref=c.get('r'); col=re.match(r'[A-Z]+',ref).group(0)
            t=c.get('t'); v=c.find('m:v',NS)
            if t=='s' and v is not None: val=ss[int(v.text)]
            elif t=='inlineStr': val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
            else: val=v.text if v is not None else None
            row[col]=val
        rows.append(row)
    cols=sorted({k for r in rows for k in r}, key=lambda s:(len(s),s))
    return [[r.get(k) for k in cols] for r in rows]
if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(read(sys.argv[1]),ensure_ascii=False))
