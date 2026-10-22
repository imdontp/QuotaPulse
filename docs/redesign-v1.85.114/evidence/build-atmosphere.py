import json, math, statistics
from pathlib import Path
from PIL import Image

reference=Image.open('docs/redesign-v1.85.69/refs/live.png').convert('RGB')
origin=(1288,862)
points={(x,y) for y in range(862,927) for x in range(1297,1652)
        if reference.getpixel((x,y))[2]>55 and reference.getpixel((x,y))[2]>reference.getpixel((x,y))[0]*2.2 and reference.getpixel((x,y))[1]<65}
groups=[]
while points:
    start=points.pop(); queue=[start]; group=[start]
    while queue:
        x,y=queue.pop()
        for neighbour in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if neighbour in points:
                points.remove(neighbour); queue.append(neighbour); group.append(neighbour)
    if len(group)<50: groups.append(group)
groups.sort(key=lambda group:(min(y for x,y in group),min(x for x,y in group)))
stars=[]
for group in groups:
    x=sum(x for x,y in group)/len(group)-origin[0]
    y=sum(y for x,y in group)/len(group)-origin[1]
    peak=max(group,key=lambda point:reference.getpixel(point)[2])
    stars.append(dict(x=round(x,3),y=round(y,3),radius=round(max(.55,min(1.2,math.sqrt(len(group)/math.pi)*.7)),3),color=reference.getpixel(peak),pixels=len(group)))
background=[]
for y in [862,894,926]:
    background.append(tuple(round(statistics.median(reference.getpixel((x,y))[channel] for x in range(1300,1650))) for channel in range(3)))
rgb=lambda value:'rgb('+','.join(map(str,value))+')'
svg='<svg xmlns="http://www.w3.org/2000/svg" width="374" height="65" viewBox="0 0 374 65"><defs><linearGradient id="field" x2="0" y2="1">'
svg+=''.join(f'<stop offset="{offset}" stop-color="{rgb(color)}"/>' for offset,color in zip(['0','.5','1'],background))
svg+='</linearGradient><linearGradient id="fade" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".3" stop-color="white"/></linearGradient><mask id="edge"><rect width="374" height="65" fill="url(#fade)"/></mask></defs><rect width="374" height="65" fill="url(#field)" mask="url(#edge)"/>'
svg+=''.join(f'<circle cx="{star["x"]}" cy="{star["y"]}" r="{star["radius"]}" fill="{rgb(star["color"])}"/>' for star in stars)
svg+='</svg>\n'
Path('packages/web/src/redesign/assets/live-matrix-atmosphere.svg').write_text(svg)
Path('tmp/matrix114/atmosphere-extraction.json').write_text(json.dumps(dict(scope='Static decorative lower-panel field only; no text or chart data',referenceOrigin=origin,background=background,stars=stars),indent=2)+'\n')
print(json.dumps(dict(stars=len(stars),svgBytes=len(svg.encode()),background=background)))
