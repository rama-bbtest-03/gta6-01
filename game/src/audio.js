// Original synthesized sound: WebAudio oscillators and noise only, no audio files.
export function createAudio() {
  const audio = { muted: false, ctx: null, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null };
  audio.ensure = function ensure() {
    if (audio.ctx || audio.muted) return;
    try {
      audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { audio.ctx = null; }
  };
  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, lowpass) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(audio.ctx.destination);
    src.start(t);
  }
  audio.shot = () => { noise(0.14, 0.3, 2500); tone(160, 0.1, 'square', 0.1, 60); };
  audio.enemyShot = () => { noise(0.1, 0.12, 1800); };
  audio.reload = () => { tone(500, 0.06, 'square', 0.08); setTimeout(() => tone(700, 0.06, 'square', 0.08), 120); };
  audio.pickup = () => { tone(660, 0.1, 'sine', 0.15); setTimeout(() => tone(990, 0.16, 'sine', 0.15), 90); };
  audio.cash = () => { tone(880, 0.08, 'sine', 0.14); setTimeout(() => tone(1174, 0.08, 'sine', 0.14), 80); setTimeout(() => tone(1568, 0.2, 'sine', 0.14), 160); };
  audio.crash = () => { noise(0.3, 0.35, 700); };
  audio.busted = () => { tone(220, 0.5, 'sawtooth', 0.14, 110); };
  audio.mission = () => { tone(523, 0.12, 'sine', 0.15); setTimeout(() => tone(784, 0.2, 'sine', 0.15), 120); };
  audio.setEngine = function setEngine(speed01, on) {
    if (!audio.ctx || audio.muted) { audio.stopEngine(); return; }
    if (!on) { audio.stopEngine(); return; }
    if (!audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0.03;
      audio.engineOsc.connect(audio.engineGain).connect(audio.ctx.destination);
      audio.engineOsc.start();
    }
    audio.engineOsc.frequency.value = 55 + speed01 * 140;
    audio.engineGain.gain.value = 0.02 + speed01 * 0.05;
  };
  audio.stopEngine = function stopEngine() {
    if (audio.engineOsc) { try { audio.engineOsc.stop(); } catch (e) {} audio.engineOsc = null; }
  };
  audio.setSiren = function setSiren(on) {
    if (!audio.ctx || audio.muted || !on) {
      if (audio.sirenOsc) { try { audio.sirenOsc.stop(); } catch (e) {} audio.sirenOsc = null; }
      return;
    }
    if (audio.sirenOsc) return;
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0.035;
    const lfo = audio.ctx.createOscillator();
    lfo.frequency.value = 0.8;
    const lfoGain = audio.ctx.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(audio.sirenOsc.frequency);
    audio.sirenOsc.frequency.value = 750;
    audio.sirenOsc.connect(audio.sirenGain).connect(audio.ctx.destination);
    audio.sirenOsc.start(); lfo.start();
    audio._sirenLfo = lfo;
  };
  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.muted) { audio.stopEngine(); audio.setSiren(false); }
    return audio.muted;
  };
  return audio;
}
