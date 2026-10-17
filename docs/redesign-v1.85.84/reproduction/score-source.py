from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
root=Path.cwd()
out=root/'docs/redesign-v1.85.84'
load=lambda p:np.asarray(Image.open(root/p).convert('RGB')).astype(float)
source=load('docs/redesign-v1.85.69/refs/alerts.png')
before=load('docs/redesign-v1.85.83/after/alerts.png')
after=load('docs/redesign-v1.85.84/after/alerts.png')
rois=json.loads((out/'source/alerts-frozen-rois.json').read_text())
rows=[]
# Registration displacement is source relative to candidate. Keep source windows fixed.
for dy in [-1,0,1]:
 for dx in [-1,0,1]:
  row={'dx':dx,'dy':dy,'regions':{}}
  for name,roi in rois.items():
   x,y,r,b=roi['bounds'];s=source[y:b,x:r]
   old=float(np.abs(s-before[y-dy:b-dy,x-dx:r-dx]).mean())
   new=float(np.abs(s-after[y-dy:b-dy,x-dx:r-dx]).mean())
   assert new<=old,(dx,dy,name,old,new)
   row['regions'][name]={'before':old,'after':new}
  rows.append(row)
expected=json.loads((out/'source/alerts-scores.json').read_text())
assert rows==expected,'Recorded scores differ from archived images'
source=load('docs/redesign-v1.85.69/refs/providers.png');before=load('docs/redesign-v1.85.83/after/providers.png');after=load('docs/redesign-v1.85.84/after/providers.png')
rois=json.loads((out/'source/providers-frozen-rois.json').read_text());rows=[]
for roi in rois['regions']:
 x,y,r,b=roi['source_roi'];cx,cy,cr,cb=roi['candidate_roi'];s=source[y:b,x:r]
 old=float(np.abs(s-before[cy:cb,cx:cr]).mean());new=float(np.abs(s-after[cy:cb,cx:cr]).mean())
 assert new<old
 rows.append({'id':roi['id'],'before':old,'after':new,'improves':True})
assert rows==json.loads((out/'source/providers-scores.json').read_text())
print('Reproduced exact archived scores: Alerts36 and Providers2. No whole-screen similarity percentage.')
