#!/usr/bin/env python3
"""Pack Quaternius Universal Base heads + Ranger outfits + UAL clips into hero_f/hero_m GLBs.

CC0 assets: Universal Base Characters, Modular Character Outfits - Fantasy,
and Universal Animation Library, all by Quaternius.
"""
from __future__ import annotations

import json, struct, sys, shutil
from pathlib import Path
import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# sources
# ---------------------------------------------------------------------------
UBC = Path('/tmp/ubc/src/Universal Base Characters[Standard]')
MCO = Path('/tmp/mco/src/Modular Character Outfits - Fantasy[Standard]')
UAL = Path('/tmp/ual/src/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
OUT_DIR = Path('/tmp/hero-pack')

FEMALE = {
    'outfit': MCO / 'Exports/glTF (Godot-Unreal)/Outfits/Female_Ranger.gltf',
    'base': UBC / 'Base Characters/Godot - UE/Superhero_Female_FullBody.gltf',
    'hair': UBC / 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Long.gltf',
    'body_mesh': 'Superhero_Female',
    'keep_base_meshes': ('Eyebrows', 'Eyes'),
    'drop_substrings': ('Hood',),
    'out': 'hero_f.glb',
}
MALE = {
    'outfit': MCO / 'Exports/glTF (Godot-Unreal)/Outfits/Male_Ranger.gltf',
    'base': UBC / 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf',
    'hair': UBC / 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_SimpleParted.gltf',
    # male body mesh is poorly named in the export
    'body_mesh': 'Sphere.005_Retopology.004',
    'keep_base_meshes': ('Face', 'Face.001'),
    'drop_substrings': ('Hood',),
    'out': 'hero_m.glb',
}

# Alias UAL clip names so makeCharacter's clip() keeps working.
CLIP_ALIASES = {
    'Idle_Loop': 'Idle',
    'Walk_Loop': 'Walk',
    'Sprint_Loop': 'Run',
    'Hit_Chest': 'HitRecieve',
    'Interact': 'Interact',
    'Punch_Cross': 'Punch_Right',
    'Roll': 'Roll',
    'Sword_Attack': 'Sword_Slash',
    'Idle_Talking_Loop': 'Wave',
}
CLIP_KEEP = set(CLIP_ALIASES)

BONE_RENAME = {
    'pelvis': 'Hips',
    'spine_03': 'Chest',
    'upperarm_l': 'UpperArm.L',
    'upperarm_r': 'UpperArm.R',
    'lowerarm_l': 'LowerArm.L',
    'lowerarm_r': 'LowerArm.R',
    'thigh_l': 'UpperLeg.L',
    'thigh_r': 'UpperLeg.R',
    'calf_l': 'LowerLeg.L',
    'calf_r': 'LowerLeg.R',
    'hand_l': 'Wrist.L',
    'hand_r': 'Wrist.R',
    'middle_01_r': 'Middle1.R',
    'middle_01_l': 'Middle1.L',
}

# Chestnut multiply for the near-grey hair albedos.
HAIR_TINT = np.array([0.42, 0.24, 0.13], dtype=np.float32)  # ~#6b3e21
# Slight teal shift of already-green ranger cloth (optional, mild).
TEAL_SHIFT = True

COMP_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COMP_DTYPE = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
TYPE_N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT3': 9, 'MAT4': 16}


def load_gltf(path: Path):
    path = Path(path)
    if path.suffix.lower() == '.glb':
        data = path.read_bytes()
        clen, _ = struct.unpack_from('<II', data, 12)
        gltf = json.loads(data[20:20 + clen])
        off = 20 + clen
        if off % 4:
            off += 4 - (off % 4)
        blob = b''
        if off + 8 <= len(data):
            blen, _ = struct.unpack_from('<II', data, off)
            blob = data[off + 8:off + 8 + blen]
        return gltf, bytearray(blob), path.parent
    gltf = json.loads(path.read_text())
    blob = bytearray()
    if gltf.get('buffers'):
        uri = gltf['buffers'][0].get('uri')
        if uri and not uri.startswith('data:'):
            blob = bytearray((path.parent / uri).read_bytes())
    return gltf, blob, path.parent


def accessor_numpy(gltf, blob, idx):
    a = gltf['accessors'][idx]
    n = TYPE_N[a['type']]
    dtype = COMP_DTYPE[a['componentType']]
    count = a['count']
    if 'bufferView' not in a:
        arr = np.zeros((count, n), dtype=np.float32)
        if 'sparse' in a:
            raise NotImplementedError('sparse accessors')
        return arr
    bv = gltf['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    size = COMP_SIZE[a['componentType']]
    stride = bv.get('byteStride') or size * n
    if stride == size * n:
        arr = np.frombuffer(blob, dtype=dtype, count=count * n, offset=off).reshape(count, n).copy()
    else:
        arr = np.empty((count, n), dtype=dtype)
        for k in range(count):
            arr[k] = np.frombuffer(blob, dtype=dtype, count=n, offset=off + k * stride)
    return arr


def q_mul(a, b):
    """Hamilton product; applies b then a. a,b are (x,y,z,w)."""
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ], dtype=np.float32)


