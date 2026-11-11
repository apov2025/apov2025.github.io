"""Convert supplied STEP surfaces, retaining CAD normals and component detail.
Run with Python containing cadquery, trimesh, numpy and Pillow.
Front glass display/printed controls are presentation layers, not firmware.
"""
from pathlib import Path
import json
import os
os.environ.setdefault("XDG_CACHE_HOME", "/private/tmp/catalog-cad-cache")
import cadquery as cq
import numpy as np
import trimesh as tm
ROOT=Path(__file__).resolve().parents[1]

def material(name,color,metal=0,rough=.5):
 rgb=np.asarray(color[:3])/255
 linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 return tm.visual.material.PBRMaterial(name=name,baseColorFactor=[*np.round(linear*255).astype(int),color[3]],metallicFactor=metal,roughnessFactor=rough)
M={
 'Case':material('Case',[181,186,188,255],.9,.44),
 'Front':material('Front',[234,235,229,255],0,.48),
 'Back':material('Back',[230,232,227,255],0,.14),
 'Buttons':material('Buttons',[224,120,55,255],.25,.4),
 'Screen':material('Screen',[168,171,160,255],0,.88),
 'Details':material('Details',[44,47,44,255],0,.8),
 'ConnectorMetal':material('ConnectorMetal',[165,171,173,255],1,.26),
 'ConnectorBlack':material('ConnectorBlack',[20,23,22,255],0,.75),
 'TouchLeft':material('TouchLeft',[224,120,55,255],0,.65),
 'TouchCenter':material('TouchCenter',[149,159,158,255],0,.65),
 'TouchRight':material('TouchRight',[149,159,158,255],0,.65),
 'TouchInk':material('TouchInk',[149,159,158,255],0,.65),
 'Contacts':material('Contacts',[183,150,84,255],.85,.3),
}

def convert_face(face,transform,mat):
 vertices,faces=face.tessellate(.035,.12)
 if not faces:return None
 points=np.array([v.toTuple() for v in vertices]); norms=np.array([face.normalAt(v).toTuple() for v in vertices])
 points=transform(points,False)/1000;norms=transform(norms,True)
 # Per-face UVs in physical mm, suitable for a subtle isotropic grain.
 normal=np.abs(norms.mean(axis=0)); axes=[a for a in range(3) if a!=normal.argmax()]
 uv=points[:,axes]*1000/4
 mesh=tm.Trimesh(vertices=points,faces=faces,vertex_normals=norms,process=False)
 mesh.visual=tm.visual.TextureVisuals(uv=uv,material=mat)
 return mesh

def add_shape(scene,shape,mat,name,transform):
 meshes=[convert_face(f,transform,mat) for f in shape.Faces()]
 meshes=[m for m in meshes if m is not None]
 mesh=tm.util.concatenate(meshes)
 # concatenate preserves texture visuals when all parts use same material.
 scene.add_geometry(mesh,node_name=name,geom_name=name)

def rect(w,h,d,r=0):
 s=cq.Workplane('XY').box(w,h,d)
 if r:s=s.edges('|Z').fillet(r)
 return s.val()

def identity(p,n=False):return p

def add_usb(scene,mats,transform,place,name,width=8.4,height=2.5):
 # Local XY is the connector mouth; +Z faces out, negative Z enters the body.
 # Recessed open metal tube, dark floor, centered insulator and contact rows.
 outer=rect(width,height,2.0,height/2-.04).translate((0,0,-1.1))
 inner=rect(width-.4,height-.4,2.4,(height-.4)/2-.04).translate((0,0,-1.1))
 parts=[('shell',outer.cut(inner),'ConnectorMetal'),
        ('cavity',rect(width-.42,height-.42,.22,(height-.42)/2-.04).translate((0,0,-2.16)),'ConnectorBlack'),
        ('tongue',rect(width-1.45,.52,1.55,.18).translate((0,0,-1.25)),'ConnectorBlack')]
 for row in [-1,1]:
  for k in range(12):
   part=rect(.21,.028,.85,.005).translate(((k-5.5)*.45,row*.27,-1.01))
   parts.append((f'contact-{row}-{k}',part,'Contacts'))
 for suffix,shape,mat in parts:add_shape(scene,place(shape),mats[mat],f'{name}_{suffix}',transform)

