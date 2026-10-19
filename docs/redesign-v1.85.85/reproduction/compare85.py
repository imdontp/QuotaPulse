from pathlib import Path
import json,re,hashlib
import numpy as np
from PIL import Image
p=Path('.'); sha=lambda b:hashlib.sha256(b).hexdigest()
b=json.loads((p/'tmp/source85-before/verification.json').read_text());a=json.loads((p/'tmp/source85-final/verification.json').read_text())
def normalized(s):
 ids=re.findall(r'\bid="([^"]+)"',s)
 for n,v in enumerate(ids):s=s.replace('id="'+v+'"','id="declared-'+str(n)+'"').replace('url(#'+v+')','url(#declared-'+str(n)+')')
 return s
rows=[]
for x,y in zip(b['rows'],a['rows']):
 assert (x['route'],x['config'])==(y['route'],y['config'])
 assert x.get('facts')==y.get('facts') and x.get('days')==y.get('days')
 r={'route':x['route'],'config':x['config'],'actualFactsEqual':True}
 if 'filename' in x:
  one=np.asarray(Image.open(p/'tmp/source85-before'/x['filename']).convert('RGB')).astype('int16');two=np.asarray(Image.open(p/'tmp/source85-final'/y['filename']).convert('RGB')).astype('int16');delta=np.abs(one-two)
  r.update(changedPixels=int(np.count_nonzero(np.any(delta,axis=2))),maxChannelDelta=int(delta.max()),rgbMAE=float(delta.mean()))
 if x['route']=='projects':
  u=x['details']['sparks'];v=y['details']['sparks'];assert len(u)==len(v)
  assert [q['rect'] for q in u]==[q['rect'] for q in v]
  assert [normalized(q['markup']) for q in u]==[normalized(q['markup']) for q in v]
  r.update(observedSparkGeometryEqual=True,observedSparkMarkupEqualIgnoringOnlyGeneratedIds=True,rawMarkupEqual=[q['markup'] for q in u]==[q['markup'] for q in v])
 rows.append(r)
out={'beforeIndex':b['indexSha256'],'afterIndex':a['indexSha256'],'markupNormalization':'Only declared SVG IDs and matching url references canonicalized by declaration order; actual points/values/paint definitions retained. No image mask.','rows':rows}
(p/'tmp/source85-comparison.json').write_bytes((json.dumps(out,indent=2)+'\n').encode())
print('Current scope comparison regenerated',len(rows),out['afterIndex'])
