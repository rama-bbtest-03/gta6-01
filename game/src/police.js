// Wanted level (0-5 stars) and the Harbor PD response: police cruisers that chase
// and ram, foot cops who arrest Danny on foot, and wanted decay when you lay low.
import * as THREE from 'three';
import { createCar } from './vehicles.js';
import { makePerson } from './people.js';
import { resolveCollider } from './city.js';

export function addWanted(G, n, reason) {
  if (n <= 0) return;
  G.wanted = Math.min(5, G.wanted + n);
  G.lastCrimeAt = performance.now();
  if (reason) G.feed(reason + ' — wanted level ' + G.wanted);
  G.audio.setSiren(G.wanted > 0);
}

export function updateWanted(G, dt) {
  if (G.wanted === 0) return;
  const now = performance.now();
  if (now - G.lastCrimeAt < 20000) return;
  // Laying low: no police close by, wanted ticks down.
  let nearest = Infinity;
  for (const c of G.policeCars) nearest = Math.min(nearest, c.group.position.distanceTo(G.player.group.position));
  for (const c of G.policeFoot) nearest = Math.min(nearest, c.group.position.distanceTo(G.player.group.position));
  if (nearest > 55) {
    G.wantedDecay = (G.wantedDecay || 0) + dt;
    if (G.wantedDecay > 4) {
      G.wantedDecay = 0;
      G.wanted = Math.max(0, G.wanted - 1);
      G.feed('The heat is cooling off… wanted level ' + G.wanted);
      if (G.wanted === 0) G.audio.setSiren(false);
    }
  } else {
    G.wantedDecay = 0;
  }
}

function spawnPoliceCar(G) {
  const p = G.player.group.position;
  const angle = Math.random() * Math.PI * 2;
  const pos = new THREE.Vector3(
    Math.max(-200, Math.min(200, p.x + Math.sin(angle) * 75)),
    0,
    Math.max(-200, Math.min(200, p.z + Math.cos(angle) * 75)));
  const car = createCar(G.scene, { police: true, color: 0xf2f2f2, pos, angle });
  car.ai = null;
  G.policeCars.push(car);
  G.allCars.push(car);
}

function spawnFootCop(G) {
  const p = G.player.group.position;
  const angle = Math.random() * Math.PI * 2;
  const pos = new THREE.Vector3(p.x + Math.sin(angle) * 25, 0, p.z + Math.cos(angle) * 25);
  const group = makePerson(G.scene, { shirt: 0x1a2a5e, pants: 0x1a2a5e, skin: 0xe8b88a, pos });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x101a3a }));
  cap.position.y = 1.95;
  group.add(cap);
  G.policeFoot.push({ group, angle, speed: 6.4 });
}

export function ensurePoliceCars(G, n) {
  while (G.policeCars.length < n) spawnPoliceCar(G);
}

export function updatePolice(G, dt) {
  // Match force to wanted level.
  const wantCars = G.wanted >= 4 ? 3 : G.wanted >= 2 ? 2 : G.wanted >= 1 ? 1 : 0;
  const wantFoot = G.wanted >= 3 ? 2 : G.wanted >= 1 ? 1 : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeFoot.length < wantFoot) spawnFootCop(G);
  // Remove extras when wanted drops.
  while (G.policeCars.length > wantCars) {
    const c = G.policeCars.pop();
    G.scene.remove(c.group);
    G.allCars.splice(G.allCars.indexOf(c), 1);
  }
  while (G.policeFoot.length > wantFoot) {
    const c = G.policeFoot.pop();
    G.scene.remove(c.group);
  }
  const playerPos = G.player.group.position;
  const now = performance.now();

  // Cruiser chase: steer at the player, ram the player's car, flash the light bar.
  for (const car of G.policeCars) {
    const p = car.group.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const d = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const targetSpeed = Math.min(28, (G.playerCar ? Math.abs(G.playerCar.speed) + 3 : 16));
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    p.x += Math.sin(car.angle) * car.speed * dt;
    p.z += Math.cos(car.angle) * car.speed * dt;
    resolveCollider(G.city.colliders, p, 2.3);
    car.group.rotation.y = car.angle;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
    // Flashing light bar.
    if (car.lightBar) {
      const phase = Math.floor(now / 300) % 2 === 0;
      car.lightBar.red.material.color.setHex(phase ? 0xff2020 : 0x550000);
      car.lightBar.blue.material.color.setHex(phase ? 0x101040 : 0x2040ff);
    }
    // Ram: damage Danny when the cruiser hits his car, or bust him on foot.
    if (d < 4.5) {
      if (G.playerCar) {
        G.damagePlayer(8 * dt * 3, 'Harbor PD ram');
        G.playerCar.speed *= 0.985;
      } else if (G.wanted > 0) {
        G.busted('The Harbor PD caught you on foot.');
      }
    }
  }

  // Foot cops sprint at Danny; touching him on foot while wanted = busted.
  for (const cop of G.policeFoot) {
    const p = cop.group.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const d = Math.hypot(dx, dz);
    cop.angle = Math.atan2(dx, dz);
    const sp = d > 30 ? cop.speed : cop.speed * 0.9;
    p.x += Math.sin(cop.angle) * sp * dt;
    p.z += Math.cos(cop.angle) * sp * dt;
    resolveCollider(G.city.colliders, p, 0.6);
    cop.group.rotation.y = cop.angle;
    cop.group.position.y = Math.abs(Math.sin(now / 140)) * 0.08;
    if (d < 1.7 && !G.playerCar && G.wanted > 0) G.busted('A Harbor PD officer cuffed you.');
  }
}
