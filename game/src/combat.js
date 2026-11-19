// Combat: Danny's pistol — click to shoot, R to reload, tracers and hit sparks.
// Enemies and police take damage; hitting a pedestrian is a crime.
import * as THREE from 'three';

export function createCombat(G) {
  const combat = {
    ammo: 12, reserve: 999, reloading: false, cooldown: 0,
    reload() {
      if (combat.reloading || combat.ammo === 12) return;
      combat.reloading = true;
      G.audio.reload();
      setTimeout(() => { combat.ammo = 12; combat.reloading = false; }, 900);
    },
    shoot() {
      if (G.playerCar || combat.cooldown > 0 || combat.reloading) return;
      if (combat.ammo <= 0) { combat.reload(); return; }
      combat.cooldown = 0.22;
      combat.ammo--;
      G.audio.shot();
      G.dangerAt = { pos: G.player.group.position.clone(), until: performance.now() + 1500 };
      // Ray from the camera through the screen center.
      const origin = G.camera.position.clone();
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      const from = G.player.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      let best = null, bestD = 70;
      const targets = [];
      for (const e of G.enemies) if (e.alive) targets.push({ obj: e, pos: e.group.position, r: 1.2, kind: 'enemy' });
      for (const c of G.policeFoot) targets.push({ obj: c, pos: c.group.position, r: 1.0, kind: 'cop' });
      for (const p of G.peds) if (!p.dead) targets.push({ obj: p, pos: p.group.position, r: 1.0, kind: 'ped' });
      for (const t of targets) {
        const to = t.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(from);
        const along = to.dot(dir);
        if (along < 1 || along > bestD) continue;
        const perp = to.clone().addScaledVector(dir, -along).length();
        if (perp < t.r + along * 0.06) { best = t; bestD = along; }
      }
      const end = from.clone().addScaledVector(dir, best ? bestD : 60);
      G.spawnTracer(from, end, 0xffe9a8);
      if (best) {
        G.spawnSpark(end);
        if (best.kind === 'enemy') {
          best.obj.health -= 34;
          if (best.obj.health <= 0) {
            best.obj.alive = false;
            best.obj.group.visible = false;
            G.feed('Viper down.');
            G.onEnemyKilled && G.onEnemyKilled();
          }
        } else if (best.kind === 'cop') {
          best.obj.group.visible = false;
          G.policeFoot.splice(G.policeFoot.indexOf(best.obj), 1);
          G.scene.remove(best.obj.group);
          G.addWanted(2, 'You shot a cop!');
        } else {
          best.obj.dead = true;
          best.obj.group.visible = false;
          G.addWanted(1, 'A pedestrian was hit!');
        }
      }
    },
    update(dt) { combat.cooldown = Math.max(0, combat.cooldown - dt); },
  };
  return combat;
}
