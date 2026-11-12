"""Case-bounded PaperS3 visual inserts. Dimensions are mm, not manufacturing CAD."""
import math


def add_hardware(mesh, materials, material):
    def mat(name, color, roughness, metal=0):
        value=material(name,color,roughness)
        value['pbrMetallicRoughness']['metallicFactor']=metal
        materials.append(value)
        return len(materials)-1
    metal=mat('Connector steel','#a5acaf',.34,.8)
    dark=mat('Socket interior','#171b1c',.86)
    pcb=mat('Internal PCB','#244b40',.88)
    foil=mat('Battery pouch','#aeb1ad',.65,.45)
    gold=mat('Contacts and inserts','#b49a59',.37,.7)
    tongue=mat('USB tongue','#303638',.65)
    label=mat('Rear label','#ffffff',.95)

    def emit(name,tris,mat_index,transform=lambda p:p):
        positions,normals=[],[]
        for tri in tris:
            a,b,c=[transform(p) for p in tri]
            u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            length=math.sqrt(sum(x*x for x in n))
            if length<1e-9:continue
            positions.extend([tuple(x/1000 for x in p) for p in (a,b,c)])
            normals.extend([tuple(x/length for x in n)]*3)
        mesh(name,positions,normals,mat_index,extras={'basis':'apov simplified internal visual; CAD-aligned openings'})

    def contour(w,h,r):
        points=[]
        for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
            for i in range(9):
                a=math.radians(start+i*90/8);points.append((cx+r*math.cos(a),cy+r*math.sin(a)))
        return points

    def extrude(poly,depth):
        tris=[];center=(sum(p[0] for p in poly)/len(poly),sum(p[1] for p in poly)/len(poly))
        for i,a in enumerate(poly):
            b=poly[(i+1)%len(poly)]
            tris.extend([((*center,0),(*b,0),(*a,0)),((*center,depth),(*a,depth),(*b,depth)),
                         ((*a,0),(*b,0),(*b,depth)),((*a,0),(*b,depth),(*a,depth))])
        return tris

    def rounded(name,w,h,r,depth,index,transform):
        emit(name,extrude(contour(w,h,r),depth),index,transform)

    def ring(name,w,h,r,wall,depth,index,transform):
        outer=contour(w,h,r);inner=contour(w-2*wall,h-2*wall,max(.03,r-wall));tris=[]
        for i,a in enumerate(outer):
            j=(i+1)%len(outer);b=outer[j];c,d=inner[i],inner[j]
            tris.extend([((*a,0),(*b,0),(*b,depth)),((*a,0),(*b,depth),(*a,depth)),
                         ((*a,0),(*c,0),(*d,0)),((*a,0),(*d,0),(*b,0)),
                         ((*a,depth),(*b,depth),(*d,depth)),((*a,depth),(*d,depth),(*c,depth)),
                         ((*c,0),(*c,depth),(*d,depth)),((*c,0),(*d,depth),(*d,0))])
        emit(name,tris,index,transform)

    # Display stack, board and battery envelope close the previously empty cavity.
    # Their concealed shapes are estimates, not a claimed component placement map.
    rounded('DisplayBacking',61,114,1.8,.6,dark,lambda p:(p[0],p[1],2.6+p[2]))
    rounded('MainPCB',61,114,1.8,.8,pcb,lambda p:(p[0],p[1],-2.1+p[2]))
    rounded('BatteryPouch',51,73,2,2.5,foil,lambda p:(p[0],p[1]+15,-.8+p[2]))
    rounded('BoardShield',23,18,1,1.2,metal,lambda p:(p[0]+8,p[1]-43,-.8+p[2]))
    rounded('DisplayRibbon',17,7,.3,.25,gold,lambda p:(p[0]-16,p[1]-26,2.2+p[2]))

    # Rear carrier follows the inner CAD outline. Leave real connector openings,
    # rather than stretching a flat decal across every hole.
    outline=contour(64,118.5,1.5)
    def clip(poly,a,b):
        side=lambda p:(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
        result=[]
        for i,p in enumerate(poly):
            q=poly[(i+1)%len(poly)];sp,sq=side(p),side(q)
            if sp>=-1e-8:result.append(p)
            if (sp>0)!=(sq>0) and abs(sp-sq)>1e-10:
                t=sp/(sp-sq);result.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
        return result
    xs=[-32,-18,4,7,17,19,25,32];ys=[-59.25,-37,-31,-28,-25,-23,59.25]
    holes=[(-18,4,-28,-23),(7,17,-37,-31),(19,25,-37,-25)]
    tris=[];edges={}
    for x0,x1 in zip(xs,xs[1:]):
        for y0,y1 in zip(ys,ys[1:]):
            x,y=(x0+x1)/2,(y0+y1)/2
            if any(a<x<b and c<y<d for a,b,c,d in holes):continue
            poly=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
            for i,a in enumerate(outline):
                if not poly:break
                poly=clip(poly,a,outline[(i+1)%len(outline)])
            if len(poly)>=3:
                center=(sum(p[0] for p in poly)/len(poly),sum(p[1] for p in poly)/len(poly))
                for i,a in enumerate(poly):
                    b=poly[(i+1)%len(poly)]
                    if math.dist(a,b)<1e-7:continue
                    tris.extend([((*center,0),(*b,0),(*a,0)),((*center,.25),(*a,.25),(*b,.25))])
                    key=tuple(sorted(tuple(round(v,7) for v in p) for p in (a,b)))
                    count,_,_=edges.get(key,(0,a,b));edges[key]=(count+1,a,b)
    # Omit shared grid walls so they cannot appear as artificial panel seams.
    for count,a,b in edges.values():
        if count==1:tris.extend([((*a,0),(*b,0),(*b,.25)),((*a,0),(*b,.25),(*a,.25))])
    emit('RearCarrier',tris,0,lambda p:(p[0],p[1],-3.72+p[2]))

    # Bottom USB-C: CAD mouth x=-26.62..-17.38, z=-1.81..1.65.
    usb=lambda p:(-22-p[0],-60.57+p[2],-.08+p[1])
    ring('USB_C_Shell',8.8,3.02,1.2,.22,4.2,metal,usb)
    rounded('USB_C_Cavity',8.36,2.58,.98,.18,dark,lambda p:usb((p[0],p[1],p[2]+4.1)))
    rounded('USB_C_Tongue',6.5,.62,.22,2.8,tongue,lambda p:usb((p[0],p[1],p[2]+.85)))
    for i in range(12):
        rounded(f'USB_C_Contact_{i+1:02}',.22,.08,.03,1.3,gold,lambda p,i=i:usb((p[0]-2.75+i*.5,p[1]+.35,p[2]+1.1)))
    # Left edge TF slot: its 12.175 x 3.164 mm mouth is in the original CAD.
    tf=lambda p:(-33.3+p[2],-44.1+p[0],.09+p[1])
    ring('TF_Socket',11.85,2.8,.65,.18,5,metal,tf)
    rounded('TF_Cavity',11.49,2.44,.47,.2,dark,lambda p:tf((p[0],p[1],p[2]+4.8)))
    # Inserted microSD: exposed dark edge just inside the original socket mouth.
    rounded('TF_Card',10.9,1.0,.16,14.8,dark,lambda p:tf((p[0],p[1],p[2]+.38)))
    rounded('TF_Card_Grip',6.5,.18,.06,.12,tongue,lambda p:tf((p[0],p[1],p[2]+.27)))
    # Plain dark seats behind the long side recesses: no see-through inner shell.
    for side in [-1,1]:
        rounded(f'SideSeat_{side}',49.9,2.1,.8,.6,dark,lambda p,side=side:(side*(32.8-p[2]),11.25-side*p[0],p[1]))
    rear=lambda x,y,z:lambda p:(x+p[0],y+p[1],z+p[2])
    # Recessed battery/expansion sockets and exposed header contacts at rear.
    for name,x,y,w,h in [('Battery',22,-31,4.9,10),('Expansion',12,-34,8.4,4.2)]:
        ring(name+'_Socket',w,h,.4,.55,1.3,dark,rear(x,y,-3.62))
        rounded(name+'_Cavity',w-1.1,h-1.1,.2,.15,dark,rear(x,y,-2.4))
        for i in range(2 if name=='Battery' else 4):
            rounded(name+f'_Pin_{i}',.55,1,.1,.8,gold,rear(x+(i-(.5 if name=='Battery' else 1.5))*1.7,y,-3.1))
    rounded('Rear_Header_Base',20,2.6,.2,.8,dark,rear(-7,-25.5,-3.6))
    for i in range(10):
        rounded(f'Rear_Header_Pad_{i}',1.1,1.8,.1,.12,gold,rear(-16+i*2,-25.5,-3.73))

    def fastener(name,x,y,outer,inner,hex_socket,index,transform=None):
        # Visible mouth faces -Z, with a recessed dark socket, not a painted dot.
        o=[];inn=[]
        for i in range(48):
            a=2*math.pi*i/48;o.append((outer*math.cos(a),outer*math.sin(a)))
            if hex_socket:
                sector=i//8;t=(i%8)/8;b=sector*math.pi/3;c=(sector+1)*math.pi/3
                inn.append((inner*((1-t)*math.cos(b)+t*math.cos(c)),inner*((1-t)*math.sin(b)+t*math.sin(c))))
            else:inn.append((inner*math.cos(a),inner*math.sin(a)))
        tris=[]
        for i,a in enumerate(o):
            j=(i+1)%48;b=o[j];c,d=inn[i],inn[j]
            tris.extend([((*a,0),(*d,0),(*b,0)),((*a,0),(*c,0),(*d,0)),
                         ((*c,0),(*c,.55),(*d,.55)),((*c,0),(*d,.55),(*d,0)),
                         ((*a,0),(*b,0),(*b,.4)),((*a,0),(*b,.4),(*a,.4))])
        transform=transform or (lambda p:(x+p[0],y+p[1],-3.93+p[2]))
        emit(name,tris,index,transform)
        emit(name+'_Recess',extrude(inn,.03),dark,lambda p:transform((p[0],p[1],p[2]+.1)))
    for x in [-28.48,28.52]:fastener('RearScrew_'+str(x),x,-31.55,1.8,.75,True,metal)
    for x in [-30.5,30.5]:fastener('ThreadedInsert_'+str(x),x,57.75,1.03,.62,False,gold)

    # Original hook countersinks: centres x=+/-12 mm, z=0, seat y=-61.75 mm.
    for side,x in [('L',-12),('R',12)]:
        fastener('HookScrew_'+side,0,0,1.82,.65,True,metal,lambda p,x=x:(x+p[0],-61.86+p[2],-p[1]))

    # Label clears the header (y=-23) and all four fastening locations.
    poly=contour(54,76,1.4);positions=[];uv=[]
    for i,a in enumerate(poly):
        b=poly[(i+1)%len(poly)]
        # Mirror x for readable type when viewed from the rear.
        for x,y in [(0,0),b,a]:
            positions.append((x/1000,(y+17)/1000,-.00394));uv.append((.5-x/54,.5-y/76))
    mesh('RearLabel',positions,[(0,0,-1)]*len(positions),label,uv,{'basis':'original apov virtual paper s3 graphic; screw/connector clearances'})
    return {'basis':'Original apov simplified visual inserts, bounded by the unchanged manufacturer shell. Concealed board/battery/component shapes are estimates; connector mouths and fastener centres measured from CAD and checked against official product photos.',
            'sticker':'Original vector design: ../media/virtual-paper-s3-label.svg; not the manufacturer photograph.',
            'screws':'Two recessed metal hex-socket heads at rear lower mounts; two brass-coloured threaded inserts at upper mounts; two removable hex-socket screw heads in the original bottom-hook countersinks.'}
