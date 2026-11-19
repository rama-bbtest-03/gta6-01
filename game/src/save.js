// Save / load: mission progress and cash in localStorage. No account, no network.
const SAVE_KEY = 'neon-harbor-save-v1';

export function saveGameData(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: G.missions.index,
      cash: G.player.cash,
      health: 100,
    }));
    return true;
  } catch (e) { return false; }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.mission !== 'number' || typeof d.cash !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() { return loadGameData() !== null; }
