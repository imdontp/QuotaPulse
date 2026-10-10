from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
base=Path(__file__).resolve().parents[2]
out=Path(__file__).parent
groups={}
report={'scope':'Diagnostic ROI comparison only; does not replace unmasked full case','groups':{},'historical':{},'crossComparisons':[]}
for folder in ['badge-counterfactual','badge-ellipse','badge-prepaint','badge-history']:
 p=out/folder/'records.json'
 if not p.exists():continue
 records=json.loads(p.read_text())
 for item in records['probeRecords']:
  state=item['state'];x,y,w,h=[int(state[k]) for k in ['x','y','width','height']]
  im=Image.open(p.parent/item['filename']).convert('RGBA')
  crop=im.crop((x,y,x+w,y+h));a=np.asarray(crop)
  item['bitmapSha256']=hashlib.sha256(a.tobytes()).hexdigest()
  groups.setdefault(folder+'-'+item['radius']+('-'+item['history'] if 'history' in item else ''),[]).append((item,a))
 for key in ['pageErrors','externalRequests','writeRequests','httpErrors']:report.setdefault(key,[]).extend(records[key])
for radius,items in groups.items():
 first=items[0][1];var=np.zeros(first.shape[:2],bool);maxDelta=0
 for item,a in items:
  d=np.abs(a.astype(int)-first.astype(int));var|=(d.max(2)>0);maxDelta=max(maxDelta,int(d.max()))
 report['groups'][radius]={'freshProcesses':len(set(i['index'] for i,a in items)),'frames':len(items),'badgeUniqueBitmapHashes':sorted(set(i['bitmapSha256'] for i,a in items)),'fullPageUniqueHashes':len(set(i['fullPageSha256'] for i,a in items)),'variedBadgePixels':int(var.sum()),'maxDelta':maxDelta,'variedCoordinates':np.argwhere(var).tolist(),'domInputsStable':all(i['state']==items[0][0]['state'] for i,a in items)}
 Image.fromarray(first).resize((400,360)).save(out/(radius.replace('%','pct')+'-badge.png'))
hist=[]
for name in ['live-th-dark.png','repeat-live-th-dark.png']:
 im=Image.open(base/'tmp/reference-50-replay-failure'/name).convert('RGBA');a=np.asarray(im.crop((183,327,203,345)))
 report['historical'][name]={'badgeBitmapSha256':hashlib.sha256(a.tobytes()).hexdigest()};hist.append((name,a))
 Image.fromarray(a).resize((400,360)).save(out/('historical-'+name))
for radius,items in groups.items():
 for name,histA in hist:
  d=np.abs(items[0][1].astype(int)-histA.astype(int));report['crossComparisons'].append({'radius':radius,'historical':name,'changedPixels':int((d.max(2)>0).sum()),'maxDelta':int(d.max()),'points':[[int(x),int(y),int(d[y,x].max())] for y,x in np.argwhere(d.max(2)>0)]})
d=np.abs(hist[0][1].astype(int)-hist[1][1].astype(int));report['historicalDiff']={'pixels':int((d.max(2)>0).sum()),'maxDelta':int(d.max()),'points':[[int(x),int(y),int(d[y,x].max())] for y,x in np.argwhere(d.max(2)>0)]}
(out/'badge-analysis.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
