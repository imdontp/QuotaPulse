import json
from pathlib import Path
from PIL import Image, ImageChops

def compare(a,b):
    left,right=Image.open(a).convert('RGB'),Image.open(b).convert('RGB')
    assert left.size==right.size
    channels=ImageChops.difference(left,right).split()
    delta=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
    hist=delta.histogram()
    return dict(changedPixels=sum(hist[1:]),maxChannelDelta=max(i for i,n in enumerate(hist) if n),bounds=delta.getbbox())

root=Path('tmp/feed113/canonical')
current=json.loads((root/'verification.json').read_text())
previous_root=Path('docs/redesign-v1.85.112')
previous=json.loads((previous_root/'review-manifest.json').read_text())
previous_capture=json.loads((previous_root/'evidence/all-eight-capture.json').read_text())
results=[]
for entry in current['results']:
    route=entry['route']
    old=next(row for row in previous['routes'] if row['route']==route)
    old_capture=next(row for row in previous_capture['results'] if row['route']==route)
    assert old_capture['geometry']==entry['geometry'],route
    results.append(dict(route=route,recordedShellMainHeadingGeometryEqual=True,beforeAfter=compare(previous_root/old['after'],root/f'{route}.png'),immediateRepeat=compare(root/f'{route}.png',root/f'{route}-repeat.png')))
report=dict(scope='Full unmasked frames and recorded shell/main/heading geometry; not whole-page fidelity acceptance',productionIndexSha256=current['productionIndexSha256'],results=results)
(root/'visual-controls.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
