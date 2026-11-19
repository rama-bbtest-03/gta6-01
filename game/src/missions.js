// The story: five jobs for Auntie Bea, in order, then free roam. Each mission is a
// chain of stages with a glowing marker, an objective line, and a cash reward.
import * as THREE from 'three';

const REWARDS = [500, 800, 1500, 2000, 5000];

export function createMissions(G) {
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), markerMat);
  marker.position.set(0, 15, 200);
  G.scene.add(marker);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  diamond.position.set(0, 26, 200);
  G.scene.add(diamond);

  const M = {
    index: 0, stage: 0, timer: 0, target: new THREE.Vector3(0, 0, 200),
    title: '', text: '', done: false,
    marker, diamond,
    setObjective(title, text, target) {
      M.title = title; M.text = text;
      if (target) M.target.copy(target);
      G.hud.setObjective(title, text);
    },
    start(i) {
      M.index = i; M.stage = 0; M.done = false; M.timer = 0;
      G.enemies.length = 0;
      if (i === 0) {
        M.setObjective('1 — BACK IN TOWN', 'Bea needs wheels. Steal the marked car on Coral Ave.',
          G.missionCar1.group.position);
        G.feed('Auntie Bea: "Danny! Get me that car on Coral Ave. Don\'t ask whose it is."');
      } else if (i === 1) {
        M.setObjective('2 — THE PICKUP', 'Walk or drive to the pier and grab Bea\'s package.',
          G.city.landmarks.pier);
        G.feed('Auntie Bea: "Package is waiting at the pier. Quick and quiet."');
      } else if (i === 2) {
        M.setObjective('3 — HOT CARGO', 'Pick up the cargo at the beach, then deliver it across town. 90 seconds.',
          G.city.landmarks.beach);
        G.feed('Auntie Bea: "This one\'s hot. Cops will be looking. Move!"');
      } else if (i === 3) {
        M.setObjective('4 — STREET WAR', 'The Vipers are holding the plaza. Take them all out.',
          G.city.landmarks.plaza);
        G.feed('Auntie Bea: "The Vipers think they own the plaza. Show them different."');
      } else if (i === 4) {
        M.setObjective('5 — THE LAST JOB', 'Grab the cash at the pier, then lose the heat and reach the safehouse.',
          G.city.landmarks.pier);
        G.feed('Auntie Bea: "One last job, Danny. The cash is at the pier. Then we\'re done."');
      }
      G.audio.mission();
    },
    complete() {
      const reward = REWARDS[M.index] || 500;
      G.player.cash += reward;
      G.audio.cash();
      G.feed('Job complete! +$' + reward);
      G.saveGame();
      M.index++;
      if (M.index >= 5) {
        M.done = true;
        M.setObjective('FREE ROAM', 'Neon Harbor is yours. Steal cars, dodge the PD, cause trouble.',
          G.city.landmarks.safehouse);
        G.showWin();
        return;
      }
      M.start(M.index);
    },
    failTimer() {
      G.feed('Too slow — the cargo window closed. Bea is giving you another shot.');
      M.start(2);
    },
    update(dt) {
      if (M.done) return;
      const pp = G.player.group.position;
      const dist = Math.hypot(pp.x - M.target.x, pp.z - M.target.z);
      const i = M.index, s = M.stage;
      if (i === 0) {
        if (s === 0) {
          if (G.playerCar === G.missionCar1) {
            M.stage = 1;
            M.setObjective('1 — BACK IN TOWN', 'Nice wheels. Now deliver it to the garage on the east side.',
              G.city.landmarks.garage);
            G.addWanted(1, 'Grand theft auto!');
          }
        } else if (s === 1 && dist < 8) M.complete();
      } else if (i === 1) {
        if (s === 0 && dist < 6) {
          M.stage = 1;
          G.addWanted(1, 'Someone saw the pickup!');
          M.setObjective('2 — THE PICKUP', 'Package secured. Bring it back to the safehouse.',
            G.city.landmarks.safehouse);
          G.audio.pickup();
        } else if (s === 1 && dist < 8) M.complete();
      } else if (i === 2) {
        if (s === 0 && dist < 6) {
          M.stage = 1; M.timer = 90;
          G.addWanted(2, 'The cargo is flagged — Harbor PD is on you!');
          M.setObjective('3 — HOT CARGO', 'DELIVER to the garage — ' + Math.ceil(M.timer) + 's left!',
            G.city.landmarks.garage);
          G.audio.pickup();
        } else if (s === 1) {
          M.timer -= dt;
          M.setObjective('3 — HOT CARGO', 'DELIVER to the garage — ' + Math.max(0, Math.ceil(M.timer)) + 's left!',
            G.city.landmarks.garage);
          if (M.timer <= 0) { M.failTimer(); return; }
          if (dist < 8) M.complete();
        }
      } else if (i === 3) {
        if (s === 0 && dist < 26) {
          M.stage = 1;
          G.spawnViperSquad();
          M.setObjective('4 — STREET WAR', 'Vipers: ' + G.enemies.filter((e) => e.alive).length + ' left. Clear the plaza!',
            G.city.landmarks.plaza);
        } else if (s === 1) {
          const left = G.enemies.filter((e) => e.alive).length;
          M.setObjective('4 — STREET WAR', 'Vipers: ' + left + ' left. Clear the plaza!',
            G.city.landmarks.plaza);
          if (left === 0) {
            M.stage = 2;
            G.addWanted(2, 'The plaza heard that!');
            M.setObjective('4 — STREET WAR', 'Plaza clear. Grab a car and get to the garage!',
              G.city.landmarks.garage);
          }
        } else if (s === 2 && dist < 8) M.complete();
      } else if (i === 4) {
        if (s === 0 && dist < 6) {
          M.stage = 1;
          G.addWanted(3, 'The cash is marked — every cop in the city is coming!');
          M.setObjective('5 — THE LAST JOB', 'Cash in hand. Lose the heat and reach the safehouse!',
            G.city.landmarks.safehouse);
          G.audio.pickup();
        } else if (s === 1 && dist < 8) M.complete();
      }
      // Animate the marker.
      M.marker.position.set(M.target.x, 15, M.target.z);
      M.diamond.position.set(M.target.x, 24 + Math.sin(performance.now() / 400) * 1.2, M.target.z);
      M.diamond.rotation.y += dt * 2;
      M.marker.visible = !M.done;
      M.diamond.visible = !M.done;
    },
  };
  return M;
}
