from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
out=Path('tmp/page-heading55-comparison');out.mkdir(exist_ok=True)
rois={'projects':(300,74,450,110),'history':(300,75,470,110),'providers':(294,76,800,119),'cost':(274,76,430,119)}
metrics={};inputs={}
for route,roi in rois.items():
 paths={'source':Path(f'docs/redesign-v1.85.43/refs/{route}.png'),'before':Path(f'docs/redesign-v1.85.52/menus/{route}-default-en-dark.png'),'after':Path(f'tmp/page-heading55-quick-en-dark/{route}-default.png')}
 ims={k:Image.open(p).convert('RGB') for k,p in paths.items()};assert len({im.size for im in ims.values()})==1
 inputs[route]={k:{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in paths.items()}
 box=(roi[0]-50,64,max(roi[2]+30,700),134);w=box[2]-box[0];h=box[3]-box[1];canvas=Image.new('RGB',(w*3,h+22),'#07101b');d=ImageDraw.Draw(canvas)
 for i,(k,im) in enumerate(ims.items()):d.text((i*w+4,3),k,fill='#d4e8ff');canvas.paste(im.crop(box),(i*w,22))
 canvas.save(out/f'{route}.png');metrics[route]={}
 for k,im in ims.items():
  a=np.asarray(im.crop(roi));lum=a.astype(float)@np.array([.2126,.7152,.0722]);mask=(lum>=175)&(a[:,:,0]>=150);yy,xx=np.where(mask)
  metrics[route][k]={'bounds':[int(xx.min()+roi[0]),int(yy.min()+roi[1]),int(xx.max()+roi[0]),int(yy.max()+roi[1])],'pixels':int(mask.sum()),'density':float(mask.sum()/((xx.max()-xx.min()+1)*(yy.max()-yy.min()+1)))}
meta={'index':hashlib.sha256(Path('packages/web/dist/index.html').read_bytes()).hexdigest(),'inputs':inputs,'rois':rois,'titleMasks':metrics,'method':'Shared ROI luma>=175 and red>=150; inclusive bounds; measure localized title ink only. Providers/Cost before copy differs, so before widths/densities are not exact-string fidelity comparisons. Source/current may include subtitle if ROI overlaps; inspect crops before conclusions.'}
(out/'measurements.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');print(json.dumps(metrics,indent=2))
