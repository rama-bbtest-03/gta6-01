// NEON HARBOR — main loop: third-person player, driving, camera, health, busted /
// wasted / win flow, screen wiring, and the deterministic screenshot mode.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, resolveCollider } from './city.js';
import { createCar, spawnTraffic, spawnParked, nearestCar, updateTraffic, updatePlayerCar } from './vehicles.js';
import { makePerson, spawnPeds, updatePeds, spawnEnemies, updateEnemies } from './people.js';
import { addWanted, updateWanted, updatePolice, ensurePoliceCars } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { saveGameData, loadGameData, hasSave } from './save.js';
import { parseShot, applyShot } from './shots.js';

window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  if (el) el.textContent = 'ERR: ' + (e.message || e.error);
});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 8, 20);

const shot = parseShot();
const rng = makeRng(shot ? shot.seed : (Math.floor(Math.random() * 1e9) + 7));

const G = {
  scene, camera, renderer, rng,
  city: null, hud: createHud(), audio: createAudio(),
  player: null, playerCar: null, missionCar1: null,
  traffic: [], parked: [], allCars: [], peds: [], enemies: [],
  policeCars: [], policeFoot: [],
  wanted: 0, lastCrimeAt: 0, wantedDecay: 0,
  dangerAt: null, started: false, paused: false,
  endState: null, endTimer: 0, lastDamageAt: 0, lastSpeed: 0,
  camYaw: Math.PI * 0.25, camPitch: 0.32, shotCamera: null,
  missions: null, combat: null,
  tracers: [], sparks: [],
};
G.input = createInput(canvas);

// ---- World ----
G.city = buildCity(scene, rng);
G.traffic = spawnTraffic(scene, rng);
G.parked = spawnParked(scene, rng);
G.missionCar1 = createCar(scene, {
  rng, parked: true, color: 0xd83838, name: 'Comet',
  pos: new THREE.Vector3(120, 0, -40), angle: Math.PI / 2,
});
G.allCars = [...G.traffic, ...G.parked, G.missionCar1];
G.peds = spawnPeds(scene, rng, 20);

// ---- Player: Danny "D" Marlowe ----
const playerGroup = makePerson(scene, { shirt: 0x5e1a1a, pants: 0x2a3a5a, skin: 0xe8b88a, pos: new THREE.Vector3(-172, 0, -168) });
G.player = { group: playerGroup, angle: Math.PI / 4, health: 100, cash: 0, speed: 0 };
playerGroup.rotation.y = G.player.angle;

G.missions = createMissions(G);
G.combat = createCombat(G);

