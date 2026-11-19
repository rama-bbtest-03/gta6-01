// Cars: mesh factory, arcade player driving, AI traffic loops, parked cars.
import * as THREE from 'three';
import { pick, range, rangeInt } from './rng.js';
import { resolveCollider } from './city.js';

const CAR_COLORS = [0xd83838, 0x2e7fd8, 0xe8c832, 0x37c878, 0xe8e8e8, 0x22262c, 0xd8722e, 0x8a4fd8, 0x38c8c8];
const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Mamba', 'Dune', 'Falcon', 'Voodoo', 'Rascal'];

export function createCar(scene, opts) {
  const o = opts || {};
  const color = o.color ?? pick(o.rng || Math.random, CAR_COLORS);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const lx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    hl.position.set(lx, 0.6, 2.21);
    group.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const lx of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    tl.position.set(lx, 0.6, -2.21);
    group.add(tl);
  }
  let lightBar = null;
  if (o.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.42, 1.64, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.45),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.42, 1.64, -0.2);
    group.add(blue);
    lightBar = { red, blue };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    stripe.position.y = 0.75;
    group.add(stripe);
  }
  group.position.copy(o.pos || new THREE.Vector3());
  group.rotation.y = o.angle || 0;
  scene.add(group);
  const car = {
    group, wheels, lightBar,
    name: o.name || pick(o.rng || Math.random, CAR_NAMES),
    kind: o.police ? 'police' : (o.kind || 'civil'),
    angle: o.angle || 0,
    speed: 0,
    maxSpeed: o.police ? 26 : 22,
    parked: !!o.parked,
    stolen: false,
    ai: o.ai || null,
    flash: 0,
  };
  return car;
}

export function spawnTraffic(scene, rng) {
  const cars = [];
  const usedBlocks = new Set();
  for (let i = 0; i < 14; i++) {
    let bx, bz, key;
    do { bx = rangeInt(rng, -5, 4); bz = rangeInt(rng, -5, 4); key = bx + ',' + bz; }
    while (usedBlocks.has(key));
    usedBlocks.add(key);
    const cx = bx * 40 + 20, cz = bz * 40 + 20;
    const loop = [
      new THREE.Vector3(cx - 40, 0, cz - 40), new THREE.Vector3(cx + 40, 0, cz - 40),
      new THREE.Vector3(cx + 40, 0, cz + 40), new THREE.Vector3(cx - 40, 0, cz + 40),
    ];
    const start = loop[rangeInt(rng, 0, 3)];
    const car = createCar(scene, { rng, pos: new THREE.Vector3(start.x, 0, start.z), angle: rng() * Math.PI * 2 });
    car.ai = { loop, wp: 0, speed: range(rng, 8, 13) };
    car.speed = car.ai.speed;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(scene, rng) {
  const cars = [];
  const spots = [];
  for (let i = -4; i <= 4; i++) {
    spots.push([i * 40 + 9, -160 + range(rng, 0, 20)]);
    spots.push([i * 40 - 9, 120 + range(rng, 0, 20)]);
    spots.push([150 + range(rng, 0, 20), i * 40 + 9]);
  }
  for (let i = 0; i < 10; i++) {
    const s = spots[i % spots.length];
    const car = createCar(scene, {
      rng, parked: true,
      pos: new THREE.Vector3(s[0] + range(rng, -2, 2), 0, s[1] + range(rng, -2, 2)),
      angle: (i % 2 === 0 ? 0 : Math.PI / 2) + range(rng, -0.1, 0.1),
    });
    cars.push(car);
  }
  return cars;
}

export function nearestCar(pos, cars, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    if (c.kind === 'police') continue;
    const d = c.group.position.distanceTo(pos);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function collideCars(car, others, G) {
  for (const o of others) {
    if (o === car) continue;
    const dx = car.group.position.x - o.group.position.x;
    const dz = car.group.position.z - o.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const nx = dx / d, nz = dz / d;
      car.group.position.x += nx * push;
      car.group.position.z += nz * push;
      if (!o.ai || o.parked) { o.group.position.x -= nx * push; o.group.position.z -= nz * push; }
      if (Math.abs(car.speed) > 6 && G) {
        car.speed *= 0.55;
        if (G.audio) G.audio.crash();
        if (car === G.playerCar && G.onCrash) G.onCrash();
      }
    }
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    const ai = car.ai;
    if (!ai) continue;
    const target = ai.loop[ai.wp];
    const p = car.group.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) { ai.wp = (ai.wp + 1) % ai.loop.length; continue; }
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    // Slow down if something is right ahead.
    let slow = false;
    for (const o of G.allCars) {
      if (o === car) continue;
      const ox = o.group.position.x - p.x, oz = o.group.position.z - p.z;
      const od = Math.hypot(ox, oz);
      if (od < 9 && od > 0.1) {
        const fwd = Math.sin(car.angle) * ox + Math.cos(car.angle) * oz;
        if (fwd > 0) { slow = true; break; }
      }
    }
    const sp = slow ? ai.speed * 0.25 : ai.speed;
    car.speed += (sp - car.speed) * Math.min(1, dt * 2);
    p.x += Math.sin(car.angle) * car.speed * dt;
    p.z += Math.cos(car.angle) * car.speed * dt;
    car.group.rotation.y = car.angle;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
  }
}

// Arcade driving for the player's car. Returns the speed in mph-ish units.
export function updatePlayerCar(G, dt, input) {
  const car = G.playerCar;
  if (!car) return 0;
  const fwd = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const dir = car.speed >= 0 ? 1 : -1;
  if (fwd) car.speed += 16 * dt;
  if (back) car.speed -= car.speed > 0.5 ? 24 * dt : 9 * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  car.speed = Math.max(-10, Math.min(car.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 0.3) {
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    car.angle += steer * 1.9 * dt * dir * Math.min(1, Math.abs(car.speed) / 8);
  }
  const p = car.group.position;
  p.x += Math.sin(car.angle) * car.speed * dt;
  p.z += Math.cos(car.angle) * car.speed * dt;
  if (resolveCollider(G.city.colliders, p, 2.3)) {
    car.speed *= 0.4;
    if (Math.abs(car.speed) > 4) G.audio.crash();
  }
  p.x = Math.max(-215, Math.min(215, p.x));
  p.z = Math.max(-215, Math.min(305, p.z));
  collideCars(car, G.allCars, G);
  car.group.rotation.y = car.angle;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
  G.audio.setEngine(Math.abs(car.speed) / car.maxSpeed, true);
  return Math.abs(car.speed) * 2.2;
}