def add_slot_cover(scene,mats,transform,place,name,width,height):
 # Closed dust cover: recessed seat and card inside, continuous visible seam,
 # color-matched lid with a small finger relief. It is an added visualization.
 seat=rect(width,height,.3,min(height/2-.03,.45)).translate((0,0,-.23))
 lid=rect(width-.25,height-.24,.2,min((height-.24)/2-.03,.35)).translate((0,0,-.10))
 notch=cq.Solid.makeCylinder(.32,.7,cq.Vector(width/2-1.1,-height/2,-.45))
 lid=lid.cut(notch)
 card=rect(width-.8,max(.3,height-.6),1.8,.1).translate((0,0,-1.25))
 for suffix,part,mat in [('seat',seat,'ConnectorBlack'),('lid',lid,'Case'),('card',card,'ConnectorBlack')]:
  add_shape(scene,place(part),mats[mat],f'{name}_{suffix}',transform)

def build(kind,filename):
 scene=tm.Scene();solids=cq.importers.importStep(str(ROOT/'catalog/new_concept'/filename)).solids().vals()
 pico=kind=='mindreset-read-pico'
 # Photo-confirmed Pico: -X is up and -Z faces the reader.
 # Metalio: long Z axis -> vertical,
 # with the CAD's capacitive keys at the bottom of the portrait face.
 def transform(p,normal=False):
  if pico:return np.stack([-p[:,1],-p[:,0],-p[:,2]-(0 if normal else 3.6)],axis=1)
  return np.stack([p[:,0],-p[:,2]+(0 if normal else 3.247),p[:,1]-(0 if normal else 2.29)],axis=1)
 mats=dict(M);mats['Back']=material('Back',[230,232,227,255],0,.14 if pico else .48)
 # Work in native STEP coordinates so hardware stays registered to source holes.
 if pico:
  usb_place=lambda q:q.rotate((0,0,0),(1,0,0),-90).translate((49.26,32.89,-3.355))
  slot_place=lambda q:q.rotate((0,0,0),(1,0,0),90).translate((46.22,-33.015,-2.705))
  cavity=usb_place(rect(9.7,2.7,5,1.2).translate((0,0,-2.3)))
 else:
  usb_place=lambda q:q.translate((0,1.8053,63.42))
  slot_place=lambda q:q.translate((-21.066,1.718,64.25))
  cavity=usb_place(rect(8.25,2.45,4,1.15).translate((0,0,-1.7)))
 for i,solid in enumerate(solids):
  # Four microscopic internal MIC contacts do not contribute to the exterior.
  if not pico and i in [3,4,5,6,7]:continue
  groups={}
  for j,face in enumerate(solid.Faces()):
   if pico:
    role='Case' if i==0 else ('Front' if j==8 or 10<=j<=17 else 'Back' if j==9 or 18<=j<=25 else 'Details')
    if i==1 and j not in [8,9] and face.Center().y < -32.5:role='Buttons'
   else:
    role='Case' if i==11 else 'Buttons' if i in [0,1,8] else 'Back' if i==9 else 'Front' if i==10 else 'Details'
    if i==10 and j==147:role='Screen'
    if i==10 and j in [172,177]:role='TouchCenter' if j==172 else 'TouchRight'
    if i==11 and (50<=j<=58 or 205<=j<=217 or 109<=j<=112):role='ConnectorBlack'
   # A simplified STEP core can plug the shell opening; cut only that core,
   # retaining the original frame's opening contours and face material mapping.
   pieces=face.cut(cavity).Faces() if (pico and i==1) or (not pico and i==10) else [face]
   if pico and i==1 and j==8:
    # Photo-calibrated screen opening on the actual front (-source Z).
    screen_cut=rect(102.5,58.0,1.0,.9).translate((-3.15,0,-7.3))
    pieces=[sub for piece in pieces for sub in piece.cut(screen_cut).Faces()]
   for piece in pieces:
    mesh=convert_face(piece,transform,mats[role])
    if mesh is not None:groups.setdefault(role,[]).append(mesh)
  for role,meshes in groups.items():
   name=f'{kind}_{i}_{role}';scene.add_geometry(tm.util.concatenate(meshes),node_name=name,geom_name=name)
 if pico:
  # STEP includes a solid cover slab; add the visible display and capacitive ink.
  lip=rect(58.0,102.5,.20,.9).cut(rect(57.65,102.15,.5,.75)).translate((0,3.15,3.6))
  add_shape(scene,lip,mats['TouchInk'],'Pico_display_reveal',identity)
  add_shape(scene,rect(57.65,102.15,.035,.75).translate((0,3.15,3.515)),mats['Screen'],'Pico_display',identity)
  for x in [-16,16]:
   add_shape(scene,rect(1.8,.27,.018,.12).translate((x,-53.65,3.72)),mats['TouchLeft' if x<0 else 'TouchRight'],f'Pico_touch_{x}',identity)
  ring=cq.Workplane('XY').circle(.92).circle(.69).extrude(.018).val().translate((0,-53.65,3.712))
  add_shape(scene,ring,mats['TouchCenter'],'Pico_touch_home',identity)
 if not pico:
  circle=cq.Workplane('XY').circle(3.45).extrude(.018).val().translate((-24.0,-53.1,3.9))
  add_shape(scene,circle,mats['TouchLeft'],'Metalio_front_round_touch',identity)
 add_usb(scene,mats,transform,usb_place,'USB_C',9.45 if pico else 8.15,2.55 if pico else 2.35)
 add_slot_cover(scene,mats,transform,slot_place,'MicroSD_cover',12.1 if pico else 18.0,1.30 if pico else 1.90)
 if not pico:
  # Opaque acoustic liner behind the existing bottom speaker bore array.
  backing=rect(18,2.0,.35,.2).translate((20.05,2.2753,60.88))
  add_shape(scene,backing,mats['ConnectorBlack'],'Speaker_acoustic_liner',transform)
  add_shape(scene,rect(33,2.0,.2,.2).translate((0,2.2753,-55.15)),mats['ConnectorBlack'],'Top_mic_acoustic_liner',transform)
 out=ROOT/'catalog/product'/kind/'models';out.mkdir(parents=True,exist_ok=True)
 (out/'device.glb').write_bytes(scene.export(file_type='glb'))
 metadata={'source':filename,'units':'meters','bounds':scene.bounds.tolist(),'materials':{k:{'metalness':m.metallicFactor,'roughness':m.roughnessFactor} for k,m in mats.items()},'display':'Neutral static e-paper surface; no firmware simulation','addedDetails':['Recessed USB-C metal shell, insulator, tongue and two contact rows','Closed color-matched microSD cover, seam, finger relief, seat and card'],'detailProvenance':'Presentation geometry added inside source STEP openings; not an engineering reproduction of internals','orientationStatus':'Pico calibrated against pico1-4.jpeg: USB left lower, microSD right lower, power right above center; source -Z is front' if pico else 'Source screen and capacitive-key orientation'}
 (out/'device.json').write_text(json.dumps(metadata,indent=2)+'\n')
 print(kind,'meshes',len(scene.geometry),'bytes',(out/'device.glb').stat().st_size,flush=True)

if __name__=='__main__':
 build('mindreset-read-pico','mindreset pico read.step')
 build('metalio-eink4-plus-47','Metalio E-INK4 Plus47.step')
