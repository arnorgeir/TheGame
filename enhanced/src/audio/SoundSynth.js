/**
 * SoundSynth.js
 * Procedural 8-bit Web Audio Synthesizer & Chiptune Music Generator
 * The Game! — Enhanced Edition
 * 
 * Features:
 * - Pure procedural sound synthesis (zero external audio files needed)
 * - Retro platformer sound effects (Jump, Coin, Stomp, Powerup, Hurt, Die, Boss Roar, Shockwave, Explosion, Victory)
 * - Multi-channel polyphonic Chiptune BGM Sequencer (Lead, Harmony/Arp, Bass, Noise Percussion)
 * - 4 Handcrafted Chiptune Tracks ('menu', 'level1', 'level2', 'boss')
 * - Automatic Browser Autoplay handling & seamless AudioContext unlock
 * - Master, SFX, and Music volume controls + mute toggle
 */

export class SoundSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        this.volume = 0.8;
        this.sfxVolume = 0.85;
        this.musicVolume = 0.65;
        this.muted = false;

        this.noiseBuffer = null;
        this.currentTrack = null;
        this.isPlayingMusic = false;
        this.musicTimer = null;
        this.musicStep = 0;
        this.nextNoteTime = 0;
        this.activeMusicVoices = [];

        this._setupAutoplayUnlock();
    }

    /**
     * Initializes AudioContext and master routing graph on user gesture.
     */
    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return this.ctx;
        }

        try {
            const AudioContextClass = typeof window !== 'undefined'
                ? (window.AudioContext || window.webkitAudioContext)
                : (typeof AudioContext !== 'undefined' ? AudioContext : null);

            if (!AudioContextClass) {
                return null;
            }

            this.ctx = new AudioContextClass();

            // Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // SFX Gain Channel
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // Music Gain Channel
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            // Generate shared white noise buffer
            this._generateNoiseBuffer();

            return this.ctx;
        } catch (e) {
            console.warn('Failed to initialize AudioContext:', e);
            return null;
        }
    }

    /**
     * Ensures AudioContext is alive and resumed.
     */
    ensureContext() {
        if (!this.ctx) {
            this.init();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    /**
     * Hooks browser interaction events to unlock audio seamlessly.
     */
    _setupAutoplayUnlock() {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            this.ensureContext();
            if (this.ctx && this.ctx.state === 'running') {
                window.removeEventListener('pointerdown', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
                window.removeEventListener('click', unlock);
            }
        };

        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        window.addEventListener('touchstart', unlock, { passive: true });
        window.addEventListener('click', unlock, { passive: true });
    }

    /**
     * Precomputes a 2-second white noise buffer for drums, stomps, explosions.
     */
    _generateNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
    }

    // ==========================================
    // VOLUME & MUTE CONTROLS
    // ==========================================

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && this.ctx) {
            const target = this.muted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
        }
    }

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.03);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain && this.ctx) {
            const target = this.muted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
        }
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    // ==========================================
    // PROCEDURAL SOUND EFFECTS (SFX)
    // ==========================================

    /**
     * Retro frequency sweep upward (square wave).
     */
    playJump() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    /**
     * Double-tone high pitch chime (B5 -> E6).
     */
    playCoin() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Tone 1: B5 (987.77 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(987.77, now);
        gain1.gain.setValueAtTime(0.24, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(this.sfxGain);
        osc1.start(now);
        osc1.stop(now + 0.08);

        // Tone 2: E6 (1318.51 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1318.51, now + 0.08);
        gain2.gain.setValueAtTime(0.28, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.4);
    }

    /**
     * Impact bass thud + noise burst.
     */
    playStomp() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Bass punch (pitch drop)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.16);
        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.19);

        // Noise crack
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, now);
            filter.Q.setValueAtTime(2, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.sfxGain);
            noise.start(now);
            noise.stop(now + 0.1);
        }
    }

    /**
     * Rapid arpeggio chime (C-E-G-C).
     */
    playPowerup() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
        const step = 0.055;

        notes.forEach((freq, i) => {
            const noteStart = now + i * step;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = i === notes.length - 1 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(freq, noteStart);

            const duration = i === notes.length - 1 ? 0.3 : 0.08;
            gain.gain.setValueAtTime(0.22, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + duration);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(noteStart);
            osc.stop(noteStart + duration + 0.02);
        });
    }

    /**
     * Low dissonant crunch / frequency drop.
     */
    playHurt() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(320, now);
        osc1.frequency.exponentialRampToValueAtTime(60, now + 0.22);

        // Dissonant detune
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(338, now);
        osc2.frequency.exponentialRampToValueAtTime(65, now + 0.22);

        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    }

    /**
     * Dramatic descending retro melody.
     */
    playDie() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [
            { f: 587.33, d: 0.12 }, // D5
            { f: 554.37, d: 0.12 }, // C#5
            { f: 523.25, d: 0.12 }, // C5
            { f: 493.88, d: 0.14 }, // B4
            { f: 440.00, d: 0.16 }, // A4
            { f: 392.00, d: 0.18 }, // G4
            { f: 329.63, d: 0.24 }, // E4
            { f: 220.00, d: 0.45 }  // A3 (final low slide)
        ];

        let offset = 0;
        notes.forEach((n, idx) => {
            const start = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(n.f, start);
            if (idx === notes.length - 1) {
                osc.frequency.exponentialRampToValueAtTime(80, start + n.d);
            }

            gain.gain.setValueAtTime(0.26, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + n.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(start);
            osc.stop(start + n.d + 0.02);
            offset += n.d * 0.92;
        });
    }

    /**
     * Low-frequency modulated rumble/growl.
     */
    playBossRoar() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const duration = 1.1;

        // Carrier oscillator
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.35);
        osc.frequency.exponentialRampToValueAtTime(45, now + duration);

        // LFO for frequency flutter
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(26, now);
        lfoGain.gain.setValueAtTime(25, now);
        lfo.connect(osc.frequency);

        // Lowpass filter sweep
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, now);
        filter.frequency.linearRampToValueAtTime(850, now + 0.35);
        filter.frequency.exponentialRampToValueAtTime(150, now + duration);
        filter.Q.setValueAtTime(4, now);

        // Amplitude envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.42, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
    }

    /**
     * Deep booming impact sound.
     */
    playShockwave() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Sub-bass impact sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(24, now + 0.55);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.62);

        // Filtered low rumble noise
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(320, now);
            filter.frequency.exponentialRampToValueAtTime(40, now + 0.5);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.4, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.sfxGain);

            noise.start(now);
            noise.stop(now + 0.58);
        }
    }

    /**
     * Filtered white noise decay explosion.
     */
    playExplosion() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Sub-punch kick
        const kick = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kick.type = 'triangle';
        kick.frequency.setValueAtTime(160, now);
        kick.frequency.exponentialRampToValueAtTime(30, now + 0.22);
        kickGain.gain.setValueAtTime(0.45, now);
        kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        kick.connect(kickGain);
        kickGain.connect(this.sfxGain);
        kick.start(now);
        kick.stop(now + 0.26);

        // Swept white noise blast
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800, now);
            filter.frequency.exponentialRampToValueAtTime(70, now + 0.6);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.48, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.sfxGain);

            noise.start(now);
            noise.stop(now + 0.68);
        }
    }

    /**
     * Celebratory retro victory fanfare.
     */
    playVictory() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Triumphant Fanfare Melody (Notes + timing)
        // C5, C5, C5, C5 (hold), Ab4, Bb4, C5 (long hold with harmonized chord)
        const notes = [
            { f: 523.25, d: 0.12, t: 0.00 }, // C5
            { f: 523.25, d: 0.12, t: 0.14 }, // C5
            { f: 523.25, d: 0.12, t: 0.28 }, // C5
            { f: 523.25, d: 0.38, t: 0.42 }, // C5
            { f: 415.30, d: 0.38, t: 0.84 }, // Ab4
            { f: 466.16, d: 0.38, t: 1.26 }, // Bb4
            { f: 523.25, d: 0.95, t: 1.68 }  // C5 (finale)
        ];

        // Harmonizing final chord notes (Eb5, G5)
        const chords = [
            { f: 659.25, d: 0.95, t: 1.68 }, // E5
            { f: 783.99, d: 0.95, t: 1.68 }  // G5
        ];

        [...notes, ...chords].forEach(n => {
            const start = now + n.t;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(n.f, start);

            gain.gain.setValueAtTime(0.24, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + n.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(start);
            osc.stop(start + n.d + 0.05);
        });
    }

    /**
     * Additional UI & Gameplay Audio helpers
     */
    playClick() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playDash() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.frequency.linearRampToValueAtTime(400, now + 0.16);
            filter.Q.setValueAtTime(3, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            noise.start(now);
            noise.stop(now + 0.19);
        }
    }

    playCheckpoint() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        chords.forEach((freq, idx) => {
            const start = now + idx * 0.06;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.25, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.38);
        });
    }

    // ==========================================
    // PROCEDURAL CHIPTUNE BACKGROUND MUSIC (BGM)
    // ==========================================

    /**
     * Plays a procedural chiptune soundtrack by name.
     * Supported names: 'menu', 'level1' / 'levelOne', 'level2' / 'levelTwo', 'boss'
     */
    playMusic(trackName, loop = true) {
        const normalized = this._normalizeTrackName(trackName);
        if (this.currentTrack === normalized && this.isPlayingMusic) {
            return;
        }

        this.stopMusic();
        const ctx = this.ensureContext();
        if (!ctx) return;

        const trackData = this._getTrackData(normalized);
        if (!trackData) {
            console.warn(`SoundSynth: Unknown track "${trackName}"`);
            return;
        }

        this.currentTrack = normalized;
        this.isPlayingMusic = true;
        this.musicStep = 0;
        this.nextNoteTime = ctx.currentTime + 0.05;

        // Start precision lookahead scheduler loop (~25ms interval)
        const stepDuration = 60 / trackData.bpm / 4; // 16th note length in seconds

        const schedule = () => {
            if (!this.isPlayingMusic) return;

            // Schedule events in advance (100ms lookahead window)
            while (this.nextNoteTime < ctx.currentTime + 0.12) {
                this._scheduleMusicStep(trackData, this.musicStep, this.nextNoteTime, stepDuration);
                this.nextNoteTime += stepDuration;
                this.musicStep++;

                if (this.musicStep >= trackData.length) {
                    if (loop) {
                        this.musicStep = 0;
                    } else {
                        this.isPlayingMusic = false;
                        break;
                    }
                }
            }
        };

        this.musicTimer = setInterval(schedule, 25);
        schedule();
    }

    /**
     * Cleanly stops background music and releases active oscillator voices.
     */
    stopMusic() {
        this.isPlayingMusic = false;
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }

        if (this.ctx) {
            // Rapid fade-out active voices to avoid clicking
            this.activeMusicVoices.forEach(voice => {
                try {
                    voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
                    voice.gain.gain.setValueAtTime(voice.gain.gain.value, this.ctx.currentTime);
                    voice.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
                    voice.osc.stop(this.ctx.currentTime + 0.05);
                } catch (e) {}
            });
        }
        this.activeMusicVoices = [];
        this.currentTrack = null;
    }

    _normalizeTrackName(name) {
        if (!name) return 'menu';
        const str = String(name).toLowerCase();
        if (str.includes('menu') || str.includes('title')) return 'menu';
        if (str.includes('1') || str.includes('one')) return 'level1';
        if (str.includes('2') || str.includes('two')) return 'level2';
        if (str.includes('boss') || str.includes('3') || str.includes('three')) return 'boss';
        return str;
    }

    /**
     * Schedules a single 16th note step across Lead, Arp, Bass, and Percussion channels.
     */
    _scheduleMusicStep(track, stepIndex, time, stepDuration) {
        const ctx = this.ctx;
        if (!ctx) return;

        // Clean finished voices
        this.activeMusicVoices = this.activeMusicVoices.filter(v => v.endTime > ctx.currentTime);

        // 1. LEAD SYNTH CHANNEL
        if (track.lead && track.lead[stepIndex]) {
            const note = track.lead[stepIndex];
            if (note.freq > 0) {
                const dur = (note.len || 1) * stepDuration * 0.92;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = note.type || 'square';
                osc.frequency.setValueAtTime(note.freq, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(note.vol || 0.18, time + 0.015);
                gain.gain.setValueAtTime(note.vol || 0.18, time + dur * 0.75);
                gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(time);
                osc.stop(time + dur + 0.02);

                this.activeMusicVoices.push({ osc, gain, endTime: time + dur + 0.02 });
            }
        }

        // 2. ARP / HARMONY CHANNEL
        if (track.arp && track.arp[stepIndex]) {
            const freq = track.arp[stepIndex];
            if (freq > 0) {
                const dur = stepDuration * 0.85;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, time);

                gain.gain.setValueAtTime(0.09, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(time);
                osc.stop(time + dur + 0.01);

                this.activeMusicVoices.push({ osc, gain, endTime: time + dur + 0.01 });
            }
        }

        // 3. BASS CHANNEL
        if (track.bass && track.bass[stepIndex]) {
            const freq = track.bass[stepIndex];
            if (freq > 0) {
                const dur = stepDuration * 0.88;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = track.bassType || 'triangle';
                osc.frequency.setValueAtTime(freq, time);

                gain.gain.setValueAtTime(0.24, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(time);
                osc.stop(time + dur + 0.01);

                this.activeMusicVoices.push({ osc, gain, endTime: time + dur + 0.01 });
            }
        }

        // 4. PROCEDURAL NOISE DRUMS (1: Kick, 2: Snare, 3: HiHat, 4: OpenHat)
        if (track.drums && track.drums[stepIndex]) {
            const drum = track.drums[stepIndex];
            if (drum === 1) {
                // Kick
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, time);
                osc.frequency.exponentialRampToValueAtTime(32, time + 0.09);
                gain.gain.setValueAtTime(0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.start(time);
                osc.stop(time + 0.11);
                this.activeMusicVoices.push({ osc, gain, endTime: time + 0.11 });
            } else if (drum === 2 && this.noiseBuffer) {
                // Snare
                const noise = ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1200, time);
                filter.Q.setValueAtTime(1.5, time);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.22, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                noise.start(time);
                noise.stop(time + 0.13);
            } else if ((drum === 3 || drum === 4) && this.noiseBuffer) {
                // Hi-Hat
                const noise = ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(6500, time);

                const dur = drum === 4 ? 0.09 : 0.035;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.12, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                noise.start(time);
                noise.stop(time + dur + 0.01);
            }
        }
    }

    // ==========================================
    // CHIPTUNE TRACK DEFINITIONS
    // ==========================================

    _getTrackData(name) {
        // Standard Frequencies
        const N = {
            REST: 0,
            // Octave 2
            C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
            // Octave 3
            C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
            // Octave 4
            C4: 261.63, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
            // Octave 5
            C5: 523.25, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
            // Octave 6
            C6: 1046.50, D6: 1174.66, E6: 1318.51
        };

        if (name === 'menu') {
            // Track 1: Chill Retro Arpeggio (C Major / A Minor, 114 BPM, 32 steps)
            return {
                bpm: 114,
                length: 32,
                bassType: 'triangle',
                lead: [
                    { freq: N.E5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.G5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.A5, len: 4, vol: 0.18 }, null, null, null,
                    { freq: N.G5, len: 3, vol: 0.16 }, null, null, null,

                    { freq: N.E5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.D5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.C5, len: 6, vol: 0.18 }, null, null, null,
                    null, null, null, null
                ],
                arp: [
                    N.C4, N.E4, N.G4, N.C5,  N.C4, N.E4, N.G4, N.C5,
                    N.A3, N.C4, N.E4, N.A4,  N.A3, N.C4, N.E4, N.A4,
                    N.F3, N.A3, N.C4, N.F4,  N.F3, N.A3, N.C4, N.F4,
                    N.G3, N.B3, N.D4, N.G4,  N.G3, N.B3, N.D4, N.G4
                ],
                bass: [
                    N.C3, 0, N.C3, 0,  N.G2, 0, N.C3, 0,
                    N.A2, 0, N.A2, 0,  N.E2, 0, N.A2, 0,
                    N.F2, 0, N.F2, 0,  N.C3, 0, N.F2, 0,
                    N.G2, 0, N.G2, 0,  N.D3, 0, N.G2, 0
                ],
                drums: [
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 3, 3,  2, 3, 4, 3,
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 3, 3,  2, 3, 2, 4
                ]
            };
        }

        if (name === 'level1') {
            // Track 2: Energetic Platformer Melody (C / G Upbeat, 136 BPM, 32 steps)
            return {
                bpm: 136,
                length: 32,
                bassType: 'square',
                lead: [
                    { freq: N.E5, len: 1.5, vol: 0.2 }, { freq: N.E5, len: 1.5, vol: 0.2 }, null, { freq: N.E5, len: 1.5, vol: 0.2 },
                    null, { freq: N.C5, len: 1.5, vol: 0.2 }, { freq: N.E5, len: 2.0, vol: 0.22 }, null,
                    { freq: N.G5, len: 3.5, vol: 0.24 }, null, null, null,
                    { freq: N.G4, len: 3.0, vol: 0.22 }, null, null, null,

                    { freq: N.C5, len: 2.5, vol: 0.2 }, null, null, { freq: N.G4, len: 2.0, vol: 0.2 },
                    null, null, { freq: N.E4, len: 2.5, vol: 0.2 }, null,
                    { freq: N.A4, len: 2.0, vol: 0.2 }, null, { freq: N.B4, len: 2.0, vol: 0.2 }, null,
                    { freq: N.Bb4, len: 1.5, vol: 0.2 }, { freq: N.A4, len: 2.5, vol: 0.22 }, null, null
                ],
                arp: [
                    N.C4, N.G4, N.C5, N.G4,  N.C4, N.G4, N.C5, N.G4,
                    N.C4, N.G4, N.C5, N.G4,  N.G3, N.D4, N.G4, N.D4,
                    N.A3, N.E4, N.A4, N.E4,  N.E3, N.B3, N.E4, N.B3,
                    N.F3, N.C4, N.F4, N.C4,  N.G3, N.D4, N.G4, N.D4
                ],
                bass: [
                    N.C3, 0, N.C3, N.C3,  0, N.C3, 0, N.E3,
                    N.G3, 0, N.G3, 0,     N.G2, 0, N.B2, 0,
                    N.A2, 0, N.A2, 0,     N.E3, 0, N.E2, 0,
                    N.F2, 0, N.F2, 0,     N.G2, 0, N.G2, N.B2
                ],
                drums: [
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 1, 3,  2, 3, 4, 3,
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 1, 1,  2, 2, 2, 4
                ]
            };
        }

        if (name === 'level2') {
            // Track 3: Fast Techno/Arcade Bassline & Lead (D Minor, 150 BPM, 32 steps)
            return {
                bpm: 150,
                length: 32,
                bassType: 'sawtooth',
                lead: [
                    { freq: N.D5, len: 1.8, vol: 0.22 }, null, { freq: N.D5, len: 1.8, vol: 0.22 }, null,
                    { freq: N.F5, len: 2.0, vol: 0.24 }, null, { freq: N.G5, len: 2.0, vol: 0.24 }, null,
                    { freq: N.A5, len: 3.5, vol: 0.25 }, null, null, null,
                    { freq: N.G5, len: 1.8, vol: 0.22 }, null, { freq: N.F5, len: 1.8, vol: 0.22 }, null,

                    { freq: N.D5, len: 1.8, vol: 0.22 }, null, { freq: N.A4, len: 1.8, vol: 0.22 }, null,
                    { freq: N.C5, len: 2.0, vol: 0.24 }, null, { freq: N.D5, len: 3.0, vol: 0.25 }, null,
                    { freq: N.F5, len: 1.5, vol: 0.22 }, { freq: N.E5, len: 1.5, vol: 0.22 }, { freq: N.D5, len: 1.5, vol: 0.22 }, { freq: N.C5, len: 1.5, vol: 0.22 },
                    { freq: N.D5, len: 3.5, vol: 0.25 }, null, null, null
                ],
                arp: [
                    N.D4, N.F4, N.A4, N.D5,  N.D4, N.F4, N.A4, N.D5,
                    N.F4, N.A4, N.C5, N.F5,  N.G4, N.Bb4, N.D5, N.G5,
                    N.A4, N.C5, N.E5, N.A5,  N.G4, N.Bb4, N.D5, N.G5,
                    N.Bb4, N.D5, N.F5, N.Bb5, N.A4, N.Cs5, N.E5, N.A5
                ],
                bass: [
                    N.D3, N.D3, N.D3, N.D3,  N.D3, N.D3, N.F3, N.G3,
                    N.F3, N.F3, N.F3, N.F3,  N.G3, N.G3, N.A3, N.C4,
                    N.D3, N.D3, N.D3, N.D3,  N.D3, N.D3, N.C3, N.C3,
                    N.Bb2, N.Bb2, N.Bb2, N.Bb2, N.A2, N.A2, N.Cs3, N.E3
                ],
                drums: [
                    1, 3, 1, 3,  2, 3, 1, 3,
                    1, 3, 1, 3,  2, 3, 4, 3,
                    1, 3, 1, 3,  2, 3, 1, 1,
                    1, 3, 1, 3,  2, 2, 2, 4
                ]
            };
        }

        if (name === 'boss') {
            // Track 4: Tense, Driving Boss Battle Theme (C Minor, 160 BPM, 32 steps)
            return {
                bpm: 160,
                length: 32,
                bassType: 'sawtooth',
                lead: [
                    { freq: N.C5, len: 2.0, vol: 0.25 }, null, { freq: N.Eb5, len: 2.0, vol: 0.25 }, null,
                    { freq: N.Fs5, len: 3.5, vol: 0.28 }, null, null, null,
                    { freq: N.G5, len: 2.0, vol: 0.25 }, null, { freq: N.Fs5, len: 2.0, vol: 0.25 }, null,
                    { freq: N.Eb5, len: 3.5, vol: 0.25 }, null, null, null,

                    { freq: N.C5, len: 1.5, vol: 0.24 }, { freq: N.Eb5, len: 1.5, vol: 0.24 }, { freq: N.G5, len: 1.5, vol: 0.26 }, { freq: N.C6, len: 2.5, vol: 0.28 },
                    null, null, { freq: N.B5, len: 2.0, vol: 0.26 }, null,
                    { freq: N.Ab5, len: 2.0, vol: 0.25 }, null, { freq: N.G5, len: 2.0, vol: 0.25 }, null,
                    { freq: N.Fs5, len: 2.0, vol: 0.25 }, null, { freq: N.G5, len: 3.0, vol: 0.26 }, null
                ],
                arp: [
                    N.C4, N.Eb4, N.Fs4, N.C5,  N.C4, N.Eb4, N.Fs4, N.C5,
                    N.G4, N.B4, N.D5, N.G5,    N.Eb4, N.G4, N.Bb4, N.Eb5,
                    N.C4, N.Eb4, N.G4, N.C5,   N.Ab3, N.C4, N.Eb4, N.Ab4,
                    N.Fs3, N.A3, N.C4, N.Fs4,  N.G3, N.B3, N.D4, N.G4
                ],
                bass: [
                    N.C3, N.C3, N.C3, N.C3,  N.C3, N.C3, N.Eb3, N.G3,
                    N.C3, N.C3, N.C3, N.C3,  N.Eb3, N.Eb3, N.D3, N.D3,
                    N.C3, N.C3, N.C3, N.C3,  N.Ab2, N.Ab2, N.Ab2, N.Ab2,
                    N.Fs2, N.Fs2, N.Fs2, N.Fs2, N.G2, N.G2, N.G2, N.G2
                ],
                drums: [
                    1, 1, 3, 3,  2, 3, 1, 1,
                    1, 3, 1, 3,  2, 2, 4, 3,
                    1, 1, 3, 3,  2, 3, 1, 1,
                    1, 1, 2, 2,  2, 2, 1, 4
                ]
            };
        }

        return null;
    }
}

export default SoundSynth;
