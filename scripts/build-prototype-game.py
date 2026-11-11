#!/usr/bin/env python3
"""Build the screenshot-derived e-paper concept as an embedded, meter-unit GLB.

Run: /private/tmp/catalog-cad-env/bin/python scripts/build-prototype-game.py
Dependencies: cadquery, trimesh, numpy, Pillow. Source image stays in the repo.
76 mm body width; height follows 496:914 source silhouette; 8 mm body depth.
Depths, bevels and side keys are concept assumptions, not engineering drawings.
Axes: X right, Y up, Z front. Final assembly is bounding-box centered.
Only original eight front keys; one upper-left power and two right page keys.
"""
from pathlib import Path
import os
from math import comb
os.environ.setdefault('XDG_CACHE_HOME', '/private/tmp/catalog-cad-cache')
import cadquery as cq
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'catalog/product/prototype-game/models/device.glb'
S = 76.0 / 496.0
W, H = 76.0, 914.0 * S
SCENE = trimesh.Scene()
SHAPES = {}

def solid_material(name, color, metal, rough):
    # glTF factors are linear; only texture pixels remain encoded as sRGB.
    rgb = np.asarray(color[:3], dtype=float) / 255.0
    linear = np.where(rgb <= .04045, rgb / 12.92,
                      ((rgb + .055) / 1.055) ** 2.4)
    return PBRMaterial(name=name,
                       baseColorFactor=[*np.round(linear * 255).astype(int), color[3]],
                       metallicFactor=metal, roughnessFactor=rough, doubleSided=False)

MATERIALS = {
    name: solid_material(name, color, metal, rough)
    for name, color, metal, rough in [
        ('Case', [55, 58, 60, 255], .12, .48),
        ('Front', [70, 71, 71, 255], .04, .65),
        ('Buttons', [86, 89, 89, 255], .02, .56),
        ('Screen', [162, 164, 159, 255], 0, .94),
        ('Details', [27, 30, 31, 255], 0, .72),
        ('Rim', [8, 161, 229, 255], .25, .36),
        ('Legends', [179, 184, 183, 255], 0, .7),
        ('ConnectorMetal', [158, 164, 169, 255], .88, .3),
        ('ConnectorBlack', [17, 19, 20, 255], 0, .82),
        ('ContactMetal', [155, 135, 88, 255], .72, .42),
        ('Wordmark', [175, 180, 179, 255], 0, .85),
    ]
}

def xy(px, py):
    return (px - 358) * S, (549 - py) * S

def rounded(w, h, depth, radius, bevel, x=0, y=0, z=0):
    part = cq.Workplane('XY').box(w, h, depth)
    if radius:
        part = part.edges('|Z').fillet(radius)
    if bevel:
        part = part.edges('not |Z').fillet(bevel)
    return part.translate((x, y, z)).val()

def add(name, shape, material):
    assert shape.isValid() and shape.Volume() > 0, name
    SHAPES[name] = shape
    shared = name.replace('dpad-down', 'dpad-up')
    for direction in ('west', 'east', 'south'):
        shared = shared.replace('action-'+direction, 'action-north')
    if shared != name and shared in SCENE.geometry:
        translation = np.array((shape.Center()-SHAPES[shared].Center()).toTuple())*.001
        SCENE.graph.update(frame_to=name, matrix=trimesh.transformations.translation_matrix(translation), geometry=shared)
        return SCENE.geometry[shared]
    # Keep CAD face boundaries split while retaining analytic smooth normals
    # on curved faces. Welding here would average normals across sharp edges.
    vertices, triangles, normals = [], [], []
    offset = 0
    for face in shape.Faces():
        key = material == 'Buttons'
        verts, faces = face.tessellate(.01 if key else .05, .06 if key else .18)
        if not faces:
            raise ValueError(f'{name}: CAD face produced no triangles')
        vertices.extend(v.toTuple() for v in verts)
        normals.extend(face.normalAt(v).toTuple() for v in verts)
        triangles.extend(np.asarray(faces) + offset)
        offset += len(verts)
    # Index only matching position AND analytical normal: retain hard boundaries.
    vertices=np.asarray(vertices)*.001; normals=np.asarray(normals)
    _, keep, remap=np.unique(np.round(np.column_stack((vertices,normals)),10),
                             axis=0,return_index=True,return_inverse=True)
    mesh = trimesh.Trimesh(vertices=vertices[keep], faces=remap[np.asarray(triangles)],
                           vertex_normals=normals[keep], process=False)
    mesh.visual = trimesh.visual.TextureVisuals(material=MATERIALS[material])
    SCENE.add_geometry(mesh, node_name=name, geom_name=name)
    return mesh

