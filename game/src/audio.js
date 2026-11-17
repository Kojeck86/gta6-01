// Sound, synthesised live with WebAudio. One clear job: every sound the
// game makes — engine, sirens, gunfire, pickups, music — from oscillators
// and noise, with no audio files shipped. Everything is guarded: if the
// browser has no audio, the game plays silent and never throws.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  // Create the context on the first user gesture (browsers require it).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.startEngine();
      this.startSiren();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx && this.ctx.destination) {
      // Mute by suspending: cheap and total.
      if (muted) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    }
  }

  // The engine hum: a sawtooth whose pitch follows the speed.
  startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch { /* silent */ }
  }

  setEngine(speed, inCar) {
    if (!this.engineOsc || !this.engineGain) return;
    try {
      const target = inCar ? 0.035 + Math.min(0.05, Math.abs(speed) / 560 * 0.05) : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 0.16, this.ctx.currentTime, 0.1);
    } catch { /* silent */ }
  }

  // The police siren: two tones alternating while the wanted level is up.
  startSiren() {
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch { /* silent */ }
  }

  setSiren(wanted, dt) {
    if (!this.sirenOsc || !this.sirenGain) return;
    try {
      if (wanted === 0) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        return;
      }
      this.sirenGain.gain.setTargetAtTime(0.028, this.ctx.currentTime, 0.2);
      const t = this.ctx.currentTime;
      const tone = Math.floor(t * 1.6) % 2 === 0 ? 720 : 960;
      this.sirenOsc.frequency.setTargetAtTime(tone, t, 0.05);
    } catch { /* silent */ }
  }

  // A short noise burst: a gunshot.
  shot() {
    this.blip(0.09, 'square', 880, 0.05, 120);
  }

  // A low thud: an explosion or a ram.
  thud() {
    this.blip(0.35, 'sine', 70, 0.16, 40);
  }

  // A bright pickup blip.
  pickup() {
    this.blip(0.12, 'sine', 660, 0.06, 990);
    setTimeout(() => this.blip(0.12, 'sine', 990, 0.06, 1320), 90);
  }

  // A mission-complete jingle: four rising notes.
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.blip(0.18, 'triangle', f, 0.07, f), i * 110));
  }

  // One oscillator blip: frequency slides from `from` to `to`.
  blip(seconds, type, from, volume, to) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + seconds);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + seconds + 0.02);
    } catch { /* silent */ }
  }

  // A synthwave bassline: a looping minor-key pattern, one note per beat.
  updateMusic(dt, playing) {
    if (!this.ctx || this.muted || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    const note = bass[this.musicStep % bass.length];
    this.musicStep += 1;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    } catch { /* silent */ }
  }
}