def q_inv(q):
    x, y, z, w = q
    n = x * x + y * y + z * z + w * w
    return np.array([-x, -y, -z, w], dtype=np.float32) / n


def q_align(q, ref):
    """Flip sign so q is in the same hemisphere as ref (for stable interpolation)."""
    if np.dot(q, ref) < 0:
        return -q
    return q


class Builder:
    def __init__(self, gltf, blob, base_dir: Path):
        self.g = json.loads(json.dumps(gltf))  # deep copy
        self.bin = bytearray(blob)
        self.dir = base_dir
        # flatten to a single buffer
        if self.g.get('buffers'):
            self.g['buffers'] = [{'byteLength': len(self.bin)}]
        else:
            self.g['buffers'] = [{'byteLength': 0}]
        self.g.setdefault('accessors', [])
        self.g.setdefault('bufferViews', [])
        self.g.setdefault('meshes', [])
        self.g.setdefault('nodes', [])
        self.g.setdefault('materials', [])
        self.g.setdefault('textures', [])
        self.g.setdefault('images', [])
        self.g.setdefault('samplers', [])
        self.g.setdefault('animations', [])

    def pad(self, n=4):
        while len(self.bin) % n:
            self.bin.append(0)

    def append_bytes(self, data: bytes, stride=None, target=None) -> int:
        self.pad()
        off = len(self.bin)
        self.bin.extend(data)
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if stride:
            bv['byteStride'] = stride
        if target is not None:
            bv['target'] = target
        self.g['bufferViews'].append(bv)
        return len(self.g['bufferViews']) - 1

    def append_accessor(self, arr: np.ndarray, typ: str, component: int, compact=False, target=None, normalized=False):
        arr = np.ascontiguousarray(arr)
        n = TYPE_N[typ]
        if arr.ndim == 1:
            arr = arr.reshape(-1, n)
        count = arr.shape[0]
        if component == 5126:
            data = arr.astype(np.float32).tobytes()
            mins = arr.min(0).astype(float).tolist()
            maxs = arr.max(0).astype(float).tolist()
        else:
            data = arr.astype(COMP_DTYPE[component]).tobytes()
            mins = maxs = None
        bvi = self.append_bytes(data, target=target)
        acc = {'bufferView': bvi, 'componentType': component, 'count': count, 'type': typ}
        if normalized:
            acc['normalized'] = True
        if mins is not None:
            acc['min'] = mins if n > 1 else [mins[0]]
            acc['max'] = maxs if n > 1 else [maxs[0]]
        self.g['accessors'].append(acc)
        return len(self.g['accessors']) - 1

    def node_index(self, name: str):
        for i, n in enumerate(self.g['nodes']):
            if n.get('name') == name:
                return i
        return None

    def armature_index(self):
        # scene root named Armature, or parent of 'root'
        i = self.node_index('Armature')
        if i is not None:
            return i
        r = self.node_index('root')
        # find parent
        for i, n in enumerate(self.g['nodes']):
            if r in n.get('children', []):
                return i
        return 0

    def bind_trs(self):
        out = {}
        for n in self.g['nodes']:
            name = n.get('name')
            if not name:
                continue
            out[name] = {
                't': np.array(n.get('translation', [0, 0, 0]), dtype=np.float32),
                'r': np.array(n.get('rotation', [0, 0, 0, 1]), dtype=np.float32),
                's': np.array(n.get('scale', [1, 1, 1]), dtype=np.float32),
            }
        return out


