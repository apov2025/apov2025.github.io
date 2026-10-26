"""Structural regression checks, intentionally run before regenerating the revision."""
import json, struct
from pathlib import Path
b=Path('catalog/product/prototype/models/prototype-developer.glb').read_bytes()
n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n]);raw=b[28+n:];names={o['name']:o for o in doc['nodes'] if o.get('name')}
fail=[]
def check(condition,label):
 if not condition:fail.append(label)
check(not any(k.startswith(('Front_page','Front_function')) for k in names),'No physical front keys')
check('Front_prototype_wordmark' not in names,'No front logo')
check(sum(k.startswith('Front_speaker_perforation') for k in names)==40,'Original 40 speaker perforations retained')
for key in ['side','bottom','custom']:check('Developer_LED_'+key in names,'Named '+key+' LED layout')
for key in ['side','bottom','custom']:
 group=names.get('Developer_LED_'+key,{})
 points=[doc['nodes'][child].get('translation',doc['nodes'][child].get('matrix',[0]*16)[12:15]) for child in group.get('children',[])]
 check(bool(points) and all((25<=x<=36 and y>-42) if key in ['side','custom'] else (x<24 and y<-52) for x,y,z in points),key+' layout stays in its designated strip')
check(sum(name.startswith('Developer_LED_') for name in names)==3,'Exactly three LED layout groups')
bottom=names['Developer_LED_bottom']
xs=[doc['nodes'][i].get('translation',doc['nodes'][i].get('matrix',[0]*16)[12:15])[0] for i in bottom['children']]
check(abs((min(xs)+max(xs))/2-(-4.142651557922363))<.001,'Bottom keys centered beneath display')
check(names['Developer_LED_custom'].get('extras',{}).get('controls')==['spark','orbit','diamond'],'Three distinct custom side icons')
check('Developer_LED_decoration' not in names,'Decoration layout removed')
check('Developer_rear_white_deboss' in names,'Recessed developer prototype rear lettering')
plate=names['Developer_uninterrupted_black_front'];a=doc['accessors'][doc['meshes'][plate['mesh']]['primitives'][0]['attributes']['POSITION']];v=doc['bufferViews'][a['bufferView']];p=[struct.unpack_from('<fff',raw,v.get('byteOffset',0)+a.get('byteOffset',0)+i*12) for i in range(a['count'])]
top=[x for x,y,z in p if abs(y-65.2343979)<.01]
check(abs(max(top)-34.76934)<.005,'Top corners follow original front outline')
def hull(points):
 points=sorted(set((x,y) for x,y,z in points))
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 def half(points):
  result=[]
  for point in points:
   while len(result)>1 and cross(result[-2],result[-1],point)<=1e-8:result.pop()
   result.append(point)
  return result[:-1]
 return half(points)+half(points[::-1])
source=Path('catalog/product/prototype/models/prototype-teal.glb').read_bytes();sn=struct.unpack_from('<I',source,12)[0];sj=json.loads(source[20:20+sn]);sr=source[28+sn:]
node=next(o for o in sj['nodes'] if o.get('name')=='Prototype_front_plate');sa=sj['accessors'][sj['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']];sv=sj['bufferViews'][sa['bufferView']]
sp=[struct.unpack_from('<fff',sr,sv.get('byteOffset',0)+sa.get('byteOffset',0)+i*12) for i in range(sa['count'])]
check(hull(p)==hull(sp),'All four developer corners exactly match original contour')
message=names.get('Developer_screen_message',{})
check(message.get('extras',{}).get('text')=='develop your own','Exact centered e-ink screen message')
rear=names.get('Developer_rear_white_deboss',{})
check(rear.get('extras',{}).get('text')=='developer prototype','Exact rear inscription')
for m in doc['materials']:
 if m.get('name')=='Prototype blank e-ink':
  c=m['pbrMetallicRoughness']['baseColorFactor'];check(max(c[:3])-min(c[:3])<1e-8,'E-ink is neutral gray')
if fail:raise SystemExit('FAIL:\n'+'\n'.join(fail))
print('PASS: front outline, no front logo/keys, original speaker, 3 layouts, filled rear deboss, neutral screen')