def block(name, w, h, depth, radius, bevel, material, x=0, y=0, z=0):
    return add(name, rounded(w, h, depth, radius, bevel, x, y, z), material)

def key_cap(w, h, depth, radius, top_bevel):
    # Large top rollover, tiny underside break: retain a clean vertical skirt.
    part = cq.Workplane('XY').newObject([rounded(w,h,depth,radius,0)])
    return part.faces('>Z').edges().fillet(top_bevel).faces('<Z').edges().fillet(.07).val()

def inherited_rear():
    # Quintic shoulder from obook5_3d_model/src/case.js createCaseGeometry.
    # Like prototype-profile.mjs, front and connector lands remain fixed.
    # Start behind the -2.225 mm USB pocket edge; keep 0.175 mm of flat land.
    control = np.array([[0,-.35],[0,-1.05],[0,-2.1],
                        [1.4,-4.15],[3.35,-4.15],[5.2,-4.15]])
    control[:,1] = -4 + (control[:,1]+4.15)*1.6/3.8
    def bezier(points,t):
        degree=len(points)-1
        return sum(comb(degree,j)*(1-t)**(degree-j)*t**j*p for j,p in enumerate(points))
    positions, normals, faces = [], [], []
    corner_steps, straight_steps, rings = 32, 8, 64
    count=4*(corner_steps+straight_steps)
    for ring in range(rings+1):
        t=ring/rings
        inset,z=bezier(control,t)
        di,dz=bezier(5*np.diff(control,axis=0),t)
        w,h,r=W-2*inset,H-2*inset,3.65
        corners=[(w/2-r,h/2-r),(-w/2+r,h/2-r),
                 (-w/2+r,-h/2+r),(w/2-r,-h/2+r)]
        for corner,(cx,cy) in enumerate(corners):
            for step in range(corner_steps+straight_steps):
                angle=(corner+min(step,corner_steps)/corner_steps)*np.pi/2
                nx,ny=np.cos(angle),np.sin(angle)
                x,y=cx+r*nx,cy+r*ny
                if step>=corner_steps:
                    ncx,ncy=corners[(corner+1)%4]
                    f=(step-corner_steps)/straight_steps
                    x+=(ncx-cx)*f; y+=(ncy-cy)*f
                # Exact inverse profile normal, including moving corner centers.
                n=np.array([-dz*nx,-dz*ny,-di*(abs(nx)+abs(ny))])
                positions.append((x,y,z)); normals.append(n/np.linalg.norm(n))
    for ring in range(rings):
        for i in range(count):
            a=ring*count+i; an=ring*count+(i+1)%count
            b=a+count; bn=an+count
            faces.extend([(a,b,an),(an,b,bn)])
    # Split the hidden top cap's normals; the rear is tangent to the shoulder.
    top=len(positions)
    positions.extend(positions[:count]); normals.extend([(0,0,1)]*count)
    center_top=len(positions); positions.append((0,0,-2.4)); normals.append((0,0,1))
    center_back=len(positions); positions.append((0,0,-4)); normals.append((0,0,-1))
    for i in range(count):
        j=(i+1)%count
        faces.extend([(center_top,top+i,top+j),
                      (center_back,rings*count+j,rings*count+i)])
    mesh=trimesh.Trimesh(vertices=np.array(positions)*.001,faces=faces,
                         vertex_normals=normals,process=False)
    mesh.visual=trimesh.visual.TextureVisuals(material=MATERIALS['Case'])
    SCENE.add_geometry(mesh,node_name='unibody-rear',geom_name='unibody-rear')
    assert np.allclose(control[:3,0],0) and np.allclose(control[-3:,1],-4)
    assert np.isclose(bezier(control,1)[0],5.2)