def resolve_image(path: Path, uri: str) -> Path | None:
    if not uri or uri.startswith('data:'):
        return None
    p = path / uri
    if p.exists():
        return p
    # common typo in the UBC export
    alt = Path(str(p).replace('_png.png', '.png').replace('_Normal_png.png', '_Normal.png'))
    if alt.exists():
        return alt
    # search nearby
    name = Path(uri).name
    for cand in [path / name, path.parent / name]:
        if cand.exists():
            return cand
        typo = cand.parent / name.replace('_png.png', '.png').replace('_Normal_png.png', '_Normal.png')
        if typo.exists():
            return typo
    return None


def load_image_rgba(path: Path, tint_hair=False, teal_shift=False) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im).astype(np.float32)
    name = path.name.lower()
    if tint_hair and 'hair' in name and 'basecolor' in name:
        rgb = arr[..., :3] / 255.0
        lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.114 * rgb[..., 2])
        # keep texture variation, map onto chestnut
        color = np.clip(lum[..., None] * HAIR_TINT * 2.15, 0, 1)
        arr[..., :3] = color * 255
        im = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    if teal_shift and 'ranger' in name and 'basecolor' in name and '3_' not in name:
        # shift the already-green cloth slightly toward teal; leave browns alone
        rgb = arr[..., :3] / 255.0
        g, r, b = rgb[..., 1], rgb[..., 0], rgb[..., 2]
        is_green = (g > r + 0.04) & (g > b + 0.02)
        # pull red down a touch, lift blue toward teal
        rgb[..., 0] = np.where(is_green, rgb[..., 0] * 0.78, rgb[..., 0])
        rgb[..., 1] = np.where(is_green, np.clip(rgb[..., 1] * 0.92, 0, 1), rgb[..., 1])
        rgb[..., 2] = np.where(is_green, np.clip(rgb[..., 2] + 0.10, 0, 1), rgb[..., 2])
        arr[..., :3] = rgb * 255
        im = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    return im


def resize_for_role(im: Image.Image, uri: str) -> Image.Image:
    name = Path(uri).name.lower()
    if 'eye' in name:
        size = 256
    elif 'hair' in name or 'regular' in name or 'superhero' in name:
        size = 1024
    else:
        size = 1024  # ranger albedo/normal/orm
    if max(im.size) > size:
        im = im.copy()
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
    return im


def embed_image(builder: Builder, im: Image.Image, mime='image/webp', quality=82) -> int:
    import io
    buf = io.BytesIO()
    # webp supports rgb/rgba
    fmt = 'WEBP'
    im.save(buf, format=fmt, quality=quality, method=6)
    data = buf.getvalue()
    bvi = builder.append_bytes(data)
    builder.g['images'].append({'bufferView': bvi, 'mimeType': mime})
    return len(builder.g['images']) - 1


