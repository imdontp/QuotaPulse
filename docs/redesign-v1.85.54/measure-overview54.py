from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
out=Path('tmp/overview-heading54-refined-comparison');out.mkdir(exist_ok=True)
paths={'source':Path('docs/redesign-v1.85.43/refs/overview.png'),'before':Path('docs/redesign-v1.85.52/menus/overview-default-en-dark.png'),'after':Path('tmp/overview-heading54-en-dark/overview-default.png')}
ims={k:Image.open(p).convert('RGB') for k,p in paths.items()}
regions={'core':(230,72,520,114),'runtime':(230,475,540,518),'runway':(238,718,530,758),'insights':(958,718,1280,758)}
rois={'core':(270,80,352,107),'runtime':(269,483,403,512),'runway':(277,722,384,752),'insights':(991,720,1105,752)}
metrics={}
for name,box in regions.items():
 w=box[2]-box[0];h=box[3]-box[1];canvas=Image.new('RGB',(w*3,h+22),'#07101b');d=ImageDraw.Draw(canvas)
 for i,(k,im) in enumerate(ims.items()):
  d.text((i*w+4,3),k,fill='#d4e8ff');canvas.paste(im.crop(box),(i*w,22))
 canvas.resize((w*6,(h+22)*2)).save(out/f'{name}.png')
 metrics[name]={};x,y,r,b=rois[name]
 for k in ['source','after']:
  a=np.asarray(ims[k].crop(rois[name]));luma=a.astype(float)@np.array([.2126,.7152,.0722]);mask=(luma>=175)&(a[:,:,0]>=150);yy,xx=np.where(mask)
  metrics[name][k]={'bounds':[int(xx.min()+x),int(yy.min()+y),int(xx.max()+x),int(yy.max()+y)],'pixels':int(mask.sum()),'density':float(mask.sum()/((xx.max()-xx.min()+1)*(yy.max()-yy.min()+1)))}
meta={'index':hashlib.sha256(Path('packages/web/dist/index.html').read_bytes()).hexdigest(),'inputs':{k:{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in paths.items()},'titleMasks':metrics,'titleROIs':rois,'method':'Common documented ROI; relative-luma>=175 AND red>=150 pixels and inclusive bounds. Runway ROI begins at277 to exclude adjacent source gauge/glow ink at274. All other ROIs use the same luma/red cutoff. Raster diagnostic only, not full source acceptance.'}
(out/'measurements.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');print(json.dumps({'index':meta['index'],'titleMasks':metrics},indent=2))
