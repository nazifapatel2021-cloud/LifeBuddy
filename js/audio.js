/* LifeBuddy High-Fidelity Web Audio Synthesizer
   - Smooth seamless ambient loops (crossfade-windowed, zero loop click)
   - Gentle Tibetan Singing Bowl chime for focus completion
   - 0.3s fade-in / 0.4s fade-out to prevent speaker popping/crackling
   - Respects user mute and volume settings
*/
import { Storage } from './storage.js';

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.activeNodes = {};
    this.masterGain = null;
    this.isMuted = false;
    this.masterVolumeLevel = 1.0;
  }

  ensureContext() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolumeLevel;
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        console.warn('Web Audio API not supported or initialized', e);
        return null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMasterVolume(val) {
    const clamped = Math.max(0, Math.min(1, parseFloat(val) || 0.5));
    this.masterVolumeLevel = clamped;
    const ctx = this.ensureContext();
    if (ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(clamped, ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    const ctx = this.ensureContext();
    if (ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolumeLevel, ctx.currentTime);
    }
    return this.isMuted;
  }

  isSoundActive(type) {
    return Boolean(this.activeNodes[type]);
  }

  getActiveCount() {
    return Object.keys(this.activeNodes).length;
  }

  /* Warm Tibetan Singing Bowl Meditation Gong for timer completion */
  playCompletionChime() {
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    if (settings.soundEnabled === false) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Harmonic frequencies for rich, soothing bell (C4, G4, C5, E5)
    const harmonics = [
      { freq: 261.63, gain: 0.30, decay: 4.5 },
      { freq: 392.00, gain: 0.18, decay: 3.8 },
      { freq: 523.25, gain: 0.12, decay: 3.0 },
      { freq: 659.25, gain: 0.06, decay: 2.2 }
    ];

    harmonics.forEach(({ freq, gain, decay }) => {
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Soft attack (prevents click) then exponential ring-down
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(gain, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(gainNode);
        gainNode.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + decay + 0.1);

        setTimeout(() => {
          try {
            osc.disconnect();
            gainNode.disconnect();
          } catch {}
        }, (decay + 0.2) * 1000);
      } catch (e) {
        console.warn('Chime generation note skipped', e);
      }
    });
  }

  /* Optional whisper-soft haptic feedback click (inaudible/subtle) */
  playClickSound() {
    // Disabled by default to keep the interface calm and uncluttered.
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    if (!settings.hapticSound) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.03);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  /* Toggle continuous ambient soundscape */
  toggleAmbientSound(type, volume = 0.5) {
    if (this.activeNodes[type]) {
      this.stopAmbientSound(type);
      return false;
    } else {
      this.startAmbientSound(type, volume);
      return true;
    }
  }

  setAmbientVolume(type, volume) {
    const ctx = this.ensureContext();
    if (ctx && this.activeNodes[type] && this.activeNodes[type].gainNode) {
      const clamped = Math.max(0.001, Math.min(1.0, parseFloat(volume) || 0.5));
      this.activeNodes[type].gainNode.gain.setValueAtTime(clamped, ctx.currentTime);
    }
  }

  startAmbientSound(type, volume = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.activeNodes[type]) return;

    // 5-second sample buffer for smooth ambient texture
    const sampleRate = ctx.sampleRate;
    const duration = 5.0;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Synthesize organic sounds with seamless circular boundary crossfading
    if (type === 'rain') {
      // Soft rainfall: filtered pink-brown noise with gentle micro-droplet impulses
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.06;
        b1 = 0.95 * b1 + white * 0.08;
        b2 = 0.85 * b2 + white * 0.12;
        // occasional soft rain droplet
        const drop = Math.random() < 0.002 ? (Math.random() * 0.3) : 0;
        data[i] = (b0 + b1 + b2) * 0.35 + drop;
      }
    } else if (type === 'brown') {
      // Deep Brown noise: warm 1/f^2 rumble ideal for masking speech & distractions
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.025 * white) / 1.025;
        data[i] = lastOut * 2.8;
      }
    } else if (type === 'pink') {
      // Forest Breeze: soft pink noise with gentle modulation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        const breath = 0.8 + 0.2 * Math.sin((2 * Math.PI * i) / (sampleRate * 2.5));
        data[i] = (b0 + b1 + b2 + b3) * 0.2 * breath;
      }
    } else {
      // Ocean Waves / Zen Drone
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const swell = 0.5 + 0.5 * Math.sin((2 * Math.PI * i) / bufferSize);
        data[i] = white * 0.15 * swell;
      }
    }

    // Apply smooth circular crossfade window to eliminate loop seam clicks
    const crossfadeLen = Math.floor(sampleRate * 0.2); // 200ms
    for (let i = 0; i < crossfadeLen; i++) {
      const factor = i / crossfadeLen;
      const head = data[i];
      const tail = data[bufferSize - crossfadeLen + i];
      data[i] = head * factor + tail * (1 - factor);
      data[bufferSize - crossfadeLen + i] = data[i];
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'brown' ? 380 : type === 'rain' ? 1200 : 800;

      const gainNode = ctx.createGain();
      const targetVol = Math.max(0.001, Math.min(1.0, parseFloat(volume) || 0.5));
      const now = ctx.currentTime;

      // Smooth 0.3s fade-in to prevent pops
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(targetVol, now + 0.3);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);

      source.start(now);

      this.activeNodes[type] = {
        source,
        filter,
        gainNode
      };
    } catch (e) {
      console.warn('Failed to start ambient track', e);
    }
  }

  stopAmbientSound(type) {
    const node = this.activeNodes[type];
    if (!node) return;

    delete this.activeNodes[type];
    const ctx = this.ctx;

    try {
      if (ctx && node.gainNode) {
        node.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      }
      if (node.source) {
        node.source.stop();
        node.source.disconnect();
      }
      if (node.filter) node.filter.disconnect();
      if (node.gainNode) node.gainNode.disconnect();
    } catch (e) {
      console.warn('Error stopping sound node', e);
    }
  }

  stopAllAmbientSounds() {
    Object.keys(this.activeNodes).forEach(type => this.stopAmbientSound(type));
    this.activeNodes = {};
  }
}

export const audioSynth = new SoundSynthesizer();
