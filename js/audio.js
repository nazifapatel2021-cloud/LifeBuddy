/* Web Audio API Sound Synthesizer */
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.activeNodes = {};
    this.masterGain = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  /* Play Warm Zen Chime when timer ends */
  playCompletionChime() {
    this.init();
    const now = this.ctx.currentTime;
    
    // Multi-harmonic bell synthesis (Zen Tibetan Singing Bowl style)
    const frequencies = [329.63, 659.25, 987.77, 1318.51]; // E4 harmonic series
    const gains = [0.6, 0.3, 0.15, 0.08];

    frequencies.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Exponential decay over 4 seconds for deep soothing ring
      gain.gain.setValueAtTime(gains[index], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 4.0);
    });
  }

  /* Play Subtle Button Click Sound */
  playClickSound() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /* Toggle Continuous Ambient Noise Track */
  toggleAmbientSound(type, volume = 0.5) {
    this.init();
    if (this.activeNodes[type]) {
      this.stopAmbientSound(type);
      return false;
    } else {
      this.startAmbientSound(type, volume);
      return true;
    }
  }

  setAmbientVolume(type, volume) {
    if (this.activeNodes[type] && this.activeNodes[type].gainNode) {
      this.activeNodes[type].gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  startAmbientSound(type, volume = 0.5) {
    this.init();
    if (this.activeNodes[type]) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

    const whiteSource = this.ctx.createBufferSource();

    if (type === 'rain') {
      // Soft Rain filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      noiseBuffer.getChannelData(0).set(output);
      whiteSource.buffer = noiseBuffer;
      whiteSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;

      whiteSource.connect(filter);
      filter.connect(gainNode);

    } else if (type === 'brown') {
      // Deep Brown Noise / Soft Hum
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
      noiseBuffer.getChannelData(0).set(output);
      whiteSource.buffer = noiseBuffer;
      whiteSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      whiteSource.connect(filter);
      filter.connect(gainNode);

    } else if (type === 'pink') {
      // Gentle Breeze Pink Noise
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
      noiseBuffer.getChannelData(0).set(output);
      whiteSource.buffer = noiseBuffer;
      whiteSource.loop = true;

      whiteSource.connect(gainNode);
    }

    gainNode.connect(this.masterGain);
    whiteSource.start();

    this.activeNodes[type] = {
      source: whiteSource,
      gainNode: gainNode
    };
  }

  stopAmbientSound(type) {
    if (this.activeNodes[type]) {
      try {
        this.activeNodes[type].source.stop();
      } catch (e) {}
      delete this.activeNodes[type];
    }
  }

  stopAllAmbientSounds() {
    Object.keys(this.activeNodes).forEach(type => this.stopAmbientSound(type));
  }
}

export const audioSynth = new SoundSynthesizer();
