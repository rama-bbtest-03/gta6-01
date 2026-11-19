// People: pedestrians on the sidewalks (they flee from danger) and Viper gang
// enemies who fight back during the Street War mission.
import * as THREE from 'three';
import { pick, range, rangeInt } from './rng.js';
import { resolveCollider } from './city.js';

const SHIRTS = [0xe8e8e8, 0xd84a6a, 0x4a9fd8, 0xe8c832, 0x7ac84a, 0xd8722e, 0xb06fd8, 0x38c8c8];
const PANTS = [0x2a2f38, 0x3a4a6a, 0x5a4a3a, 0x222222];

export function makePerson(scene, opts) {
  const o = opts || {};
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: o.shirt ?? pick(o.rng || Math.random, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: o.pants ?? pick(o.rng || Math.random, PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: o.skin ?? pick(o.rng || Math.random, [0xe8b88a, 0xc98a5e, 0x8a5a3a, 0xf0c8a0]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  group.add(head);
  for (const lx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.28), pants);
    leg.position.set(lx, 0.31, 0);
    group.add(leg);
  }
  if (o.gang) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.38),
      new THREE.MeshBasicMaterial({ color: 0x9c1f3f }));
    band.position.y = 1.5;
    group.add(band);
  }
  group.position.copy(o.pos || new THREE.Vector3());
  scene.add(group);
  return group;
}

function randomSidewalkPoint(rng) {
  // On a sidewalk: just off a street line.
  const street = rangeInt(rng, -5, 5) * 40;
  if (rng() < 0.5) return new THREE.Vector3(street + (rng() < 0.5 ? 9 : -9), 0, range(rng, -190, 190));
  return new THREE.Vector3(range(rng, -190, 190), 0, street + (rng() < 0.5 ? 9 : -9));
}

export function spawnPeds(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const pos = randomSidewalkPoint(rng);
    const group = makePerson(scene, { rng, pos });
    peds.push({
      group, angle: rng() * Math.PI * 2, speed: range(rng, 1.2, 2.2),
      target: randomSidewalkPoint(rng), flee: 0, dead: false,
    });
  }
  return peds;
}

export function updatePeds(G, dt) {
  const playerPos = G.player.group.position;
  const danger = G.dangerAt; // {pos, until} set by gunfire / speeding cars
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const p = ped.group.position;
    // Flee if danger is close or a fast car is near.
    let fleeing = ped.flee > 0;
    if (danger && performance.now() < danger.until && p.distanceTo(danger.pos) < 45) fleeing = true;
    if (G.playerCar && Math.abs(G.playerCar.speed) > 12 && p.distanceTo(playerPos) < 10) fleeing = true;
    if (fleeing) {
      ped.flee = 1.2;
      const away = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
      ped.angle += (away - ped.angle) * Math.min(1, dt * 6);
      p.x += Math.sin(ped.angle) * 5.5 * dt;
      p.z += Math.cos(ped.angle) * 5.5 * dt;
    } else {
      const t = ped.target;
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { ped.target = randomSidewalkPoint(G.rng); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      p.x += Math.sin(ped.angle) * ped.speed * dt;
      p.z += Math.cos(ped.angle) * ped.speed * dt;
    }
    ped.flee = Math.max(0, ped.flee - dt);
    resolveCollider(G.city.colliders, p, 0.6);
    p.x = Math.max(-205, Math.min(205, p.x));
    p.z = Math.max(-205, Math.min(215, p.z));
    ped.group.rotation.y = ped.angle;
    // Little walk bob.
    ped.group.position.y = Math.abs(Math.sin(performance.now() / 180 + ped.speed * 10)) * 0.06;
  }
}

// Viper gang enemies for the Street War mission.
export function spawnEnemies(scene, positions) {
  const enemies = [];
  for (const pos of positions) {
    const group = makePerson(scene, { gang: true, shirt: 0x3a1a2a, pants: 0x222222, pos });
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x330000 }));
    barBg.position.y = 2.15;
    group.add(barBg);
    const barFg = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    barFg.position.y = 2.15;
    group.add(barFg);
    enemies.push({ group, barFg, health: 100, alive: true, shootTimer: range(Math.random, 0.5, 1.5), speed: 3.2 });
  }
  return enemies;
}

export function updateEnemies(G, dt) {
  const playerPos = G.player.group.position;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const p = e.group.position;
    const d = p.distanceTo(playerPos);
    e.barFg.scale.x = Math.max(0.01, e.health / 100);
    e.barFg.position.x = -(1.05 - 1.05 * (e.health / 100)) / 2;
    if (d > 60) continue;
    // Face the player and close in to shooting range.
    const want = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
    let diff = want - e.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    e.group.rotation.y += Math.max(-3 * dt, Math.min(3 * dt, diff));
    if (d > 14) {
      p.x += Math.sin(e.group.rotation.y) * e.speed * dt;
      p.z += Math.cos(e.group.rotation.y) * e.speed * dt;
      resolveCollider(G.city.colliders, p, 0.6);
    }
    // Shoot back.
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 38 && !G.paused) {
      e.shootTimer = range(Math.random, 0.9, 1.8);
      G.audio.enemyShot();
      if (Math.random() < 0.45) G.damagePlayer(6, 'Viper gunfire');
      G.spawnTracer(p.clone().add(new THREE.Vector3(0, 1.4, 0)), playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffaa33);
    }
  }
}
