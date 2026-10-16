import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
p=Path(__file__).resolve().parent
cfg=json.loads((p/'frozen-rois.json').read_text());root=p.parent.parent
src=np.asarray(Image.open(root/cfg['source']['path']).convert('RGB')).astype(float)
def support(a,t):return (a[:,:,2]>t)&(a[:,:,2]>1.35*a[:,:,1])&(a[:,:,2]>1.6*a[:,:,0])
out={'frozenMaskSha256':cfg['maskSha256'],'scores':{}}
files=sys.argv[1:] or [cfg['baseline']['path']]
for f in files:
 a=np.asarray(Image.open(root/f).convert('RGB')).astype(float);rows=[]
 for dx,dy in cfg['registrationOffsets']:
  q=np.roll(a,(dy,dx),(0,1));row={'dx':dx,'dy':dy,'regions':{}}
  for region in cfg['rectangles']:
   x0,y0,x1,y1=region['rect'];s=src[y0:y1,x0:x1];b=q[y0:y1,x0:x1];v={'rgbMAE':float(np.abs(s-b).mean()),'thresholds':{}}
   for t in [55,70,90]:
    ss=support(s,t);cs=support(b,t);z={'sourceSupport':int(ss.sum()),'candidateSupport':int(cs.sum())}
    if not ss.any() or not cs.any():z.update({'sourceRecall2':None if not ss.any() else 0,'symmetricMean':None,'symmetricP95':None,'emptyStatus':'both-empty' if not ss.any() and not cs.any() else 'source-empty-candidate-nonempty' if not ss.any() else 'candidate-empty-source-nonempty'})
    else:
     sd=distance_transform_edt(~cs)[ss];cd=distance_transform_edt(~ss)[cs];z.update({'sourceRecall2':float((sd<=2).mean()),'symmetricMean':float((sd.mean()+cd.mean())/2),'symmetricP95':float(max(np.percentile(sd,95),np.percentile(cd,95)))})
    v['thresholds'][str(t)]=z
   row['regions'][region['name']]=v
  rows.append(row)
 out['scores'][f]=rows
outpath=p/'scores.json';outpath.write_text(json.dumps(out,indent=2)+'\n',encoding='utf8')
print(str(outpath))
for name,rows in out['scores'].items():
 print(name)
 for n,v in next(z for z in rows if z['dx']==0 and z['dy']==0)['regions'].items():print(n,round(v['rgbMAE'],3),v['thresholds']['55'])