def copy_material_with_images(dst: Builder, src_g, src_blob, src_dir: Path, mat_index: int, cache: dict, tint_hair=False, teal=False) -> int:
    """Copy a material and its textures into dst; cache by (src_id, 'mat')."""
    key = ('mat', id(src_g), mat_index)
    if key in cache:
        return cache[key]
    mat = json.loads(json.dumps(src_g['materials'][mat_index]))

    def copy_tex_info(tex_info):
        if not tex_info or 'index' not in tex_info:
            return tex_info
        ti = int(tex_info['index'])
        tk = ('tex', id(src_g), ti)
        if tk in cache:
            tex_info['index'] = cache[tk]
            return tex_info
        tex = json.loads(json.dumps(src_g['textures'][ti]))
        if 'source' in tex:
            im_i = tex['source']
            ik = ('img', id(src_g), im_i)
            if ik not in cache:
                image = src_g['images'][im_i]
                uri = image.get('uri', image.get('name', f'img{im_i}.png'))
                path = resolve_image(src_dir, uri) if 'uri' in image else None
                if path is None and 'bufferView' in image:
                    # embedded - decode
                    bv = src_g['bufferViews'][image['bufferView']]
                    raw = bytes(src_blob[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
                    import io
                    im = Image.open(io.BytesIO(raw)).convert('RGBA')
                elif path is not None:
                    im = load_image_rgba(path, tint_hair=tint_hair, teal_shift=teal)
                else:
                    print('  WARN missing image', uri, 'from', src_dir)
                    im = Image.new('RGBA', (4, 4), (200, 180, 160, 255))
                im = resize_for_role(im, uri)
                cache[ik] = embed_image(dst, im)
            tex['source'] = cache[ik]
        # drop sampler or copy a default
        if 'sampler' in tex:
            # reuse first sampler or add
            if dst.g['samplers']:
                tex['sampler'] = 0
            else:
                dst.g['samplers'].append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497})
                tex['sampler'] = 0
        dst.g['textures'].append(tex)
        cache[tk] = len(dst.g['textures']) - 1
        tex_info['index'] = cache[tk]
        return tex_info

    pbr = mat.setdefault('pbrMetallicRoughness', {})
    if 'baseColorTexture' in pbr:
        copy_tex_info(pbr['baseColorTexture'])
    if 'metallicRoughnessTexture' in pbr:
        copy_tex_info(pbr['metallicRoughnessTexture'])
    if 'normalTexture' in mat:
        copy_tex_info(mat['normalTexture'])
    if 'occlusionTexture' in mat:
        copy_tex_info(mat['occlusionTexture'])
    if 'emissiveTexture' in mat:
        copy_tex_info(mat['emissiveTexture'])
    dst.g['materials'].append(mat)
    cache[key] = len(dst.g['materials']) - 1
    return cache[key]


def copy_primitive(dst: Builder, src_g, src_blob, prim, joint_map: np.ndarray | None, mat_index: int, crop_mask=None):
    attrs = {}
    pos = accessor_numpy(src_g, src_blob, prim['attributes']['POSITION'])
    keep = np.ones(len(pos), dtype=bool) if crop_mask is None else crop_mask
    new_index = np.full(len(pos), -1, dtype=np.int32)
    new_index[keep] = np.arange(keep.sum(), dtype=np.int32)

    def take(arr):
        return arr[keep]

    # indices
    if 'indices' in prim:
        idx = accessor_numpy(src_g, src_blob, prim['indices']).reshape(-1).astype(np.int32)
        tris = idx.reshape(-1, 3)
        tri_keep = keep[tris].all(axis=1)
        tris = new_index[tris[tri_keep]]
        idx_out = tris.reshape(-1).astype(np.uint32)
        if len(idx_out) == 0:
            return None
        idx_acc = dst.append_accessor(idx_out.reshape(-1, 1), 'SCALAR', 5125, target=34963)
    else:
        idx_acc = None
        if keep.sum() == 0:
            return None

    for name, ai in prim['attributes'].items():
        arr = accessor_numpy(src_g, src_blob, ai)
        arr = take(arr)
        src_acc = src_g['accessors'][ai]
        typ = src_acc['type']
        comp = src_acc['componentType']
        if name == 'JOINTS_0' and joint_map is not None:
            rem = joint_map[arr.astype(np.int32)]
            arr = rem.astype(arr.dtype)
        acc_i = dst.append_accessor(arr, typ, comp, target=34962, normalized=bool(src_acc.get('normalized')))
        attrs[name] = acc_i

    out = {'attributes': attrs, 'material': mat_index}
    if idx_acc is not None:
        out['indices'] = idx_acc
    if 'mode' in prim:
        out['mode'] = prim['mode']
    return out


