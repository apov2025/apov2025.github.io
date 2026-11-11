#!/usr/bin/env python3
"""Refine only the prototype v2 top power key and its dark recess.

Run: python3 scripts/refine-prototype-power-key.py [--check]
No dependencies. Applies to silver, teal, graphite and developer GLBs only.

The read-only upstream src/prototype.js uses roundedSolid(10.4,3.2,...)
for the recess and (9.5,2.6,...) for the cap. The exported slim models bake
the transforms into their vertices, leaving unequal end/side clearances.
Generate true circular-ended capsules in those baked model coordinates:
retain the cap envelope and both parts' original centers/depths, offset the
recess by 0.12 mm, and roll the cap edge with a small 0.075 mm fillet.
Only the two meshes' existing attribute/index accessors and buffer views
are replaced. All other geometry, node transforms, materials, textures,
metadata and front controls are retained byte-for-byte or JSON-identically.
Repeated runs are byte-identical (the replacement buffer views are reused).
"""

import argparse
import copy
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'catalog/product/prototype/models'
FINISHES = ('silver', 'teal', 'graphite', 'developer')
TARGETS = ('Top_power_key', 'Top_power_recess')
GAP = 0.12


def unpack(data):
    magic, version, length = struct.unpack_from('<III', data)
    assert (magic, version, length) == (0x46546c67, 2, len(data))
    n, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(data[20:20+n])
    size, kind = struct.unpack_from('<II', data, 20+n)
    assert kind == 0x004e4942 and 28+n+size == len(data)
    return doc, bytearray(data[28+n:])


