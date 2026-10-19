from pathlib import Path
import json,hashlib,math
from PIL import Image
import numpy as np
p=Path('.');sha=lambda b:hashlib.sha256(b).hexdigest()
b=json.loads((p/'tmp/map86-before/verification.json').read_text());a=json.loads((p/'tmp/map86-final/verification.json').read_text())
assert b['indexSha256']==sha((p/'tmp/map86-dist85/index.html').read_bytes())
assert a['indexSha256']==sha((p/'packages/web/dist/index.html').read_bytes())
assert len(a['rows'])==len(b['rows'])==4
rows=[]
def layers(s):
 depth=0;start=0;out=[]
 for i,c in enumerate(s):
  if c=='(':depth+=1
  elif c==')':depth-=1
  elif c==',' and depth==0:out.append(s[start:i].strip());start=i+1
 return out+[s[start:].strip()]
for x,y in zip(b['rows'],a['rows']):
 assert x['config']==y['config'];assert x['facts']==y['facts'],x['config']
 u=dict(x['details']);v=dict(y['details']);bg=u.pop('mapBackdrop');after=v.pop('mapBackdrop');assert u==v,('foreground',x['config'])
 assert len(bg)==len(after)==1;assert bg[0]['rect']==after[0]['rect'];assert bg[0]['single']==after[0]['single']=='true'
 old=layers(bg[0]['image']);new=layers(after[0]['image'])
 if x['config']=='native-dark':assert len(old)==4 and new==old[:3]
 else:assert bg==after,('guard',x['config'])
 im=np.array(Image.open(p/'tmp/map86-before'/x['filename']).convert('RGB')).astype('int16');other=np.array(Image.open(p/'tmp/map86-final'/y['filename']).convert('RGB')).astype('int16');delta=abs(im-other);changed=np.any(delta,axis=2);rect=bg[0]['rect'];outside=changed.copy();outside[max(0,math.floor(rect['y'])-2):math.ceil(rect['bottom'])+2,max(0,math.floor(rect['x'])-2):math.ceil(rect['right'])+2]=False
 strict=changed.copy();strict[max(0,math.floor(rect['y'])):math.ceil(rect['bottom']),max(0,math.floor(rect['x'])):math.ceil(rect['right'])]=False
 rows.append({'config':x['config'],'actualFactsEqual':True,'foregroundGeometryAndPathsEqual':True,'oldBackgroundLayers':len(old),'newBackgroundLayers':len(new),'changedPixels':int(changed.sum()),'outsideHalfOpenMapRectPixels':int(strict.sum()),'outsideMapWith2pxPaintMarginPixels':int(outside.sum()),'maxChannelDelta':int(delta.max())})
result={'beforeIndexSha256':b['indexSha256'],'afterIndexSha256':a['indexSha256'],'scope':'Four compiled Overview states, exact foreground facts/node geometry/edge identities and paths; whole-image pixel differences recorded without masks; localization separately reports half-open DOM rect and2px paint-margin rect, not an acceptance mask; not full Source acceptance','rows':rows}
(p/'tmp/map86-comparison.json').write_bytes((json.dumps(result,indent=2)+'\n').encode());print(json.dumps(result,indent=2))