def crop_mask_for_head(src_g, src_blob, prim, y_cut: float, head_bones: set[int], head_center):
    pos = accessor_numpy(src_g, src_blob, prim['attributes']['POSITION'])
    j = accessor_numpy(src_g, src_blob, prim['attributes']['JOINTS_0']).astype(np.int32)
    w = accessor_numpy(src_g, src_blob, prim['attributes']['WEIGHTS_0']).astype(np.float32)
    head_w = np.zeros(len(pos), dtype=np.float32)
    for k in range(4):
        is_h = np.isin(j[:, k], list(head_bones))
        head_w += np.where(is_h, w[:, k], 0)
    c = np.asarray(head_center, dtype=np.float32)
    dist = np.linalg.norm(pos - c, axis=1)
    # Keep the skull and a short neck stump; drop shoulders/arms even if they sit at the same height.
    mask = (dist < 0.20) & (head_w >= 0.25) & (np.abs(pos[:, 0]) < 0.15)
    mask |= (head_w >= 0.70) & (dist < 0.22) & (np.abs(pos[:, 0]) < 0.13)
    return mask
def joint_name_list(gltf):
    skin = gltf['skins'][0]
    nodes = gltf['nodes']
    return [nodes[i].get('name') for i in skin['joints']]


def add_skinned_meshes(dst: Builder, src_g, src_blob, src_dir: Path, mesh_names: list[str],
                       cache: dict, tint_hair=False, teal=False, crop=None, drop=()):
    """Add named meshes from src onto dst's Armature / skin 0."""
    dst_joints = joint_name_list(dst.g)
    src_joints = joint_name_list(src_g)
    # map src joint index -> dst joint index
    dmap = {n: i for i, n in enumerate(dst_joints)}
    jmap = np.array([dmap[n] for n in src_joints], dtype=np.int32)
    # if identical, still apply (it's a permutation if needed)
    arm = dst.armature_index()
    added = 0
    for mi, mesh in enumerate(src_g['meshes']):
        name = mesh.get('name', '')
        if mesh_names is not None and name not in mesh_names:
            continue
        if any(s.lower() in name.lower() for s in drop):
            continue
        prims_out = []
        for prim in mesh['primitives']:
            mask = None
            if crop is not None and name == crop['body_mesh']:
                mask = crop_mask_for_head(src_g, src_blob, prim, crop['y_cut'], crop['head_joints'], crop['head_center'])
            mat_i = copy_material_with_images(dst, src_g, src_blob, src_dir, prim.get('material', 0), cache, tint_hair=tint_hair, teal=teal)
            p = copy_primitive(dst, src_g, src_blob, prim, jmap, mat_i, crop_mask=mask)
            if p:
                prims_out.append(p)
        if not prims_out:
            print('  skip empty', name)
            continue
        dst.g['meshes'].append({'name': name, 'primitives': prims_out})
        ni = len(dst.g['nodes'])
        dst.g['nodes'].append({'name': name, 'mesh': len(dst.g['meshes']) - 1, 'skin': 0})
        dst.g['nodes'][arm].setdefault('children', []).append(ni)
        added += 1
        print(f'  + mesh {name} prims={len(prims_out)}')
    return added


