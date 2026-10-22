import json
from pathlib import Path
from PIL import Image, ImageChops

base=Path('tmp/quotas112')
def compare(a,b):
    left,right=Image.open(a).convert('RGB'),Image.open(b).convert('RGB')
    assert left.size==right.size
    difference=ImageChops.difference(left,right)
    channels=difference.split()
    maximum=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
    histogram=maximum.histogram()
    return dict(changedPixels=sum(histogram[1:]),maxChannelDelta=max(i for i,n in enumerate(histogram) if n),bounds=maximum.getbbox())

before=json.loads((base/'before/quota-rows.json').read_text())
after=json.loads((base/'after/quota-rows.json').read_text())
for a,b in zip(before,after):
    for key in ['owner','window','text','aria','selected','stale','rect','fillRect','fillStyle']:
        assert a[key]==b[key],(key,a['owner'],a['window'])
reference=Image.open('docs/redesign-v1.85.69/refs/overview.png').convert('RGB')
images=[Image.open(base/phase/'overview.png').convert('RGB') for phase in ['before','after']]
# Interior centerline samples in the supplied raster; endpoints avoid rounded caps.
# Lengths are measured visible fills in the reference, not app capacities or API data.
reference_fills=[(1337,188,119),(1337,239,89),(1337,291,103),(1337,401,82),(1337,448,48)]
samples=[]
for row,(x,y,width) in zip(after,reference_fills):
    rect=row['fillRect']
    source_samples=[]
    values=[[],[]]
    for t in [.15,.3,.5,.7,.85]:
        source_samples.append(reference.getpixel((round(x+t*width),y)))
        for image,output in zip(images,values):
            output.append(image.getpixel((round(rect['x']+t*rect['width']),round(rect['y']+rect['height']/2))))
    mae=lambda actual:sum(abs(c-d) for p,q in zip(source_samples,actual) for c,d in zip(p,q))/15
    samples.append(dict(owner=row['owner'],window=row['window'],referenceFill=dict(x=x,y=y,width=width),fractions=[.15,.3,.5,.7,.85],referenceSamples=source_samples,beforeSamples=values[0],afterSamples=values[1],beforeRgbMAE=mae(values[0]),afterRgbMAE=mae(values[1])))

manifest=json.loads((base/'after/verification.json').read_text())
old=json.loads(Path('docs/redesign-v1.85.110/review-manifest.json').read_text())
controls=[]
for row in manifest['results']:
    route=row['route']
    previous=next(entry for entry in old['routes'] if entry['route']==route)
    oldpath=Path('docs/redesign-v1.85.110')/previous['after']
    controls.append(dict(route=route,against110=compare(oldpath,base/'after'/f'{route}.png'),immediateRepeat=compare(base/'after'/f'{route}.png',base/'after'/f'{route}-repeat.png')))
report=dict(scope='Five interior bar color samples per supplied reference window; no full-page similarity percentage',quotaFactsAndGeometryIdentical=True,overviewBeforeAfter=compare(base/'before/overview.png',base/'after/overview.png'),samples=samples,allEightControls=controls)
(base/'analysis.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(overview=report['overviewBeforeAfter'],samples=[{k:v for k,v in sample.items() if k in ['owner','window','beforeRgbMAE','afterRgbMAE']} for sample in samples],controls=controls),indent=2))