// ---- Shared helpers other modules call on G ----
G.feed = (t) => G.hud.message(t);
G.addWanted = (n, reason) => addWanted(G, n, reason);
G.ensurePoliceCars = (n) => ensurePoliceCars(G, n);
G.saveGame = () => {
  const ok = saveGameData(G);
  document.getElementById('savestate').textContent = ok
    ? 'Saved — mission ' + (G.missions.index + 1) + ' of 5, $' + G.player.cash.toLocaleString('en-US') + '.'
    : 'Save failed (browser storage unavailable).';
  return ok;
};
G.damagePlayer = (n, cause) => {
  if (!G.started || G.paused || G.endState) return;
  G.player.health -= n;
  G.lastDamageAt = performance.now();
  if (G.player.health <= 0) { G.player.health = 0; G.wasted(cause); }
};
G.onCrash = () => { G.addWanted(0); };
G.onEnemyKilled = () => {};
G.spawnTracer = (a, b, color) => {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  scene.add(line);
  G.tracers.push({ line, ttl: 0.12 });
};
G.spawnSpark = (p) => {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  s.position.copy(p);
  scene.add(s);
  G.sparks.push({ mesh: s, ttl: 0.25 });
};
G.spawnViperSquad = () => {
  const L = G.city.landmarks.plaza;
  const spots = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spots.push(new THREE.Vector3(L.x + Math.sin(a) * 16, 0, L.z + Math.cos(a) * 16));
  }
  for (const e of G.enemies) scene.remove(e.group);
  G.enemies = spawnEnemies(scene, spots);
  G.feed('Vipers in the plaza — take them all out!');
};
G.enterCar = (car, silent) => {
  if (car.ai) { G.traffic.splice(G.traffic.indexOf(car), 1); car.ai = null; }
  car.parked = false;
  G.playerCar = car;
  G.player.group.visible = false;
  car.speed = 0;
  if (!silent) {
    G.audio.pickup();
    if (!car.stolen && car !== G.missionCar1) {
      car.stolen = true;
      G.addWanted(1, 'You stole a ' + car.name + '!');
    } else if (car !== G.missionCar1) {
      G.feed('Back in the ' + car.name + '.');
    }
  }
};
G.exitCar = () => {
  const car = G.playerCar;
  if (!car) return;
  const side = new THREE.Vector3(Math.cos(car.angle), 0, -Math.sin(car.angle));
  G.player.group.position.copy(car.group.position).addScaledVector(side, 2.5);
  G.player.group.position.y = 0;
  G.player.angle = car.angle;
  G.player.group.rotation.y = G.player.angle;
  G.player.group.visible = true;
  G.playerCar = null;
  car.speed = 0;
  G.audio.setEngine(0, false);
};
G.busted = (why) => {
  if (G.endState) return;
  G.endState = 'busted';
  G.endTimer = 2.6;
  const lost = Math.floor(G.player.cash * 0.2);
  G.player.cash -= lost;
  G.audio.busted();
  G.audio.setSiren(false);
  G.hud.wastedtitle.textContent = 'BUSTED';
  G.hud.wastedsub.textContent = why + ' The PD took $' + lost.toLocaleString('en-US') + ' as a "fine".';
  G.hud.wasted.classList.remove('hidden');
};
G.wasted = (cause) => {
  if (G.endState) return;
  G.endState = 'wasted';
  G.endTimer = 2.6;
  const lost = Math.floor(G.player.cash * 0.1);
  G.player.cash -= lost;
  G.audio.busted();
  G.audio.setSiren(false);
  G.hud.wastedtitle.textContent = 'WASTED';
  G.hud.wastedsub.textContent = (cause || 'You didn\'t make it.') + ' The hospital bill cost $' + lost.toLocaleString('en-US') + '.';
  G.hud.wasted.classList.remove('hidden');
};
G.showWin = () => {
  G.paused = true;
  document.getElementById('winscreen').classList.remove('hidden');
};
G.respawn = () => {
  if (G.playerCar) { G.playerCar.speed = 0; G.playerCar = null; G.audio.setEngine(0, false); }
  G.player.group.position.set(-172, 0, -168);
  G.player.angle = Math.PI / 4;
  G.player.group.rotation.y = G.player.angle;
  G.player.group.visible = true;
  G.player.health = 100;
  G.wanted = 0;
  G.audio.setSiren(false);
  for (const c of [...G.policeCars]) { scene.remove(c.group); G.allCars.splice(G.allCars.indexOf(c), 1); }
  G.policeCars.length = 0;
  for (const c of G.policeFoot) scene.remove(c.group);
  G.policeFoot.length = 0;
  G.hud.wasted.classList.add('hidden');
  G.endState = null;
  G.feed('You wake up at the safehouse. Bea is not happy.');
};

// ---- Screens ----
const $ = (id) => document.getElementById(id);
function startGame(fromSave) {
  G.audio.ensure();
  $('startscreen').classList.add('hidden');
  $('pausescreen').classList.add('hidden');
  $('winscreen').classList.add('hidden');
  G.hud.show();
  G.started = true;
  G.paused = false;
  if (fromSave) {
    const d = loadGameData();
    if (d) {
      G.player.cash = d.cash;
      G.missions.start(Math.min(d.mission, 4));
      G.feed('Welcome back, Danny. Save loaded — mission ' + (Math.min(d.mission, 4) + 1) + ' of 5.');
      return;
    }
  }
  G.player.cash = 0;
  G.missions.start(0);
}
$('startbtn').addEventListener('click', () => startGame(false));
$('continuebtn').addEventListener('click', () => startGame(true));
if (hasSave()) $('continuebtn').classList.remove('hidden');
$('resumebtn').addEventListener('click', () => { G.paused = false; $('pausescreen').classList.add('hidden'); });
$('savebtn').addEventListener('click', () => G.saveGame());
$('quitbtn').addEventListener('click', () => {
  G.paused = false; G.started = false;
  $('pausescreen').classList.add('hidden');
  G.hud.hide();
  $('startscreen').classList.remove('hidden');
  if (hasSave()) $('continuebtn').classList.remove('hidden');
});
$('freeroambtn').addEventListener('click', () => {
  $('winscreen').classList.add('hidden');
  G.paused = false;
  G.missions.done = true;
  G.missions.marker.visible = false;
  G.missions.diamond.visible = false;
  G.missions.setObjective('FREE ROAM', 'Neon Harbor is yours. Steal cars, dodge the PD, cause trouble.', G.city.landmarks.safehouse);
});
$('winrestartbtn').addEventListener('click', () => {
  $('winscreen').classList.add('hidden');
  G.paused = false;
  G.player.cash = 0;
  G.respawn();
  G.missions.start(0);
});

// ---- Shot mode / normal start ----
if (shot) {
  applyShot(G, shot.name);
} else {
  G.hud.hide();
}

