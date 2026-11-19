// Neon Harbor: a procedural sun-soaked coastal city — grid streets, towers with
// lit-window canvas textures, palms, lamps, a beach and the sea to the south.
import * as THREE from 'three';
import { pick, range, rangeInt } from './rng.js';

export const CITY_HALF = 200;      // city spans -200..200 in x and z
export const BLOCK = 40;           // street spacing
export const ROAD_HALF = 6;        // half road width

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildingTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 2);
    for (let y = 12; y < h - 8; y += 24) {
      for (let x = 10; x < w - 8; x += 22) {
        g.fillStyle = Math.random() < 0.45 ? lit : 'rgba(20,30,50,0.85)';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

function roadTexture() {
  const t = canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#2c2f36'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd23f';
    g.fillRect(w / 2 - 2, 8, 4, 40); g.fillRect(w / 2 - 2, 72, 4, 40);
    g.fillStyle = '#e8e8e8';
    g.fillRect(2, 0, 3, h); g.fillRect(w - 5, 0, 3, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sky, sun, fog.
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9fc6e8, 320, 900);
  const sun = new THREE.DirectionalLight(0xfff1c4, 2.6);
  sun.position.set(180, 260, 120);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a5a3a, 1.1));

  // Ground: grass-ish city slab, sand beach strip, sea plane to the south (+z).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x4d7a4a }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 70),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 235);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 320),
    new THREE.MeshLambertMaterial({ color: 0x1e6fa8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, 430);
  group.add(sea);

  // Roads: one strip per street line, dashed texture repeated along its length.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const streets = [];
  for (let i = -5; i <= 5; i++) streets.push(i * BLOCK);
  for (const s of streets) {
    const mk = (w, l, x, z, rotY, rep) => {
      const tex = roadTex.clone();
      tex.needsUpdate = true; tex.repeat.set(1, rep);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
        new THREE.MeshLambertMaterial({ map: tex }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = rotY;
      m.position.set(x, 0.02, z);
      group.add(m);
    };
    mk(12, 420, s, 0, 0, 14);          // north-south street
    mk(12, 420, 0, s, Math.PI / 2, 14); // east-west street
  }
  // Sidewalk slabs at each block center (blocks sit between streets: centers at
  // 20 + 40k, so streets at multiples of 40 stay clear for driving).
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const walkGeo = new THREE.BoxGeometry(BLOCK - 12, 0.3, BLOCK - 12);
  for (let bx = -5; bx <= 4; bx++) {
    for (let bz = -5; bz <= 4; bz++) {
      const w = new THREE.Mesh(walkGeo, walkMat);
      w.position.set(bx * BLOCK + 20, 0.12, bz * BLOCK + 20);
      group.add(w);
    }
  }

  // Buildings: one or two per block, canvas window textures, varied heights.
  const facades = [
    buildingTexture('#c96a5e', '#ffe9a8'), buildingTexture('#5e7fa8', '#bfe8ff'),
    buildingTexture('#8a6fb0', '#ffd6f2'), buildingTexture('#5ea88a', '#d8ffe9'),
    buildingTexture('#b09a5e', '#fff2c4'), buildingTexture('#7a8a96', '#cfe8ff'),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -5; bx <= 4; bx++) {
    for (let bz = -5; bz <= 4; bz++) {
      // Skip a few blocks for parking lots / parks.
      if (rng() < 0.12) continue;
      const cx = bx * BLOCK + 20, cz = bz * BLOCK + 20;
      const n = rng() < 0.55 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const w = range(rng, 12, 20), d = range(rng, 12, 20), hgt = range(rng, 10, 46);
        const ox = n === 1 ? 0 : (k === 0 ? -7 : 7);
        const oz = n === 1 ? 0 : (k === 0 ? -6 : 6);
        const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades) });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, hgt, d);
        b.position.set(cx + ox, hgt / 2, cz + oz);
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx + ox, hgt + 0.4, cz + oz);
        group.add(roof);
        // Neon sign strip on some towers.
        if (rng() < 0.4) {
          const neon = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 1.1, 0.4),
            new THREE.MeshBasicMaterial({ color: pick(rng, [0xff2e7d, 0x2ee8ff, 0xffe93f, 0x7dff6b]) }));
          neon.position.set(cx + ox, hgt * 0.82, cz + oz + d / 2 + 0.2);
          group.add(neon);
        }
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
    }
  }

  // Palm trees along the beach and a few in the plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
    trunk.position.y = 4.5; trunk.rotation.z = 0.08;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), leafMat);
      leaf.position.y = 9.2;
      leaf.rotation.z = Math.PI / 2.4;
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.translateY(1.2);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let x = -190; x <= 190; x += 24) palm(x + range(rng, -3, 3), 214);
  palm(-8, 8); palm(10, -6); palm(6, 12); palm(-12, -10);

  // Street lamps at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let ix = -4; ix <= 4; ix += 2) {
    for (let iz = -4; iz <= 4; iz += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(ix * BLOCK + 8, 3.5, iz * BLOCK + 8);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), bulbMat);
      bulb.position.set(ix * BLOCK + 8, 7.1, iz * BLOCK + 8);
      group.add(bulb);
    }
  }

  // Central plaza (0,0): fountain ring + benches, no buildings.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x8fa8b8 }));
  fountain.position.set(0, 0.7, 0);
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 20),
    new THREE.MeshLambertMaterial({ color: 0x2e9fd8 }));
  water.position.set(0, 1.3, 0);
  group.add(water);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });

  // Safehouse: small house + garage at the north-west corner (-180,-180).
  const houseMat = new THREE.MeshLambertMaterial({ color: 0xffd9a0 });
  const house = new THREE.Mesh(boxGeo, houseMat);
  house.scale.set(14, 7, 10); house.position.set(-182, 3.5, -184);
  group.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 4, 4),
    new THREE.MeshLambertMaterial({ color: 0xa03a3a }));
  roof.position.set(-182, 9, -184); roof.rotation.y = Math.PI / 4;
  group.add(roof);
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x5a6a7a }));
  garage.scale.set(12, 5, 8); garage.position.set(-166, 2.5, -184);
  group.add(garage);
  colliders.push({ minX: -189, maxX: -175, minZ: -189, maxZ: -179 });
  colliders.push({ minX: -172, maxX: -160, minZ: -188, maxZ: -180 });

  // Pier: wooden deck from the beach into the sea at (0, 240+).
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), deckMat);
  pier.position.set(0, 0.6, 268);
  group.add(pier);
  for (let z = 244; z <= 292; z += 12) {
    for (const dx of [-4.5, 4.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), deckMat);
      post.position.set(dx, 0, z);
      group.add(post);
    }
  }

  return {
    colliders,
    landmarks: {
      safehouse: new THREE.Vector3(-172, 0, -172),
      garage: new THREE.Vector3(160, 0, 160),
      pier: new THREE.Vector3(0, 0, 292),
      plaza: new THREE.Vector3(0, 0, 0),
      beach: new THREE.Vector3(40, 0, 222),
    },
  };
}

// Is a point inside any building collider? Used by movement + spawning.
export function hitsCollider(colliders, x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
  }
  return null;
}

// Push a circle out of a collider (axis of least penetration).
export function resolveCollider(colliders, pos, r) {
  const c = hitsCollider(colliders, pos.x, pos.z, r);
  if (!c) return false;
  const dxl = pos.x + r - c.minX, dxr = c.maxX - (pos.x - r);
  const dzl = pos.z + r - c.minZ, dzr = c.maxZ - (pos.z - r);
  const m = Math.min(dxl, dxr, dzl, dzr);
  if (m === dxl) pos.x = c.minX - r;
  else if (m === dxr) pos.x = c.maxX + r;
  else if (m === dzl) pos.z = c.minZ - r;
  else pos.z = c.maxZ + r;
  return true;
}
