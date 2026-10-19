from pathlib import Path
import re,json,hashlib,gzip,shutil
from PIL import Image,ImageChops
root=Path.cwd();old=root/'tmp/projects88-all-grid-trial';new=root/'tmp/projects88-compiled-check';out=root/'docs/redesign-v1.85.88';checks=[]
def structural(markup):
 ids=re.findall(r'id="(r[0-9a-z]+-(?:area|glow))"',markup);assert len(ids)==len(set(ids));mapping={identity:'generated-'+str(index) for index,identity in enumerate(ids)}
 for identity,replacement in mapping.items():
  assert markup.count('id="'+identity+'"')==1 and 'url(#'+identity+')' in markup
  markup=markup.replace('id="'+identity+'"','id="'+replacement+'"').replace('url(#'+identity+')','url(#'+replacement+')')
 return markup,mapping
def lines(values,mapping):
 result=[]
 for original in values:
  value=dict(original)
  for identity,replacement in mapping.items():value['filter']=value['filter'].replace('url("#'+identity+'")','url("#'+replacement+'")').replace('url(#'+identity+')','url(#'+replacement+')')
  result.append(value)
 return result
for name in ['en-dark-1672','th-dark-1672','en-light-1672','en-dark-1280','th-dark-390']:
 a=json.loads((old/(name+'-snapshots.json')).read_text())['after'];b=json.loads((new/(name+'-snapshots.json')).read_text())['before'];am,ai=structural(a['markup']);bm,bi=structural(b['markup']);assert am==bm and len(ai)==len(bi),name+': generated SVG references only'
 assert {k:v for k,v in a.items() if k not in ['markup','lines']}=={k:v for k,v in b.items() if k not in ['markup','lines']},name+': actual facts/boxes'
 assert lines(a['lines'],ai)==lines(b['lines'],bi),name+': observed points/geometry/paint references'
 first=Image.open(old/(name+'-after.png')).convert('RGB');second=Image.open(new/(name+'-before.png')).convert('RGB');diff=ImageChops.difference(first,second);changed=sum(px!=(0,0,0) for px in diff.getdata());maximum=max(hi for lo,hi in diff.getextrema())
 checks.append({'case':name,'factsAllBoxesAndActualPointsEqual':True,'rawMainMarkupEqual':a['markup']==b['markup'],'rawLinePaintInputsEqual':a['lines']==b['lines'],'structureAndPaintEqualAfterOnlyGeneratedSvgReferenceRenaming':True,'uniqueSvgDefinitions':len(ai),'compiledSha256':hashlib.sha256((new/(name+'-before.png')).read_bytes()).hexdigest(),'trialAfterSha256':hashlib.sha256((old/(name+'-after.png')).read_bytes()).hexdigest(),'changedPixels':changed,'maxChannelDelta':maximum,'differenceBounds':diff.getbbox(),'pixelCount':first.width*first.height,'originalTolerancePass':maximum<=10 and changed/(first.width*first.height)<=.00005})
(out/'projects-trial/compiled-comparison.json').write_bytes((json.dumps(checks,indent=2)+'\n').encode());(out/'projects-trial/compiled-verification.json.gz').write_bytes(gzip.compress((new/'verification.json').read_bytes(),mtime=0));print(json.dumps(checks))
for name in ['verification.json']+[f'{lang}-{theme}-{width}.png' for lang in ['en','th'] for theme in ['dark','light'] for width in [1672,390]]:shutil.copyfile(root/'screens/model-row-trends'/name,out/'models-browser'/name)
for name in ['source88-models-browser','source88-projects-compiled']:
 for suffix in ['.log','-exit.txt']:
  src=root/'tmp'/(name+suffix);data=src.read_text(encoding='utf-8-sig');(out/'logs'/(name+suffix)).write_bytes(('\n'.join(line.rstrip() for line in data.splitlines()).rstrip()+'\n').encode())