# Port-local XY is the opening; positive local Z runs into the enclosure.
def bottom_port(shape):
    return shape.rotate((0,0,0), (1,0,0), -90).translate((0,-H/2,-.125))

def card_port(shape):
    return (shape.rotate((0,0,0), (1,0,0), 90)
            .rotate((0,0,0), (0,0,1), 90).translate((-W/2,-H/2+24,-.125)))

def port_ring(w, h, inner_w, inner_h, depth, radius, inner_radius, start):
    return rounded(w,h,depth,radius,0,z=start+depth/2).cut(
        rounded(inner_w,inner_h,depth+2,inner_radius,0,z=start+depth/2))

# Blind pockets open through the exterior wall, leaving solid interior backing.
usb_cut = bottom_port(rounded(10,4.2,7,1.9,0,z=2.5))  # -1 .. 6 mm
card_cut = card_port(rounded(16.6,3.9,5,1.1,0,z=1.5))  # -1 .. 4 mm
body_blank = cq.Workplane('XY').newObject([rounded(W,H,5.85,3.65,0,z=.525)])
body = body_blank.faces('>Z').edges().fillet(.65).val().cut(usb_cut).cut(card_cut)
add('body', body, 'Case')

# USB-C: recessed insulating housing, continuous metal sleeve, closed dark back,
# and a thin central tongue with 12 restrained strips on each face.
add('usb-c-black-housing', bottom_port(port_ring(9.9,4.1,9.12,3.42,4.9,1.85,1.6,.15)), 'ConnectorBlack')
add('usb-c-metal-shell', bottom_port(port_ring(9.0,3.3,8.36,2.66,4.55,1.55,1.24,.3)), 'ConnectorMetal')
add('usb-c-dark-backing', bottom_port(rounded(9.9,4.1,.5,1.85,0,z=5.35)), 'ConnectorBlack')
add('usb-c-black-tongue', bottom_port(rounded(6.5,.65,3.8,.2,.08,z=3.2)), 'ConnectorBlack')
for face in (-1,1):
    for i in range(12):
        # Embedded roots, exposed faces 0.035 mm above the black tongue.
        strip = rounded(.19,.065,2.65,.025,0,x=(i-5.5)*.5,y=face*.3275,z=3.275)
        add(f'usb-c-contact-{face:+d}-{i+1:02d}', bottom_port(strip), 'ContactMetal')

# Closed microSD door: exterior is flush with the flat left wall, with a real
# clearance seam and cut fingernail scallop. Socket and back remain inside.
cover = rounded(16,3.3,.65,.85,.1,z=.325)
notch = rounded(2.4,1.3,1.2,.55,0,x=5.4,y=1.6,z=.3)
add('microsd-flush-cover', card_port(cover.cut(notch)), 'Case')
add('microsd-perimeter-seam', card_port(port_ring(16.5,3.8,15.7,3.0,.55,1.05,.7,.75)), 'ConnectorBlack')
add('microsd-notch-backing', card_port(rounded(3,1.4,.2,.4,0,x=5.4,y=1.1,z=1.15)), 'ConnectorBlack')
add('microsd-internal-socket', card_port(port_ring(15.5,2.8,12,1.3,2,.7,.35,1.4)), 'ConnectorMetal')
add('microsd-dark-backing', card_port(rounded(16.4,3.7,.3,1,0,z=3.7)), 'ConnectorBlack')
for i in range(8):
    add(f'microsd-contact-{i+1:02d}', card_port(
        rounded(.35,.12,1.4,.04,0,x=(i-3.5)*1.1,y=-.59,z=2.7)), 'ContactMetal')

