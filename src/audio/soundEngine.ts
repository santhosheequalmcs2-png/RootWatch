/**
 * Procedural Web Audio API tactile UI sound synthesizer for RootWatch.
 * Zero external audio files — all sounds are synthesized on demand using
 * softly filtered oscillators and damped envelopes calibrated for precision hardware UI.
 */

class EngineeringSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private lastHoverMs = 0;
  private lastScrubMs = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.24;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore browser autoplay gate before first user gesture
      });
    }

    return this.ctx.state === 'running' ? this.ctx : null;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.24, now, 0.015);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(options: {
    type?: OscillatorType;
    startFreq: number;
    endFreq?: number;
    duration: number;
    peakGain: number;
    delay?: number;
    lowpassFreq?: number;
  }): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const {
      type = 'sine',
      startFreq,
      endFreq = startFreq,
      duration,
      peakGain,
      delay = 0,
      lowpassFreq = 3600,
    } = options;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpassFreq, now);
    filter.Q.setValueAtTime(0.8, now);

    // Click-free micro-attack and exponential damping
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + Math.min(0.006, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  /** Ultra-subtle anodized detent tick on hover */
  public playHover(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastHoverMs < 65) return;
    this.lastHoverMs = nowMs;

    this.playTone({
      type: 'sine',
      startFreq: 1320,
      endFreq: 960,
      duration: 0.026,
      peakGain: 0.055,
      lowpassFreq: 2400,
    });
  }

  /** Precision caliper tick while scrubbing chart points */
  public playScrub(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastScrubMs < 48) return;
    this.lastScrubMs = nowMs;

    this.playTone({
      type: 'triangle',
      startFreq: 1580,
      endFreq: 1220,
      duration: 0.018,
      peakGain: 0.04,
      lowpassFreq: 2200,
    });
  }

  /** Tactile hardware lock-in click when selecting a component */
  public playSelect(isExperimental = false): void {
    if (isExperimental) {
      this.playTone({
        type: 'triangle',
        startFreq: 460,
        endFreq: 420,
        duration: 0.065,
        peakGain: 0.16,
        lowpassFreq: 2200,
      });
      this.playTone({
        type: 'sine',
        startFreq: 690,
        endFreq: 675,
        duration: 0.095,
        peakGain: 0.12,
        delay: 0.025,
        lowpassFreq: 2600,
      });
      return;
    }

    this.playTone({
      type: 'triangle',
      startFreq: 540,
      endFreq: 480,
      duration: 0.052,
      peakGain: 0.16,
      lowpassFreq: 2400,
    });
    this.playTone({
      type: 'sine',
      startFreq: 1080,
      endFreq: 1040,
      duration: 0.08,
      peakGain: 0.095,
      delay: 0.018,
      lowpassFreq: 3200,
    });
  }

  /** Mechanical two-tone switch flip for toggles (labels, inspector, timeframe, pause) */
  public playToggle(active: boolean): void {
    const f1 = active ? 480 : 620;
    const f2 = active ? 680 : 440;
    this.playTone({
      type: 'sine',
      startFreq: f1,
      endFreq: f2,
      duration: 0.068,
      peakGain: 0.14,
      lowpassFreq: 2600,
    });
    this.playTone({
      type: 'triangle',
      startFreq: f2 * 1.5,
      endFreq: f2 * 1.48,
      duration: 0.045,
      peakGain: 0.05,
      delay: 0.02,
      lowpassFreq: 2800,
    });
  }

  /** Smooth damped mechanical glide for Exploded View / Assemble */
  public playExplode(exploded: boolean): void {
    if (exploded) {
      this.playTone({
        type: 'triangle',
        startFreq: 210,
        endFreq: 380,
        duration: 0.22,
        peakGain: 0.14,
        lowpassFreq: 1100,
      });
      this.playTone({
        type: 'sine',
        startFreq: 420,
        endFreq: 640,
        duration: 0.2,
        peakGain: 0.085,
        delay: 0.035,
        lowpassFreq: 2200,
      });
    } else {
      this.playTone({
        type: 'triangle',
        startFreq: 360,
        endFreq: 195,
        duration: 0.21,
        peakGain: 0.14,
        lowpassFreq: 1050,
      });
      this.playTone({
        type: 'sine',
        startFreq: 560,
        endFreq: 330,
        duration: 0.17,
        peakGain: 0.08,
        delay: 0.03,
        lowpassFreq: 1900,
      });
    }
  }

  /** Soft double-pulse calibration tone for Reset View / Reset Selection */
  public playReset(): void {
    this.playTone({
      type: 'sine',
      startFreq: 640,
      endFreq: 620,
      duration: 0.075,
      peakGain: 0.11,
      lowpassFreq: 2400,
    });
    this.playTone({
      type: 'sine',
      startFreq: 480,
      endFreq: 465,
      duration: 0.11,
      peakGain: 0.12,
      delay: 0.055,
      lowpassFreq: 2100,
    });
  }

  /** Warm ascending harmonic cue when starting Guided Demo */
  public playDemoStart(): void {
    const notes = [392, 493.88, 587.33]; // G4, B4, D5
    notes.forEach((freq, i) => {
      this.playTone({
        type: 'sine',
        startFreq: freq,
        duration: 0.19,
        peakGain: 0.11,
        delay: i * 0.055,
        lowpassFreq: 2400,
      });
    });
  }

  /** Soft descending resolution when stopping Guided Demo */
  public playDemoStop(): void {
    const notes = [523.25, 392]; // C5 -> G4
    notes.forEach((freq, i) => {
      this.playTone({
        type: 'sine',
        startFreq: freq,
        duration: 0.16,
        peakGain: 0.1,
        delay: i * 0.06,
        lowpassFreq: 2000,
      });
    });
  }

  /** Gentle harmonic step progression ping during the 10-step Demo */
  public playDemoTransition(stepNumber: number): void {
    const scale = [392, 440, 493.88, 523.25, 587.33, 659.25];
    const baseFreq = scale[(Math.max(1, stepNumber) - 1) % scale.length];

    this.playTone({
      type: 'sine',
      startFreq: baseFreq,
      duration: 0.14,
      peakGain: 0.095,
      lowpassFreq: 2200,
    });
    this.playTone({
      type: 'sine',
      startFreq: baseFreq * 1.5,
      duration: 0.16,
      peakGain: 0.055,
      delay: 0.045,
      lowpassFreq: 2600,
    });
  }
}

export const soundEngine = new EngineeringSoundEngine();
