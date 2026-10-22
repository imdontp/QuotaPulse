import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root=Path('tmp/matrix114')
before=json.loads((root/'before/matrix-rows.json').read_text())
after=json.loads((root/'after/matrix-rows.json').read_text())
assert len(before)==len(after)
facts=['key','callRecords','aggregateRecords','unknownRecords','label','exactTotal']
cell_facts=['at','state','tokens','records','calls','partial','intensity']
for a,b in zip(before,after):
    for key in facts: assert a[key]==b[key],key
    assert len(a['cells'])==len(b['cells'])==31
    for first,last in zip(a['cells'],b['cells']):
        for key in cell_facts: assert first[key]==last[key],key
def compare(a,b):
    left,right=Image.open(a).convert('RGB'),Image.open(b).convert('RGB')
    assert left.size==right.size
    channels=ImageChops.difference(left,right).split()
    delta=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2]); hist=delta.histogram()
    return dict(changedPixels=sum(hist[1:]),maxChannelDelta=max(i for i,n in enumerate(hist) if n),bounds=delta.getbbox())
canonical=json.loads((root/'after/verification.json').read_text())
previous_root=Path('docs/redesign-v1.85.113')
previous=json.loads((previous_root/'review-manifest.json').read_text())
old_capture=json.loads((previous_root/'evidence/all-eight-capture.json').read_text())
controls=[]
for row in canonical['results']:
    route=row['route']; old=next(item for item in previous['routes'] if item['route']==route)
    old_geometry=next(item for item in old_capture['results'] if item['route']==route)['geometry']
    assert old_geometry==row['geometry'],route
    controls.append(dict(route=route,beforeAfter=compare(previous_root/old['after'],root/'after'/f'{route}.png'),repeat=compare(root/'after'/f'{route}.png',root/'after'/f'{route}-repeat.png')))
roi=(1300,902,1650,927)
reference=Image.open('docs/redesign-v1.85.69/refs/live.png').convert('RGB').crop(roi)
def mae(file): return sum(ImageStat.Stat(ImageChops.difference(reference,Image.open(file).convert('RGB').crop(roi))).mean)/3
report=dict(productionIndexSha256=canonical['productionIndexSha256'],pairs=len(after),cellsPerPair=31,preservedFacts=facts,preservedCellFacts=cell_facts,
            stripWidths=dict(before=before[0]['stripRect']['width'],after=after[0]['stripRect']['width']),
            cellWidths=dict(before=before[0]['cells'][0]['rect']['width'],after=after[0]['cells'][0]['rect']['width']),
            stripX=dict(before=before[0]['stripRect']['x'],after=after[0]['stripRect']['x']),
            decorativeRegion=dict(box=roi,beforeRgbMAE=mae(root/'before/live.png'),afterRgbMAE=mae(root/'after/live.png'),scope='Static source background only; not whole-page fidelity'),
            recordedShellMainHeadingGeometryEqual=True,controls=controls)
(root/'analysis.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