# Continuous shell shoulder: same Case material and tangent as the side walls.
inherited_rear()
# These layers must be perimeter rings: full slabs would occlude both the
# recessed display and the acoustic cavity beneath the perforated front pane.
rim_opening = rounded(W-3, H-3, 2, 2.2, 0, z=3.7)
add('cyan-perimeter', rounded(W, H, .35, 3.65, .12, z=3.65).cut(rim_opening), 'Rim')
add('front-gasket', rounded(W-.8, H-.8, .32, 3.3, .1, z=3.78).cut(rim_opening), 'Details')
front = rounded(W-1.45, H-1.45, .65, 3.0, .18, z=3.675)
# Screen opening and all 80 acoustic holes are cut into the physical pane.
sx, sy = xy(339, 407.5)
screen_w, screen_h = 381*S, 509*S
cutters = [rounded(screen_w, screen_h, 2, .35, 0, sx, sy, 3.7)]
for row in range(5):
    for col in range(16):
        x, y = xy(172.5 + col*12.75, 899.5 + row*12.65)
        cutters.append(cq.Solid.makeCylinder(.59, 2, cq.Vector(x,y,2.8)))
front = front.cut(cq.Compound.makeCompound(cutters))
add('front-pane-perforated', front, 'Front')
block('screen-recess-bezel', screen_w-.08, screen_h-.08, .3, .32, .06,
      'Details', sx, sy, 3.4)
block('blank-e-paper-display', 371*S, 498*S, .16, .12, .04,
      'Screen', sx, sy, 3.62)
x, y = xy(268, 925)
block('speaker-dark-cavity', 31, 9.4, .2, .5, .05, 'Details', x, y, 3.5)

# Four independent D-pad arms, matching the original drawing exactly.
for name, px, py, pw, ph in [
    ('up',217,736.5,33,46), ('left',181,771,43,34),
    ('right',253,771,43,34), ('down',217,805,33,46),
]:
    x,y=xy(px,py)
    cap=key_cap(pw*S-.3,ph*S-.3,.9,1.4,.42).translate((x,y,4.25))
    seam=rounded(pw*S+.45,ph*S+.45,.12,1.7,.035,x,y,4.0).cut(
        rounded(pw*S-.06,ph*S-.06,1,1.52,0,x,y,4.0))
    add('dpad-'+name+'-seam',seam,'Details')
    add('dpad-'+name,cap,'Buttons')

for name, px, py in [('north',471,733),('west',425.5,770.5),
                      ('east',514.5,770.5),('south',471,809)]:
    x,y=xy(px,py)
    seam=cq.Workplane('XY').circle(3.13).circle(2.90).extrude(.12).edges().fillet(.035)
    add('action-'+name+'-seam',seam.translate((x,y,3.94)).val(),'Details')
    cap=cq.Workplane('XY').circle(2.78).extrude(.95)
    cap=cap.faces('>Z').edges().fillet(.44).faces('<Z').edges().fillet(.07)
    add('action-'+name+'-cap',cap.translate((x,y,3.8)).val(),'Buttons')

