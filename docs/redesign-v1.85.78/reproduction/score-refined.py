import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
root=Path(__file__).resolve().parent.parent
cfg=json.loads((root/'tmp/pulse78-mask.json').read_text())
src=np.array(Image.open(root/cfg['reference']).convert('RGB')).astype(float)
fullmask=np.array(Image.open(root/'tmp/pulse78-mask.png'))>0
def support(a,t):
    return (a[:,:,2]>t)&(a[:,:,2]-a[:,:,0]>35)&(a[:,:,2]-a[:,:,1]>5)
out={'mask':'tmp/pulse78-mask.png','thresholds':[80,90,110],'registrationShifts':[-1,0,1],'scores':{}}
for name in (sys.argv[1:] or ['baseline','source-traced-refined']):
    arr=np.array(Image.open(root/f'tmp/pulse78-refined/{name}.png').convert('RGB')).astype(float)
    results=[]
    for dy in [-1,0,1]:
      for dx in [-1,0,1]:
        shifted=np.roll(arr,(dy,dx),(0,1))
        row={'dx':dx,'dy':dy,'wings':{}}
        for wing,(x0,y0,x1,y1) in zip(['left','right'],cfg['includeRectangles']):
          m=fullmask[y0:y1,x0:x1]
          a=src[y0:y1,x0:x1]
          b=shifted[y0:y1,x0:x1]
          stat={'rgbMAE':float(np.abs(a[m]-b[m]).mean()),'pixels':int(m.sum()),'thresholds':{}}
          for t in [80,90,110]:
            ss=m&support(a,t); cs=m&support(b,t)
            if not cs.any() or not ss.any(): raise ValueError('empty support failure')
            dc=distance_transform_edt(~cs); ds=distance_transform_edt(~ss)
            sd=dc[ss]; cd=ds[cs]
            stat['thresholds'][str(t)]={'sourceSupport':int(ss.sum()),'candidateSupport':int(cs.sum()),'sourceRecall1':float((sd<=1).mean()),'sourceRecall2':float((sd<=2).mean()),'sourceRecall3':float((sd<=3).mean()),'sourceDistanceMean':float(sd.mean()),'candidateDistanceMean':float(cd.mean()),'symmetricMean':float((sd.mean()+cd.mean())/2),'symmetricP95':float(max(np.percentile(sd,95),np.percentile(cd,95)))}
          row['wings'][wing]=stat
        results.append(row)
    out['scores'][name]=results
(root/'tmp/pulse78-refined-scores.json').write_text(json.dumps(out,indent=2))
for name,rows in out['scores'].items():
    print(name)
    for wing in ['left','right']:
        r=next(x for x in rows if x['dx']==0 and x['dy']==0)['wings'][wing]
        s=r['thresholds']['90']
        print(wing,'MAE',round(r['rgbMAE'],3),'recall2',round(s['sourceRecall2'],4),'symMean',round(s['symmetricMean'],3),'p95',round(s['symmetricP95'],3))
