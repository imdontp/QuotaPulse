from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
out=Path('tmp/main-heading56-comparison');out.mkdir(exist_ok=True)
regions={'live':(289,80,457,113),'models':(286,80,369,111),'alerts':(306,80,553,114)};metrics={};inputs={}
for route,roi in regions.items():
 paths={'source':Path(f'docs/redesign-v1.85.43/refs/{route}.png'),'before':Path(f'docs/redesign-v1.85.55/native-en-dark/{route}-default.png'),'after':Path(f'tmp/main-heading56-all8-en-dark/{route}-default.png')}
 ims={k:Image.open(p).convert('RGB') for k,p in paths.items()};inputs[route]={k:{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in paths.items()}
 box=(240,70,860,132);c=Image.new('RGB',(1860,82),'#07101b');d=ImageDraw.Draw(c)
 for i,(k,im) in enumerate(ims.items()):d.text((i*620+4,2),k,fill='white');c.paste(im.crop(box),(i*620,20))
 c.save(out/f'{route}.png');metrics[route]={}
 for k,im in ims.items():
  a=np.asarray(im.crop(roi));mask=(a.astype(float)@np.array([.2126,.7152,.0722])>=175)&(a[:,:,0]>=150);y,x=np.where(mask);metrics[route][k]={'bounds':[int(x.min()+roi[0]),int(y.min()+roi[1]),int(x.max()+roi[0]),int(y.max()+roi[1])],'pixels':int(mask.sum()),'density':float(mask.sum()/((x.max()-x.min()+1)*(y.max()-y.min()+1)))}
 if route=='alerts':
  b=(1228,308,1646,395);c=Image.new('RGB',(1254,107),'#07101b');d=ImageDraw.Draw(c)
  for i,(k,im) in enumerate(ims.items()):d.text((i*418+4,2),k,fill='white');c.paste(im.crop(b),(i*418,20))
  c.save(out/'warning.png')
  boxes=json.loads(Path('tmp/alerts-warning-paint56/measurements.json').read_text())['regions'];wm={}
  for name,(x,y,w,h) in boxes.items():
   wm[name]={k:np.median(np.asarray(im.crop((x,y,x+w,y+h))).reshape(-1,3),axis=0).tolist() for k,im in ims.items()}
index=hashlib.sha256(Path('packages/web/dist/index.html').read_bytes()).hexdigest();assert json.loads(Path('tmp/main-heading56-all8-en-dark/geometry.json').read_text())['productionIndexSha256']==index
meta={'index':index,'inputs':inputs,'rois':regions,'titles':metrics,'warningRegionMedians':wm,'method':'Shared title ROI, luma>=175 and red>=150; inclusive bounds. Live BEFORE ROI truncates its old wider title and capitalization differs: do not use that before width/density as exact parity. Source/after words match. Warning medians use four paired blank rectangles from measured56 audit.'}
(out/'measurements.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');print(json.dumps({'titles':metrics,'warningMedians':wm},indent=2))