# One power/lock key upper-left; two right-side page/volume keys.
# True capsule cap and concentric capsule seam in the side's own plane.
# Outer contour is an exact 0.15 mm offset; 0.02 mm inner clearance prevents
# intersecting cap/socket surfaces. Keep the existing centers and projection.
for name, side, y, height in [('power-lock',-1,H/2-20,7),
                             ('page-volume-up',1,H/2-38,9),
                             ('page-volume-down',1,H/2-50,9)]:
    outer=cq.Workplane('XY').slot2D(height+.3,2.8,90).extrude(.12).translate((0,0,-.06))
    inner=cq.Workplane('XY').slot2D(height+.04,2.54,90).extrude(1).translate((0,0,-.5))
    socket=outer.cut(inner).edges('not |Z').fillet(.015).val()
    socket=socket.rotate((0,0,0),(0,1,0),side*90).translate((side*38,y,0))
    add(name+'-socket',socket,'Details')
    cap=cq.Workplane('XY').slot2D(height,2.5,90).extrude(1.15)
    cap=cap.faces('>Z').edges().fillet(.38).faces('<Z').edges().fillet(.07)
    cap=cap.translate((0,0,-.575)).val()
    cap=cap.rotate((0,0,0),(0,1,0),side*90).translate((side*38,y,0))
    add(name+'-key',cap,'Buttons')
    assert cap.intersect(socket).Volume() < 1e-7, name
    assert abs(cap.distance(socket)-.02) < 1e-6, name

# Opaque planar Arial glyphs: no screenshot texture, alpha plane or rectangle.
glyphs=cq.Workplane('XY').text('prototype game',3,.05,font='Arial',kind='regular',
                              halign='left',valign='bottom',combine=False).val()
vertices, faces = [], []
for face in glyphs.Faces():
    if face.geomType() != 'PLANE' or face.normalAt().z < .99:
        continue
    verts, tris=face.tessellate(.01,.06)
    offset=len(vertices)
    vertices.extend(v.toTuple() for v in verts)
    faces.extend(np.asarray(tris)+offset)
vertices=np.asarray(vertices)
assert len(vertices)>0, 'Arial glyph outlines missing'
x0,y0=xy(150,142)
width=176*S
scale=width/np.ptp(vertices[:,0])
vertices[:,0]=(vertices[:,0]-vertices[:,0].min())*scale+x0
vertices[:,1]=(vertices[:,1]-vertices[:,1].min())*scale+y0
vertices[:,2]=4.012
label=trimesh.Trimesh(vertices=vertices*.001,faces=faces,
                     vertex_normals=np.tile([0,0,1],(len(vertices),1)),process=False)
label.visual=trimesh.visual.TextureVisuals(material=MATERIALS['Wordmark'])
SCENE.add_geometry(label,node_name='prototype-game-wordmark',geom_name='prototype-game-wordmark')
SCENE.apply_translation(-SCENE.bounds.mean(axis=0))
SCENE.metadata.update({'units':'meters','concept':True,'bodyDimensionsMm':[W,H,8],
                      'depthAssumption':'8 mm body; face keys project 0.75 mm',
                      'reference':'catalog/new_concept/prototype_game_v1.png',
                      'controls':'four D-pad arms, four face keys, power/lock and two page/volume side keys'})
