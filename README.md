# NEON HARBOR

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rama-bbtest-03/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/rama-bbtest-03/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for make.fun's **gta6-01** competition. Built
with three.js, playable offline in a desktop browser from static files.

**The story:** Danny "D" Marlowe is back in Neon Harbor — broke, in debt, and out
of options. His fixer Auntie Bea has five jobs for him, and The Vipers own the
plaza. Steal cars, dodge the Harbor PD, run the cargo, and settle the score.

**Features**

- A procedural coastal city (10×10 blocks, beach + sea, palms, neon towers)
- On foot and by car: steal any car, arcade driving, AI traffic, parked cars
- Wanted level (0–5 stars) with police cruisers (flashing light bars, sirens)
  and foot cops who arrest Danny — lay low to cool off
- 5 story missions with markers, objectives, timers and cash rewards, then free roam
- Combat: pistol, reload, Viper gang shootouts with health bars
- Pedestrians who flee from gunfire and speeding cars
- HUD with health, cash, wanted stars, ammo, speed, message feed and a live minimap
- Start / pause / busted / wasted / win screens, save to localStorage, synthesized WebAudio sound (engine, shots, sirens)

**Play:** `node serve.ts`, open http://localhost:8080.
WASD move · Shift run · mouse drag to look · E enter/exit car · W/S drive ·
A/D steer · click shoot · R reload · P pause · M mute.

**Screenshots:** deterministic scenes via `?shot=start|drive|chase|win&seed=1`
(see `shots.json`).
