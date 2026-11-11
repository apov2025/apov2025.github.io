#!/usr/bin/env python3
"""Build the PaperS3 exterior GLB using Python's standard library only.

Default: download three hash-checked files from the pinned source commit.
Offline: --source-dir /path/to/esp-online-tester/web/platform/assets/m5stack-c139
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
from urllib.request import urlopen
from papers3_hardware import add_hardware


REPOSITORY = "https://github.com/zhuzhe1983/esp-online-tester"
COMMIT = "4932dcd1803381fb64c0dd6252707c0176e8ac9e"
SOURCE_PATH = "web/platform/assets/m5stack-c139"
HASHES = {
    "geometry.bin": "e2e40387e93939cd40ec5327a6403a135d48e9954feee8bf4c949b73d690595f",
    "model.json": "2d5eef698e2813818fadeb5d54d78bdd376fa84dfab54e28188d57c3decf2ce0",
    "LICENSE-M5Stack.txt": "44611d917bece311f5c8eeffce83d8bf9e9ca3f815d262f694ff4a7996af50ea",
}
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "catalog/product/m5stack-paper-s3/models"


def source_files(directory):
    result = {}
    for name, expected in HASHES.items():
        if directory:
            data = (directory / name).read_bytes()
        else:
            url = f"https://raw.githubusercontent.com/zhuzhe1983/esp-online-tester/{COMMIT}/{SOURCE_PATH}/{name}"
            with urlopen(url, timeout=60) as response:
                data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f"Source checksum mismatch: {name}")
        result[name] = data
    return result


def material(name, color, roughness):
    # glTF material factors are linear; source swatches are sRGB.
    rgb = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return {"name": name, "pbrMetallicRoughness": {
        "baseColorFactor": linear + [1], "metallicFactor": 0, "roughnessFactor": roughness,
    }}


def build(files):
    metadata = json.loads(files["model.json"])
    if metadata["unit"] != "mm" or metadata["strideFloats"] != 6:
        raise ValueError("Unsupported source geometry format")
    doc = {
        "asset": {"version": "2.0", "generator": "scripts/build-papers3-model.py",
                  "copyright": "Copyright (c) 2021 M5Stack; MIT; see LICENSE-M5Stack.txt"},
        "scene": 0, "scenes": [{"name": "M5Stack PaperS3", "nodes": list(range(5))}],
        "nodes": [], "meshes": [], "accessors": [], "bufferViews": [],
        "materials": [material("Case", "#b8bcba", .83), material("Buttons", "#7d8785", .74),
                      material("Front", "#c5c7c6", .86), material("Screen", "#ffffff", 1)],
    }
    binary = bytearray()

    def attribute(rows, kind, bounds=False):
        flat = [value for row in rows for value in row]
        if not flat or not all(math.isfinite(value) for value in flat):
            raise ValueError("Empty or non-finite vertex attribute")
        # Round through float32 so accessor bounds exactly describe the stored vertices.
        data = struct.pack(f"<{len(flat)}f", *flat)
        values = struct.unpack(f"<{len(flat)}f", data)
        view = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data), "target": 34962})
        binary.extend(data)
        accessor = {"bufferView": view, "componentType": 5126, "count": len(rows), "type": kind}
        if bounds:
            accessor["min"] = [min(values[i::len(rows[0])]) for i in range(len(rows[0]))]
            accessor["max"] = [max(values[i::len(rows[0])]) for i in range(len(rows[0]))]
        index = len(doc["accessors"])
        doc["accessors"].append(accessor)
        return index

    def mesh(name, positions, normals, material_index, uv=None, extras=None):
        if len(positions) != len(normals) or len(positions) % 3:
            raise ValueError(f"Invalid triangle geometry for {name}")
        attrs = {"POSITION": attribute(positions, "VEC3", True), "NORMAL": attribute(normals, "VEC3")}
        if uv is not None:
            attrs["TEXCOORD_0"] = attribute(uv, "VEC2", True)
        index = len(doc["meshes"])
        doc["meshes"].append({"name": name, "primitives": [{"attributes": attrs, "material": material_index, "mode": 4}]})
        node = {"name": name, "mesh": index}
        if extras:
            node["extras"] = extras
        doc["nodes"].append(node)

    names = {"shell": ("Shell", 0), "power-button": ("PowerButton", 1), "bottom-hook": ("BottomHook", 0)}
    for part in metadata["parts"]:
        name, material_index = names[part["name"]]
        count = part["vertexCount"]
        floats = struct.unpack_from(f"<{count * 6}f", files["geometry.bin"], part["byteOffset"])
        positions = [tuple(value / 1000 for value in floats[i:i + 3]) for i in range(0, len(floats), 6)]
        normals = [floats[i + 3:i + 6] for i in range(0, len(floats), 6)]
        mesh(name, positions, normals, material_index, extras={"sourceComponent": part["sourceComponent"], "basis": "manufacturer CAD"})

    bezel = next(part for part in metadata["derivedParts"] if part["id"] == "front-bezel")
    center = [v / 1000 for v in bezel["geometry"]["centerMm"]]
    half = [v / 2000 for v in bezel["geometry"]["sizeMm"]]
    positions, normals = [], []
    # CAD shell corners are centred at (+/-30.5, +/-57.75) mm with
    # a 3 mm outer radius. The existing insert is inset 0.75 mm, so its
    # matching radius is 2.25 mm. Keep its dimensions, depth and materials.
    radius = .00225
    outline = []
    for sx, sy, start in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
        for step in range(17):
            angle = math.radians(start + step * 90 / 16)
            outline.append((center[0] + sx * (half[0] - radius) + radius * math.cos(angle),
                            center[1] + sy * (half[1] - radius) + radius * math.sin(angle)))
    for index, a in enumerate(outline):
        b = outline[(index + 1) % len(outline)]
        for side in (-1, 1):
            z = center[2] + side * half[2]
            edge = [(*a, z), (*b, z)]
            if side < 0:
                edge.reverse()
            positions.extend([(center[0], center[1], z), *edge])
            normals.extend([(0, 0, side)] * 3)
        low, high = center[2] - half[2], center[2] + half[2]
        corners = [(*a, low), (*b, low), (*b, high), (*a, high)]
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        normal = ((b[1] - a[1]) / length, (a[0] - b[0]) / length, 0)
        positions.extend(corners[i] for i in (0, 1, 2, 0, 2, 3))
        normals.extend([normal] * 6)
    bezel_note = bezel["notes"] + " Perimeter rounded to follow the source CAD shell: 2.25 mm insert corner radius."
    mesh("FrontBezel", positions, normals, 2, extras={"basis": bezel["basis"], "note": bezel_note})

    screen = metadata["presentation"]["screen"]
    x, y, z = [v / 1000 for v in screen["positionMm"]]
    w, h = [v / 2000 for v in screen["sizeMm"]]
    corners = [(x - w, y + h, z), (x - w, y - h, z), (x + w, y - h, z), (x + w, y + h, z)]
    texcoords = [(0, 0), (0, 1), (1, 1), (1, 0)]
    indices = (0, 1, 2, 0, 2, 3)
    mesh("Screen", [corners[i] for i in indices], [(0, 0, 1)] * 6, 3,
         [texcoords[i] for i in indices], {"basis": screen["basis"], "textureOrigin": "top-left; use CanvasTexture.flipY=false"})

    hardware = add_hardware(mesh, doc["materials"], material)
    doc["scenes"][0]["nodes"] = list(range(len(doc["nodes"])))
    doc["buffers"] = [{"byteLength": len(binary)}]
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=True).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(encoded) + 8 + len(binary))
    glb += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    glb += struct.pack("<II", len(binary), 0x004E4942) + binary
    provenance = {
        "artifact": "device.glb", "sha256": hashlib.sha256(glb).hexdigest(),
        "sourceRepository": REPOSITORY, "sourceCommit": COMMIT, "sourcePath": SOURCE_PATH,
        "sourceFileSHA256": HASHES,
        "manufacturerCAD": {key: metadata["provenance"][key] for key in ("repository", "commit", "sourceUrl", "sourceSha256", "sourceLicense")},
        "units": "metres", "frontDirection": "+Z",
        "conversion": "Preserved original triangles and normals; positions converted mm to m. Source assembly transform already baked into geometry.bin; no second transform applied.",
        "nodes": [node["name"] for node in doc["nodes"]],
        "internalVisuals": hardware,
        "derivedSurfaces": {"FrontBezel": bezel_note, "Screen": screen["basis"]},
        "screen": {"sizeMetres": [v / 1000 for v in screen["sizeMm"]], "centerMetres": [x, y, z], "uvOrigin": "top-left"},
        "excluded": ["Photographs and source-photo decals", "Translated CAD printing duplicates"],
        "rebuild": "python3 scripts/build-papers3-model.py [--source-dir PATH_TO_M5STACK_C139]",
    }
    return glb, provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    files = source_files(args.source_dir)
    glb, provenance = build(files)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "device.glb").write_bytes(glb)
    (args.output_dir / "LICENSE-M5Stack.txt").write_bytes(files["LICENSE-M5Stack.txt"])
    (args.output_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Built {args.output_dir / 'device.glb'} ({len(glb):,} bytes; SHA-256 {provenance['sha256']})")


if __name__ == "__main__":
    main()
