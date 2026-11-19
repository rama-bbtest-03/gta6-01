// Deterministic screenshot scenes: ?shot=start|drive|chase|win&seed=1 builds the
// same city and poses the same moment every time, with a fixed camera.
import * as THREE from 'three';

export function parseShot() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { name: shot, seed: Number(q.get('seed') || 1) };
}

export function applyShot(G, name) {
  const L = G.city.landmarks;
  if (name === 'start') {
    // Danny on foot by the plaza fountain, looking down the main avenue.
    G.player.group.position.set(2, 0, 16);
    G.player.angle = Math.PI;
    G.player.group.rotation.y = G.player.angle;
    G.missions.start(0);
    G.shotCamera = {
      pos: new THREE.Vector3(2, 7, 36),
      look: new THREE.Vector3(-2, 2, -40),
    };
    G.feed('Auntie Bea: "Danny! Get me that car on Coral Ave."');
  } else if (name === 'drive') {
    // Danny driving down a main avenue, traffic around, minimap and HUD live.
    const car = G.missionCar1;
    G.enterCar(car, true);
    car.group.position.set(-40, 0, 60);
    car.angle = 0; car.speed = 14;
    G.player.angle = 0;
    G.missions.index = 0; G.missions.stage = 1;
    G.missions.setObjective('1 — BACK IN TOWN', 'Nice wheels. Now deliver it to the garage on the east side.', L.garage);
    G.player.cash = 500;
    G.shotCamera = {
      pos: new THREE.Vector3(-40, 5, 44),
      look: new THREE.Vector3(-40, 2, 85),
    };
  } else if (name === 'chase') {
    // Hot Cargo run: wanted 3, two cruisers on Danny's tail, timer on the HUD.
    const car = G.missionCar1;
    G.enterCar(car, true);
    car.group.position.set(0, 0, -80);
    car.angle = 0; car.speed = 20;
    G.player.angle = 0;
    G.missions.index = 2; G.missions.stage = 1; G.missions.timer = 62;
    G.missions.setObjective('3 — HOT CARGO', 'DELIVER to the garage — 62s left!', L.garage);
    G.wanted = 3; G.lastCrimeAt = performance.now();
    G.audio.setSiren(true);
    G.player.cash = 1300;
    // Place two police cruisers right behind, lights flashing.
    G.ensurePoliceCars(2);
    const pc = G.policeCars;
    for (let i = 0; i < 2; i++) {
      const c = pc[i];
      if (!c) break;
      c.group.position.set((i === 0 ? -4 : 4), 0, -80 - 10 - i * 6);
      c.angle = 0; c.speed = 21;
    }
    G.shotCamera = {
      pos: new THREE.Vector3(9, 7, -110),
      look: new THREE.Vector3(-1, 1.5, -50),
    };
  } else if (name === 'win') {
    // The Last Job paid off: Danny cruising the beachfront at sunset, free roam.
    const car = G.missionCar1;
    G.enterCar(car, true);
    car.group.position.set(60, 0, 205);
    car.angle = Math.PI / 2; car.speed = 10;
    G.player.angle = Math.PI / 2;
    G.missions.index = 5; G.missions.done = true;
    G.missions.marker.visible = false; G.missions.diamond.visible = false;
    G.missions.setObjective('FREE ROAM', 'Neon Harbor is yours. The Last Job paid $5,000.', L.safehouse);
    G.player.cash = 6800;
    G.wanted = 0;
    G.shotCamera = {
      pos: new THREE.Vector3(46, 5, 214),
      look: new THREE.Vector3(76, 2, 198),
    };
    G.feed('Job complete! +$5,000 — The Last Job is done.');
  }
  document.getElementById('startscreen').classList.add('hidden');
  G.hud.show();
  G.started = true;
}