def drop_meshes(dst: Builder, substrings):
    arm = dst.armature_index()
    children = dst.g['nodes'][arm].get('children', [])
    keep = []
    dropped = []
    for ci in children:
        n = dst.g['nodes'][ci]
        nm = n.get('name', '')
        if n.get('mesh') is not None and any(s.lower() in nm.lower() for s in substrings):
            dropped.append(nm)
            n.pop('mesh', None)
            n.pop('skin', None)
            continue
        keep.append(ci)
    dst.g['nodes'][arm]['children'] = keep
    print('  dropped', dropped)
def retarget_and_add_clips(dst: Builder, ual_g, ual_blob):
    ual_bind = {}
    for n in ual_g['nodes']:
        if n.get('name'):
            ual_bind[n['name']] = {
                't': np.array(n.get('translation', [0, 0, 0]), dtype=np.float32),
                'r': np.array(n.get('rotation', [0, 0, 0, 1]), dtype=np.float32),
                's': np.array(n.get('scale', [1, 1, 1]), dtype=np.float32),
            }
    dst_bind = dst.bind_trs()
    name_to_dst = {n.get('name'): i for i, n in enumerate(dst.g['nodes']) if n.get('name')}

    added = 0
    for anim in ual_g['animations']:
        src_name = anim['name']
        if src_name not in CLIP_KEEP:
            continue
        samplers_out = []
        channels_out = []
        for ch in anim['channels']:
            node_i = ch['target']['node']
            bname = ual_g['nodes'][node_i].get('name')
            if bname not in name_to_dst or bname not in dst_bind or bname not in ual_bind:
                continue
            path = ch['target']['path']
            if path == 'scale':
                continue
            if path == 'translation' and bname not in ('root', 'pelvis'):
                continue
            samp = anim['samplers'][ch['sampler']]
            inn = accessor_numpy(ual_g, ual_blob, samp['input']).reshape(-1)
            out = accessor_numpy(ual_g, ual_blob, samp['output'])
            ub, db = ual_bind[bname], dst_bind[bname]
            if path == 'translation':
                delta = out.astype(np.float32) - ub['t']
                out_v = delta + db['t']
            elif path == 'rotation':
                # out = char_rest * inv(ual_rest) * clip
                # do per-sample
                inv_u = q_inv(ub['r'])
                pre = q_mul(db['r'], inv_u)
                out_v = np.empty_like(out, dtype=np.float32)
                prev = db['r']
                for i, q in enumerate(out):
                    q = q.astype(np.float32)
                    nrm = np.linalg.norm(q)
                    if nrm < 1e-8:
                        q = ub['r']
                    else:
                        q = q / nrm
                    q = q_align(q, ub['r'])
                    r = q_mul(pre, q)
                    r = r / (np.linalg.norm(r) or 1)
                    r = q_align(r, prev)
                    out_v[i] = r
                    prev = r
            else:
                continue
            in_acc = dst.append_accessor(inn.reshape(-1, 1), 'SCALAR', 5126)
            typ = {'translation': 'VEC3', 'scale': 'VEC3', 'rotation': 'VEC4'}[path]
            out_acc = dst.append_accessor(out_v, typ, 5126)
            si = len(samplers_out)
            samplers_out.append({'input': in_acc, 'output': out_acc, 'interpolation': samp.get('interpolation', 'LINEAR')})
            channels_out.append({'sampler': si, 'target': {'node': name_to_dst[bname], 'path': path}})
        alias = CLIP_ALIASES[src_name]
        dst.g['animations'].append({'name': alias, 'samplers': samplers_out, 'channels': channels_out})
        # keep the original name too when it differs
        if alias != src_name:
            dst.g['animations'].append({'name': src_name, 'samplers': samplers_out, 'channels': channels_out})
        print(f'  + clip {src_name} -> {alias} ch={len(channels_out)}')
        added += 1
    return added


def rename_bones(dst: Builder):
    for n in dst.g['nodes']:
        if n.get('name') in BONE_RENAME:
            n['name'] = BONE_RENAME[n['name']]


