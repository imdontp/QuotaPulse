import json
from pathlib import Path
from PIL import Image

root = Path('tmp/ring111-actions-date-only')
def compare(a, b):
    left, right = Image.open(a).convert('RGBA'), Image.open(b).convert('RGBA')
    assert left.size == right.size
    count = ring = maximum = 0
    bounds = None
    for index, (p, q) in enumerate(zip(left.getdata(), right.getdata())):
        delta = max(abs(x-y) for x, y in zip(p, q))
        if not delta: continue
        x, y = index % left.width, index // left.width
        count += 1
        ring += int(1500 <= x < 1651 and 370 <= y < 519)
        maximum = max(maximum, delta)
        bounds = [x, y, x, y] if bounds is None else [min(bounds[0],x),min(bounds[1],y),max(bounds[2],x),max(bounds[3],y)]
    return dict(changedPixels=count, ringPixels=ring, maxChannelDelta=maximum, bounds=bounds)

results=[]
for entry in json.loads(Path('tmp/ring111-date-only-exits.json').read_text(encoding='utf-8-sig')):
    directory=root/entry['action']
    first=directory/'models-th-dark.png'
    second=directory/'repeat-models-th-dark.png'
    after=directory/'after-models-th-dark.png'
    repeat_after=directory/'repeat-after-models-th-dark.png'
    results.append(dict(action=entry['action'], baselineRepeat=compare(first,second), afterRepeat=compare(after,repeat_after), firstIntervention=compare(first,after), repeatIntervention=compare(second,repeat_after)))
Path('tmp/ring111-controlled-comparison.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
