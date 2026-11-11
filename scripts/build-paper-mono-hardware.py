#!/usr/bin/env python3
"""Build photo/CAD-aligned visible Paper Mono connector inserts (millimetres)."""
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'catalog/product/paper-mono-v2/models'
DOC = {'asset': {'version': '2.0', 'generator': 'apov build-paper-mono-hardware.py'}, 'scene': 0,
       'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': []}
BIN = bytearray()

def material(name, hexcolor, roughness, metalness=0):
    rgb = [int(hexcolor[i:i+2], 16)/255 for i in (1, 3, 5)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    DOC['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': linear+[1], 'roughnessFactor': roughness, 'metallicFactor': metalness}})
    return len(DOC['materials'])-1

METAL = material('Mono connector metal', '#a5a9ab', .34, .82)
DARK = material('Mono socket interior', '#121619', .82)
TONGUE = material('Mono USB tongue', '#303337', .62)
LENS = material('Mono LED light guide', '#d8dad0', .28)
BOARD = material('Mono internal board backing', '#203934', .9)

def add_mesh(name, triangles, mat, transform=lambda p:p):
    positions, normals = [], []
    for tri in triangles:
        a,b,c = [transform(p) for p in tri]
        u=[b[i]-a[i] for i in range(3)]; v=[c[i]-a[i] for i in range(3)]
        n=[u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length=math.sqrt(sum(x*x for x in n))
        if length < 1e-10: continue
        positions.extend([a,b,c]);normals.extend([[x/length for x in n]]*3)
    def attr(rows,bounds=False):
        data=struct.pack('<'+'f'*len(rows)*3, *(x for row in rows for x in row))
        view=len(DOC['bufferViews']); DOC['bufferViews'].append({'buffer':0,'byteOffset':len(BIN),'byteLength':len(data),'target':34962}); BIN.extend(data)
        a={'bufferView':view,'componentType':5126,'count':len(rows),'type':'VEC3'}
        if bounds:
            a['min']=[min(p[i] for p in rows) for i in range(3)];a['max']=[max(p[i] for p in rows) for i in range(3)]
        DOC['accessors'].append(a);return len(DOC['accessors'])-1
    mesh=len(DOC['meshes']);DOC['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':attr(positions,True),'NORMAL':attr(normals)},'material':mat}]})
    DOC['scenes'][0]['nodes'].append(len(DOC['nodes']));DOC['nodes'].append({'name':name,'mesh':mesh})

def contour(w,h,r):
    points=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for k in range(7):
            a=math.radians(start+k*15);points.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return points

def rounded(name,w,h,r,depth,mat,transform,wall=None):
    outer=contour(w,h,r);inner=contour(w-2*wall,h-2*wall,max(.04,r-wall)) if wall else None
    tris=[]
    def p(v,z):return (*v,z)
    for i,a in enumerate(outer):
        j=(i+1)%len(outer);b=outer[j]
        tris.extend([(p(a,0),p(b,0),p(b,depth)),(p(a,0),p(b,depth),p(a,depth))])
        if inner:
            c,d=inner[i],inner[j]
            tris.extend([(p(a,0),p(d,0),p(b,0)),(p(a,0),p(c,0),p(d,0)),
                         (p(a,depth),p(b,depth),p(d,depth)),(p(a,depth),p(d,depth),p(c,depth)),
                         (p(c,0),p(c,depth),p(d,depth)),(p(c,0),p(d,depth),p(d,0))])
        else:
            tris.extend([((0,0,0),p(b,0),p(a,0)),((0,0,depth),p(a,depth),p(b,depth))])
    add_mesh(name,tris,mat,transform)

# Outer CAD opening: y=15.439..24.521, z=2.269..5.571, x=-50.5.
def usb(p):u,v,d=p;return (-50.34+d,19.98+u,3.92+v)
rounded('PaperMono_USB_C_metal_socket',8.8,3.02,1.18,3.8,METAL,usb,wall=.2)
rounded('PaperMono_USB_C_dark_cavity',8.4,2.62,.98,.2,DARK,lambda p:usb((p[0],p[1],p[2]+3.7)))
rounded('PaperMono_USB_C_tongue',6.55,.62,.22,2.9,TONGUE,lambda p:usb((p[0],p[1],p[2]+.85)))
# User/official side photo identify the central capsule as a light guide, not a socket.
# CAD light-guide opening: x=5.962..14.038, z=2.962..5.038, y=30.5.
def led(p):u,v,d=p;return (10+u,30.39-d,4+v)
rounded('PaperMono_LED_light_guide',7.9,1.9,.92,1.15,LENS,led)
rounded('PaperMono_LED_housing',8.2,2.2,1.05,1.0,DARK,lambda p:led((p[0],p[1],p[2]+1.1)))
# CAD TF opening is centered at (-33,30.5,3.5). Empty socket; no flap or card.
def tf(p):u,v,d=p;return (-33+u,30.32-d,3.5+v)
rounded('PaperMono_TF_metal_socket',10.95,1.88,.34,4.6,METAL,tf,wall=.14)
rounded('PaperMono_TF_dark_cavity',10.65,1.58,.2,.3,DARK,lambda p:tf((p[0],p[1],p[2]+4.4)))
# A deliberately plain backing board prevents see-through shell gaps. Its exact
# layout is not documented; no chip layout, traces or battery detail is invented.
rounded('PaperMono_internal_backing',94,55,2,.8,BOARD,lambda p:(p[0],p[1],2.4+p[2]))

DOC['buffers']=[{'byteLength':len(BIN)}]
encoded=json.dumps(DOC,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);BIN.extend(b'\0'*(-len(BIN)%4))
output=struct.pack('<III',0x46546C67,2,28+len(encoded)+len(BIN))+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+struct.pack('<II',len(BIN),0x004E4942)+BIN
OUT.mkdir(parents=True,exist_ok=True);(OUT/'hardware.glb').write_bytes(output)
provenance={
 'artifact':'hardware.glb','sha256':hashlib.sha256(output).hexdigest(),'units':'millimetres; attached inside existing CAD parent',
 'sources':[
  'https://docs.m5stack.com/en/core/PaperMono',
  'https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1267/C153_PaperMono_main_pictures_09.webp',
  'https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1267/C153_PaperMono_main_pictures_10.webp',
  'https://github.com/m5stack/M5_Hardware/blob/e29c139cbc7c80b5ccc5557e5ab8025a7a19a109/Products/C153_PaperMono/Structures/PaperMono.stl'],
 'basis':'Connector centers and opening extents measured from existing manufacturer CAD geometry. Socket walls, tongue and inactive LED lens are photo-informed simplified visual inserts; exact internal component dimensions are estimates.',
 'internalBacking':'Plain case-bounded board estimate, not a reproduction of the actual PCB layout.',
 'rebuild':'python3 scripts/build-paper-mono-hardware.py'}
(OUT/'hardware-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(f'Built {len(DOC["nodes"])} components, {len(output)} bytes')
