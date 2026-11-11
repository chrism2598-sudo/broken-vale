import * as THREE from 'three';
/**
 * G3 · Enna Marr's own silhouette. The rig is the shared CC0 female base, but she is dressed with procedural,
 * bone-attached gear so she reads as a different person from Ilka at any distance: a knee-length sea-worn
 * travelling coat that flares from the hips, a hooded shoulder mantle, a long ash-streaked braid, a cross-body
 * map satchel, a small blue sea-glass pendant. Built in character space at the rest pose,
 * then `bone.attach()`-ed so every piece keeps its world transform and follows the animation.
 */
export function dressEnna(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const bone = (n: string) => root.getObjectByName(n) ?? root.getObjectByName(n.replace('.', ''));
  const hips = bone('Hips'), chest = bone('Chest'), head = bone('Head'), neck = bone('Neck');
  if (!hips || !chest || !head) return;
  // Character space = the parent of root (wrap). Read bone heights there.
  const space = root.parent ?? root; space.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  const at = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const hP = at(hips), cP = at(chest), headP = at(head), nP = neck ? at(neck) : cP.clone().lerp(headP, 0.5);
  const H = headP.y; // ~1.45 m for a 1.68 m figure
  const std = (color: string, rough = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  const coatM = std('#3e5a5c', 0.93, { side: THREE.DoubleSide }), trimM = std('#b98a3c', 0.6), mantleM = std('#6e5b45', 0.95, { side: THREE.DoubleSide });
  const hairM = std('#9b948a', 0.75), leatherM = std('#5a3b24', 0.8);
  const glassM = new THREE.MeshStandardMaterial({ color: '#6fd3e6', emissive: '#2aa7c4', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1 });
  const put = (m: THREE.Object3D, b: THREE.Object3D) => { m.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } }); space.add(m); m.updateWorldMatrix(true, true); b.attach(m); };
  // Coat skirt: lathe from waist to just below the knee, flaring, with a back vent and a hem wobble so it isn't a perfect cone.
  { const top = hP.y + 0.1, bot = hP.y * 0.36, pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.17 + 0.17 * Math.pow(t, 1.3), top - (top - bot) * t)); }
    const g = new THREE.LatheGeometry(pts, 28, 0.35, Math.PI * 2 - 0.7); // gap at the back = vent (lathe starts at +Z… rotated below)
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = (top - y) / (top - bot); const a = Math.atan2(p.getX(i), p.getZ(i)); const w = 1 + 0.06 * k * Math.sin(a * 5 + 1.3); p.setX(i, p.getX(i) * w * (1 - 0.12 * k * Math.max(0, Math.cos(a)))); p.setZ(i, p.getZ(i) * w); }
    g.computeVertexNormals(); const skirt = new THREE.Mesh(g, coatM); skirt.position.set(hP.x, 0, hP.z); skirt.rotation.y = Math.PI; // vent to the back
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 4, 28, Math.PI * 2 - 0.7), trimM); hem.rotation.set(Math.PI / 2, 0, 0); hem.position.set(0, bot + 0.01, 0); skirt.add(hem);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.055, 22, 1, true), leatherM); belt.position.set(0, top - 0.02, 0); skirt.add(belt);
    put(skirt, hips); }
  // Hooded mantle: a short open cape over the shoulders with the hood folded down behind the neck.
  { const y0 = nP.y + 0.02, pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(0.09 + 0.2 * Math.sin(t * 1.4), y0 - 0.26 * t)); }
    const g = new THREE.LatheGeometry(pts, 26); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setZ(i, z * (z > 0 ? 0.62 : 0.85)); p.setX(i, p.getX(i) * 1.18); } // flatter on the chest, wider over the shoulders
    g.computeVertexNormals(); const mantle = new THREE.Mesh(g, mantleM); mantle.position.set(cP.x, 0, cP.z);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mantleM); hood.scale.set(1.15, 0.7, 0.8); hood.rotation.x = -2.1; hood.position.set(0, y0 - 0.03, -0.12); mantle.add(hood);
    const clasp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), glassM); clasp.position.set(0, y0 - 0.1, 0.13); mantle.add(clasp); // the sea-glass pendant
    put(mantle, chest); }
  // Long braid down the back with a bound end, and a low knot at the nape: a different hair silhouette from Ilka's.
  { const braid = new THREE.Group(); const n = 9;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); const s = new THREE.Mesh(new THREE.SphereGeometry(0.034 * (1 - 0.35 * t), 8, 6), hairM); s.scale.set(1, 1.35, 0.9); s.position.set(Math.sin(i * 1.7) * 0.008, H - 0.06 - t * 0.48, headP.z - 0.11 - 0.04 * Math.sin(t * 2.4)); braid.add(s); }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), hairM); knot.scale.set(1.2, 0.9, 0.85); knot.position.set(0, H - 0.02, headP.z - 0.1); braid.add(knot);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 4, 10), trimM); tie.rotation.x = Math.PI / 2; tie.position.set(0, H - 0.5, headP.z - 0.12); braid.add(tie);
    braid.position.x = headP.x; put(braid, head); }
  // Cross-body map satchel (strap over the right shoulder, bag at the left hip).
  { const bag = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.24), leatherM); box.position.set(0.24, hP.y - 0.02, hP.z + 0.02); bag.add(box);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.245), std('#46301e', 0.8)); flap.position.set(0.245, hP.y + 0.05, hP.z + 0.02); bag.add(flap);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10), std('#d8c9a3', 0.9)); roll.rotation.x = Math.PI / 2; roll.position.set(0.26, hP.y + 0.12, hP.z + 0.02); bag.add(roll); // a rolled chart
    put(bag, hips);
    const len = Math.hypot(0.42, cP.y + 0.18 - hP.y); const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, len, 0.012), leatherM);
    strap.position.set(0.02, (cP.y + 0.18 + hP.y) / 2, cP.z + 0.115); strap.rotation.z = Math.atan2(0.42, cP.y + 0.18 - hP.y); put(strap, chest); }
}
