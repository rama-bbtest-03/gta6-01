// HUD: health, cash, wanted stars, ammo, speed, objective line, message feed,
// the 2D top-down minimap, and the start / pause / busted / win screens.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'), healthfill: $('healthfill'), cash: $('cash'), stars: $('stars'),
    ammo: $('ammo'), speed: $('speed'), objtitle: $('objtitle'), objtext: $('objtext'),
    feed: $('feed'), crosshair: $('crosshair'), hint: $('hint'),
    wasted: $('wasted'), wastedtitle: $('wastedtitle'), wastedsub: $('wastedsub'),
    minimap: $('minimap'),
    feedLines: [],
    show() { hud.root.classList.remove('hidden'); },
    hide() { hud.root.classList.add('hidden'); },
    setObjective(title, text) { hud.objtitle.textContent = title; hud.objtext.textContent = text; },
    message(text) {
      const div = document.createElement('div');
      div.textContent = text;
      hud.feed.appendChild(div);
      hud.feedLines.push(div);
      while (hud.feedLines.length > 4) hud.feedLines.shift().remove();
      setTimeout(() => { div.remove(); hud.feedLines.splice(hud.feedLines.indexOf(div), 1); }, 9000);
    },
    setHint(text) {
      if (text) { hud.hint.textContent = text; hud.hint.classList.remove('hidden'); }
      else hud.hint.classList.add('hidden');
    },
    update(G) {
      hud.healthfill.style.width = Math.max(0, G.player.health) + '%';
      hud.healthfill.style.background = G.player.health > 50
        ? 'linear-gradient(90deg,#37e08b,#a5ff6b)'
        : G.player.health > 25 ? 'linear-gradient(90deg,#e8a837,#ffd23f)' : 'linear-gradient(90deg,#e83737,#ff6b6b)';
      hud.cash.textContent = '$' + G.player.cash.toLocaleString('en-US');
      let s = '';
      for (let i = 0; i < 5; i++) s += '<span class="' + (i < G.wanted ? '' : 'off') + '">★</span>';
      hud.stars.innerHTML = s;
      hud.ammo.textContent = G.playerCar ? '' : (G.combat.reloading ? 'RELOADING…' : 'AMMO ' + G.combat.ammo + ' / ∞');
      if (G.playerCar) {
        hud.speed.classList.remove('hidden');
        hud.speed.innerHTML = Math.round(G.lastSpeed || 0) + ' <small>mph</small>';
        hud.crosshair.classList.add('hidden');
      } else {
        hud.speed.classList.add('hidden');
        hud.crosshair.classList.remove('hidden');
      }
    },
    drawMinimap(G) {
      const ctx = hud.minimap.getContext('2d');
      const S = 190, scale = S / 460; // world -230..230
      const toMap = (x, z) => [(x + 230) * scale, (z + 230) * scale];
      ctx.fillStyle = '#0a1a2e';
      ctx.fillRect(0, 0, S, S);
      // Beach + sea.
      ctx.fillStyle = '#e8d49a';
      ctx.fillRect(0, (215 + 230) * scale, S, S - (215 + 230) * scale);
      ctx.fillStyle = '#1e6fa8';
      ctx.fillRect(0, (268 + 230) * scale, S, S);
      // Roads.
      ctx.strokeStyle = '#3a4552';
      ctx.lineWidth = 5;
      for (let i = -5; i <= 5; i++) {
        const [x1, y1] = toMap(i * 40, -210);
        const [x2, y2] = toMap(i * 40, 210);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [x3, y3] = toMap(-210, i * 40);
        const [x4, y4] = toMap(210, i * 40);
        ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
      }
      // Mission marker.
      if (G.missions && !G.missions.done) {
        const [mx, my] = toMap(G.missions.target.x, G.missions.target.z);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
      }
      // Safehouse.
      const [hx, hy] = toMap(G.city.landmarks.safehouse.x, G.city.landmarks.safehouse.z);
      ctx.fillStyle = '#7dffb0';
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
      // Traffic dots.
      ctx.fillStyle = '#c8c8c8';
      for (const c of G.traffic) {
        const [cx, cy] = toMap(c.group.position.x, c.group.position.z);
        ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
      }
      // Police: flashing red/blue.
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff3030' : '#3050ff';
      for (const c of G.policeCars) {
        const [cx, cy] = toMap(c.group.position.x, c.group.position.z);
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      }
      for (const c of G.policeFoot) {
        const [cx, cy] = toMap(c.group.position.x, c.group.position.z);
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      }
      // Player arrow.
      const [px, py] = toMap(G.player.group.position.x, G.player.group.position.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(Math.sin(G.player.angle), Math.cos(G.player.angle)) * -1 + Math.PI);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  };
  return hud;
}
