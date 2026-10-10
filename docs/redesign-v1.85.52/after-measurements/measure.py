from PIL import Image
from pathlib import Path
import json, hashlib, statistics

out=Path('tmp/sidebar-interior52-final');out.mkdir(exist_ok=True)
base=json.load(open('tmp/sidebar-interior52-final/base-geometry.json'))
report={'productionIndexSha256':base['productionIndexSha256'],'pages':{},'method':'RGB masks and inclusive PNG pixel bounds; glyph threshold meanRGB>90, colored tile mask blue/red difference>15 and blue>30 OR green/red difference>18 and green>30. Median glyph RGB from brighter half of mask pixels. Antialiasing/background texture affect bounds.'}
def bounds(points):
 return [min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)] if points else None
def mask(im,roi,test):
 l,t,r,b=roi;return [(x,y) for y in range(t,b) for x in range(l,r) if test(im.getpixel((x,y)))]
def glyph(im,roi):
 pts=mask(im,roi,lambda c:sum(c)/3>90)
 vals=sorted((im.getpixel(p) for p in pts),key=sum);vals=vals[len(vals)//2:]
 return {'bounds':bounds(pts),'brightHalfMedianRGB':[round(statistics.median(c[i] for c in vals)) for i in range(3)] if vals else None,'maskPixels':len(pts)}
for route in ['models','overview','live','projects','providers','cost','history','alerts']:
 info=base['pages'][route];q=info['dom']['quick'];f=info['dom']['footer'];z={}
 for kind,file in [('source',f'docs/redesign-v1.85.43/refs/{route}.png'),('current',f'tmp/sidebar-native52-en-dark/{route}-closed.png')]:
  im=Image.open(file).convert('RGB');v={'path':file,'sha256':hashlib.sha256(Path(file).read_bytes()).hexdigest(),'cardBackdropSamples':[{ 'position':[180,int(q['y'])+offset], 'RGB':im.getpixel((180,int(q['y'])+offset))} for offset in [30,80,140,230]]}
  v['heading']=glyph(im,(20,int(q['y'])+8,160,int(q['y'])+35))
  ys=[y for y in range(int(q['y'])+35,int(q['bottom'])-10) if sum(sum(im.getpixel((x,y)))/3>90 for x in range(60,175))>=2]
  groups=[]
  for y in ys:
   if not groups or y>groups[-1][-1]+2:groups.append([y])
   else:groups[-1].append(y)
  v['textLineGroups']=[[min(g),max(g)] for g in groups]
  v['rows']=[]
  for i in range(min(4,len(groups)//2)):
   a,b=groups[2*i],groups[2*i+1];t=min(a)-9;bottom=max(b)+5
   tile=mask(im,(20,t,62,bottom),lambda c:(c[2]-c[0]>15 and c[2]>30) or(c[1]-c[0]>18 and c[1]>30))
   icon=glyph(im,(20,t,62,bottom));colors=[im.getpixel(pt) for pt in tile]
   v['rows'].append({'key':['projects','models','providers','sessions'][i],'count':glyph(im,(60,min(a),175,max(a)+1)),'label':glyph(im,(60,min(b),190,max(b)+1)),'coloredTileBounds':bounds(tile),'coloredTileMedianRGB':[round(statistics.median(c[k] for c in colors)) for k in range(3)] if colors else None,'iconGlyph':icon})
  v['footer']={'logo':glyph(im,(18,int(f['y'])+8,61,int(f['bottom'])-6)),'firstText':glyph(im,(66,int(f['y'])+8,195,int(f['y'])+33)),'version':glyph(im,(60,int(f['y'])+34,195,int(f['bottom'])-5)),'backdropSample':{'position':[180,int(f['y'])+10],'RGB':im.getpixel((180,int(f['y'])+10))}}
  im.crop((0,int(q['y'])-3,225,int(q['bottom'])+3)).save(out/f'{route}-{kind}-quick.png')
  im.crop((0,int(f['y'])-3,225,min(im.height,int(f['bottom'])+5))).save(out/f'{route}-{kind}-footer.png')
  z[kind]=v
 report['pages'][route]=z
out.joinpath('measurements.json').write_text(json.dumps(report,indent=2))
for route,z in report['pages'].items():
 print(route)
 for k,v in z.items():print(k,'heading',v['heading'],'rows',[(r['count']['bounds'],r['label']['bounds'],r['coloredTileBounds'],r['iconGlyph']['bounds'])for r in v['rows']],'footer',v['footer'],'samples',v['cardBackdropSamples'])