def pack(doc, binary):
    doc['buffers'][0]['byteLength'] = len(binary)
    header = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    header += b' ' * (-len(header) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return (struct.pack('<III', 0x46546c67, 2, 28+len(header)+len(binary))
            + struct.pack('<II', len(header), 0x4e4f534a) + header
            + struct.pack('<II', len(binary), 0x004e4942) + binary)


def primitive(doc, name):
    nodes = [n for n in doc['nodes'] if n.get('name') == name]
    assert len(nodes) == 1, name
    node = nodes[0]
    assert not any(k in node for k in ('matrix', 'translation', 'rotation', 'scale'))
    parts = doc['meshes'][node['mesh']]['primitives']
    assert len(parts) == 1 and parts[0]['mode'] == 4
    return parts[0]


def capsule(cx, radius, half_straight, low, high, bevel):
    """Closed mesh, analytic normals, circular arcs and rounded vertical edge."""
    contour = [(side, angle) for side, start in ((1, -math.pi/2), (-1, math.pi/2))
               for angle in (start + math.pi*i/32 for i in range(33))]
    rings = []
    for i in range(6):
        a = -math.pi/2 + math.pi/2*i/5
        rings.append((radius-bevel+bevel*math.cos(a), low+bevel+bevel*math.sin(a), a))
    for i in range(6):
        a = math.pi/2*i/5
        rings.append((radius-bevel+bevel*math.cos(a), high-bevel+bevel*math.sin(a), a))
    pos, normals, uv, indices = [], [], [], []
    count = len(contour)
    for r, y, tilt in rings:
        for side, angle in contour:
            x = cx + side*half_straight + r*math.cos(angle)
            z = r*math.sin(angle)
            pos.append((x, y, z))
            normals.append((math.cos(angle)*math.cos(tilt), math.sin(tilt), math.sin(angle)*math.cos(tilt)))
            uv.append((x/10, z/10))
    for row in range(len(rings)-1):
        for i in range(count):
            a, b = row*count+i, row*count+(i+1) % count
            indices.extend((a, a+count, b, b, a+count, b+count))
    for row, y, normal in ((0, low, -1), (len(rings)-1, high, 1)):
        center = len(pos)
        pos.append((cx, y, 0)); normals.append((0, normal, 0)); uv.append((cx/10, 0))
        for i in range(count):
            a, b = row*count+i, row*count+(i+1) % count
            indices.extend((center, a, b) if normal == -1 else (center, b, a))
    # Validate winding against outward normals, excluding numerical degeneracy.
    for i in range(0, len(indices), 3):
        a, b, c = [pos[k] for k in indices[i:i+3]]
        u, v = [b[k]-a[k] for k in range(3)], [c[k]-a[k] for k in range(3)]
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        n = [sum(normals[j][k] for j in indices[i:i+3]) for k in range(3)]
        assert sum(cross[k]*n[k] for k in range(3)) > 0, 'Inverted/degenerate face'
    return {'POSITION': pos, 'NORMAL': normals, 'TEXCOORD_0': uv, 'indices': indices}


def refine(data):
    doc, binary = unpack(data)
    original, old_binary = copy.deepcopy(doc), bytes(binary)
    key = primitive(doc, TARGETS[0])
    bounds = doc['accessors'][key['attributes']['POSITION']]
    lo, hi = bounds['min'], bounds['max']
    cx, radius = (lo[0]+hi[0])/2, (hi[2]-lo[2])/2
    # Round source float noise so regeneration is stable after float32 encoding.
    cx, radius = round(cx, 5), round(radius, 6)
    half_straight = round((hi[0]-lo[0])/2-radius, 5)
    touched_accessors, touched_views = set(), set()
    for name in TARGETS:
        prim = primitive(doc, name)
        bounds = doc['accessors'][prim['attributes']['POSITION']]
        low, high = [round(bounds[k][1], 5) for k in ('min', 'max')]
        geometry = capsule(cx, radius+(GAP if name == TARGETS[1] else 0),
                           half_straight, low, high, .012 if name == TARGETS[1] else .075)
        for semantic, values in geometry.items():
            ai = prim['indices'] if semantic == 'indices' else prim['attributes'][semantic]
            accessor = doc['accessors'][ai]
            vi = accessor['bufferView']
            view = doc['bufferViews'][vi]
            width = 1 if semantic == 'indices' else len(values[0])
            assert vi not in touched_views and view.get('byteStride', width*4) == width*4
            assert sum(a.get('bufferView') == vi for a in doc['accessors']) == 1
            touched_accessors.add(ai); touched_views.add(vi)
            flat = values if semantic == 'indices' else [v for row in values for v in row]
            code = 'I' if semantic == 'indices' else 'f'
            raw = struct.pack('<'+code*len(flat), *flat)
            if view['byteLength'] == len(raw) and accessor.get('byteOffset', 0) == 0:
                offset = view.get('byteOffset', 0)
                binary[offset:offset+len(raw)] = raw
            else:
                binary += b'\0' * (-len(binary) % 4)
                offset = len(binary)
                binary += raw
            view.update(byteOffset=offset, byteLength=len(raw))
            accessor.update(byteOffset=0, componentType=5125 if semantic == 'indices' else 5126,
                            count=len(values))
            # glTF bounds are recorded from the actual float32 payload.
            decoded = struct.unpack('<'+code*len(flat), raw)
            width = 1 if semantic == 'indices' else len(values[0])
            for bound, fn in (('min', min), ('max', max)):
                accessor[bound] = [fn(decoded[k::width]) for k in range(width)]
    # Prove that no other logical glTF data or binary views changed.
    for k in original:
        if k not in ('accessors', 'bufferViews', 'buffers'):
            assert doc[k] == original[k], k
    for i, a in enumerate(original['accessors']):
        if i not in touched_accessors:
            assert a == doc['accessors'][i]
    for i, v in enumerate(original['bufferViews']):
        if i not in touched_views:
            assert v == doc['bufferViews'][i]
            offset, size = v.get('byteOffset', 0), v['byteLength']
            assert binary[offset:offset+size] == old_binary[offset:offset+size]
    return pack(doc, binary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify assets already match the generator; do not write')
    args = parser.parse_args()
    for finish in FINISHES:
        path = MODELS / f'prototype-{finish}.glb'
        before = path.read_bytes()
        after = refine(before)
        assert refine(after) == after, 'Generator must be byte-idempotent'
        if args.check:
            assert before == after, f'{path.name} needs refinement'
        elif before != after:
            path.write_bytes(after)
        print(f'PASS {path.name}: capsule gap {GAP:.2f} mm; unchanged other geometry/materials/nodes; idempotent')


if __name__ == '__main__':
    main()