def write_glb(dst: Builder, path: Path):
    dst.g['buffers'][0]['byteLength'] = len(dst.bin)
    # drop unused extras
    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    js = json.dumps(dst.g, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    blob = bytes(dst.bin)
    while len(blob) % 4:
        blob += b'\x00'
    length = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, length)
    out += struct.pack('<II', len(js), 0x4E4F534A)
    out += js
    out += struct.pack('<II', len(blob), 0x004E4942)
    out += blob
    dest.write_bytes(out)
    print(f'wrote {dest} ({dest.stat().st_size / 1024:.1f} KB)')


def pack_one(spec: dict):
    print(f'\n===== packing {spec["out"]} =====')
    og, ob, od = load_gltf(spec['outfit'])
    dst = Builder(og, ob, od)
    # re-embed / compress / tint existing outfit textures
    # Easier path: rewrite materials' images now
    cache = {}
    # We already have materials in dst pointing at file URIs. Convert them to embedded webp.
    # Walk materials and replace textures in place.
    # First, convert images in-place to embedded, then leave indices.
    new_images = []
    img_map = {}
    for i, image in enumerate(dst.g.get('images', [])):
        uri = image.get('uri')
        path = resolve_image(od, uri) if uri else None
        if path is None:
            print('  WARN outfit image missing', uri)
            im = Image.new('RGBA', (4, 4), (128, 128, 128, 255))
        else:
            im = load_image_rgba(path, tint_hair=False, teal_shift=TEAL_SHIFT)
        im = resize_for_role(im, uri or 'x.png')
        # temporarily collect; embed after we start a clean image list
        img_map[i] = im
    # rebuild images list as embedded, keep indices
    dst.g['images'] = []
    for i in range(len(img_map)):
        embed_image(dst, img_map[i])
    # textures already point at the same source indices. Good.
    # materials stay.

    drop_meshes(dst, spec['drop_substrings'])

    # base character: eyes / brows / cropped head
    bg, bb, bd = load_gltf(spec['base'])
    # head joint indices in the BASE skin
    bjoints = joint_name_list(bg)
    head_joint_idx = {i for i, n in enumerate(bjoints) if n in ('Head', 'neck_01')}
    # y_cut just below the neck so the collar hides the crop
    # neck world y ~ 1.48 female / 1.52 male; use 1.40 / 1.44
    # measure Head node world-ish from bind translation chain is hard; use 1.40 female, 1.44 male
    y_cut = 1.40 if 'Female' in spec['out'] or spec['out'].endswith('hero_f.glb') else 1.44
    if spec['out'] == 'hero_f.glb':
        y_cut = 1.40
    else:
        y_cut = 1.44
    head_center = (0.0, 1.55, -0.01) if spec['out'] == 'hero_f.glb' else (0.0, 1.60, -0.02)
    crop = {'body_mesh': spec['body_mesh'], 'y_cut': y_cut, 'head_joints': head_joint_idx, 'head_center': head_center}
    add_skinned_meshes(dst, bg, bb, bd, list(spec['keep_base_meshes']) + [spec['body_mesh']],
                       cache, tint_hair=True, teal=False, crop=crop)

    # hair
    hg, hb, hd = load_gltf(spec['hair'])
    add_skinned_meshes(dst, hg, hb, hd, None, cache, tint_hair=True, teal=False)

    # animations
    ug, ub, _ = load_gltf(UAL)
    retarget_and_add_clips(dst, ug, ub)

    rename_bones(dst)

    # asset extras
    dst.g['asset'] = {
        'version': '2.0',
        'generator': 'vale3d pack-hero-m21b3b',
        'copyright': 'CC0 1.0 Universal. Models and animations by Quaternius (Universal Base Characters, Modular Character Outfits - Fantasy, Universal Animation Library).',
    }
    # drop extras that may reference missing
    dst.g.pop('extras', None)

    out = OUT_DIR / spec['out']
    write_glb(dst, out)
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pack_one(FEMALE)
    pack_one(MALE)


if __name__ == '__main__':
    main()