// ---- Per-frame update ----
function updatePlayerOnFoot(dt, input) {
  const p = G.player.group.position;
  // Camera-relative movement.
  let mx = 0, mz = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) { mx += Math.sin(G.camYaw); mz += Math.cos(G.camYaw); }
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) { mx -= Math.sin(G.camYaw); mz -= Math.cos(G.camYaw); }
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) { mx -= Math.cos(G.camYaw); mz += Math.sin(G.camYaw); }
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) { mx += Math.cos(G.camYaw); mz -= Math.sin(G.camYaw); }
  const len = Math.hypot(mx, mz);
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? 11 : 6;
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    const want = Math.atan2(mx, mz);
    let diff = want - G.player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.player.angle += Math.max(-10 * dt, Math.min(10 * dt, diff));
    G.player.group.rotation.y = G.player.angle;
    G.player.group.position.y = Math.abs(Math.sin(performance.now() / 130)) * 0.07;
    G.player.speed = speed;
  } else {
    G.player.group.position.y = 0;
    G.player.speed = 0;
  }
  resolveCollider(G.city.colliders, p, 0.6);
  p.x = Math.max(-210, Math.min(210, p.x));
  p.z = Math.max(-210, Math.min(310, p.z));
  // Enter a car?
  const near = nearestCar(p, G.allCars, 4.5);
  if (near) G.hud.setHint('Press E — steal the ' + near.name);
  else G.hud.setHint('');
  if (input.pressed('KeyE') && near) G.enterCar(near, false);
  // Shooting.
  if (input.clicked) G.combat.shoot();
  if (input.pressed('KeyR')) G.combat.reload();
}

function updateCamera(dt, input) {
  if (G.shotCamera) {
    camera.position.copy(G.shotCamera.pos);
    camera.lookAt(G.shotCamera.look);
    return;
  }
  G.camYaw -= input.dragDX * 0.005;
  G.camPitch = Math.max(0.08, Math.min(1.1, G.camPitch + input.dragDY * 0.003));
  const anchor = G.playerCar ? G.playerCar.group.position : G.player.group.position;
  const followAngle = G.playerCar ? G.playerCar.angle : G.camYaw;
  const dist = G.playerCar ? 12 : 9;
  const height = G.playerCar ? 5 : 3.6 + G.camPitch * 4;
  const camX = anchor.x - Math.sin(followAngle) * dist;
  const camZ = anchor.z - Math.cos(followAngle) * dist;
  camera.position.set(camX, anchor.y + height, camZ);
  camera.lookAt(anchor.x, anchor.y + 1.8, anchor.z);
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const input = G.input;
  if (input.pressed('KeyM')) {
    const muted = G.audio.toggleMute();
    G.feed(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (G.started && input.pressed('KeyP') && !G.endState && document.getElementById('winscreen').classList.contains('hidden')) {
    G.paused = !G.paused;
    $('pausescreen').classList.toggle('hidden', !G.paused);
    if (G.paused) G.audio.setEngine(0, false);
  }
  if (G.started && !G.paused) {
    if (G.endState) {
      G.endTimer -= dt;
      if (G.endTimer <= 0) G.respawn();
    } else {
      if (G.playerCar) {
        G.lastSpeed = updatePlayerCar(G, dt, input);
        G.hud.setHint('');
        if (input.pressed('KeyE')) G.exitCar();
      } else {
        updatePlayerOnFoot(dt, input);
        G.audio.setEngine(0, false);
      }
      // Health regen out of combat.
      if (performance.now() - G.lastDamageAt > 5000 && G.player.health < 100 && G.player.health > 0) {
        G.player.health = Math.min(100, G.player.health + 3 * dt);
      }
      updateTraffic(G, dt);
      updatePeds(G, dt);
      updateEnemies(G, dt);
      updatePolice(G, dt);
      updateWanted(G, dt);
      G.missions.update(dt);
      G.combat.update(dt);
      // Car vs pedestrian: running someone over is a crime.
      const pp = G.player.group.position;
      if (G.playerCar && Math.abs(G.playerCar.speed) > 8) {
        for (const ped of G.peds) {
          if (!ped.dead && ped.group.position.distanceTo(pp) < 2.2) {
            ped.dead = true;
            ped.group.visible = false;
            G.addWanted(1, 'You ran over a pedestrian!');
            G.audio.crash();
          }
        }
      }
    }
    // Tracers and sparks fade.
    for (const t of [...G.tracers]) {
      t.ttl -= dt;
      if (t.ttl <= 0) { scene.remove(t.line); G.tracers.splice(G.tracers.indexOf(t), 1); }
    }
    for (const s of [...G.sparks]) {
      s.ttl -= dt;
      s.mesh.scale.multiplyScalar(0.9);
      if (s.ttl <= 0) { scene.remove(s.mesh); G.sparks.splice(G.sparks.indexOf(s), 1); }
    }
    G.hud.update(G);
    G.hud.drawMinimap(G);
  }
  updateCamera(dt, input);
  renderer.render(scene, camera);
  input.endFrame();
}
frame();