SCENE.metadata['conceptGeometryAdditions'] = {
    'usbC': 'Centered bottom blind pocket through exterior body; black housing, metal sleeve, dark backing, tongue and 24 simplified contact strips; assumed dimensions, not a connector specification',
    'microSD': 'Lower-left blind pocket with internal metal socket, eight simplified contacts and dark backing; closed flush Case cover with clearance seam and cut fingernail notch; assumed dimensions',
    'portPocketDepthsMm': {'usbC': 6, 'microSD': 4},
    'rearProfile': {'sources': ['scripts/prototype-profile.mjs: roundPrototypeBack',
                     'obook5_3d_model/src/case.js: createCaseGeometry'],
                    'adaptation': 'Inherited quintic C2 shoulder with planar rear; fixed front and connector lands, constant corner radius; no shallow cover bevel',
                    'shoulderStartZMm': -2.4, 'rearZMm': -4, 'rearInsetMm': 5.2},
    'keyRefinement': 'Broad top bevels, small underside breaks, front clearance rings; caps use per-face 0.01 mm / 0.06 rad tessellation and analytical normals; shared repeated caps and position-normal indexing',
    'sideKeySeams': 'Three true capsule caps at original centers; matching capsule sockets with exact 0.15 mm outer contour offset, 0.02 mm cap clearance and 0.13 mm dark ring; unchanged projection',
    'wordmark': 'Opaque planar Arial Regular glyphs, prototype game, width 26.968 mm, z 4.012 mm; no texture or alpha rectangle',
}
# Check the B-rep rather than inferring cavities from appearance. Both pockets
# have open mouths and a solid back; door has clearance and stays flush.
assert not body.isInside(cq.Vector(0,-H/2+.1,-.125))
assert not body.isInside(cq.Vector(0,-H/2+5.9,-.125))
assert body.isInside(cq.Vector(0,-H/2+6.1,-.125))
assert not body.isInside(cq.Vector(-W/2+.1,-H/2+24,-.125))
assert body.isInside(cq.Vector(-W/2+4.1,-H/2+24,-.125))
# OCC expands cached bounds after tessellation; measure actual mesh vertices.
assert abs(SCENE.geometry['microsd-flush-cover'].vertices[:,0].min()*1000 + W/2) < 1e-6
for name, shape in SHAPES.items():
    if name.startswith(('usb-c-', 'microsd-')):
        assert body.intersect(shape).Volume() < 1e-6, name
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
def compact_indices(buffers, tree):
    # Core glTF UNSIGNED_SHORT, no decoder/extension required; normals stay float32.
    keys=list(buffers)
    for accessor in tree['accessors'].values():
        if accessor['componentType'] != 5125 or accessor['type'] != 'SCALAR':
            continue
        key=keys[accessor['bufferView']]
        indices=np.frombuffer(buffers[key],dtype='<u4',count=accessor['count'])
        if indices.max() < 65536:
            raw=indices.astype('<u2').tobytes()
            buffers[key]=raw+b'\0'*((-len(raw))%4)
            accessor['componentType']=5123
OUTPUT.write_bytes(SCENE.export(file_type='glb',buffer_postprocessor=compact_indices))
# Reload the artifact to verify actual exported units, axes and material naming.
loaded=trimesh.load(OUTPUT,force='scene')
names={g.visual.material.name for g in loaded.geometry.values()}
assert {'Case','Front','Buttons','Screen','Details'} <= names
assert {'ConnectorMetal','ConnectorBlack','ContactMetal'} <= names
assert {'usb-c-metal-shell','usb-c-black-tongue','microsd-flush-cover'} <= set(loaded.geometry)
assert loaded.metadata['conceptGeometryAdditions'] == SCENE.metadata['conceptGeometryAdditions']
assert np.allclose(loaded.bounds.mean(axis=0),0,atol=1e-7)
assert .075 < loaded.extents[0] < .080 and .139 < loaded.extents[1] < .141
assert .008 < loaded.extents[2] < .010
assert all(np.isfinite(g.vertices).all() for g in loaded.geometry.values())
for name,g in loaded.geometry.items():
    if name == 'prototype-game-wordmark':
        continue
    welded=g.copy(); welded.merge_vertices()
    assert welded.is_watertight and welded.is_winding_consistent and welded.volume > 0, name
for name in ('up','left','right','down'):
    assert SHAPES['dpad-'+name].intersect(SHAPES['dpad-'+name+'-seam']).Volume() < 1e-7
for name in ('north','west','east','south'):
    assert SHAPES['action-'+name+'-cap'].intersect(SHAPES['action-'+name+'-seam']).Volume() < 1e-7
print(f'Wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)')
print('Assembly dimensions mm:', np.round(loaded.extents*1000,3).tolist())
print('Materials:', ', '.join(sorted(names)))
print('Geometry parts:',len(loaded.geometry))
print('Verified valid CAD solids, open port pockets, solid backing, flush cover, and port/body clearance')

# The v2 font and boolean cutter are shared by the reproducible rear engraving pass.
import subprocess
subprocess.run(["node", str(ROOT / "scripts/engrave-game-rear.mjs")], cwd=ROOT, check=True)
