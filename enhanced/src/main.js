/**
 * main.js - Master Game Bootstrapper & Lifecycle Controller
 * The Game! — Enhanced Edition
 */

import { Engine } from './core/Engine.js';
import { Input, Action } from './core/Input.js';
import { Camera } from './core/Camera.js';
import { StorageManager } from './core/Storage.js';
import { SoundSynth } from './audio/SoundSynth.js';
import { ParticleSystem } from './fx/ParticleSystem.js';
import { HUD } from './ui/HUD.js';
import { LevelManager } from './levels/LevelManager.js';

window.addEventListener('DOMContentLoaded', () => {
    // 1. Canvas & Viewport Setup
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element #gameCanvas not found!');
        return;
    }

    const ctx = canvas.getContext('2d');

    // 2. Initialize Subsystems
    const storage = new StorageManager();
    const input = new Input({ targetElement: window });
    const audio = new SoundSynth();
    const particles = new ParticleSystem();
    const camera = new Camera({
        viewportWidth: canvas.width,
        viewportHeight: canvas.height,
        lerpFactor: 0.08
    });

    // 3. Initialize HUD and DOM Controls
    const hudContainer = document.getElementById('hudContainer') || document.body;
    const hud = new HUD({
        container: hudContainer,
        input: input,
        storage: storage
    });

    // Connect Audio to HUD Settings
    if (audio) {
        hud.callbacks.onVolumeChange = (vol) => audio.setVolume(vol / 100);
        hud.callbacks.onMusicVolumeChange = (vol) => audio.setMusicVolume(vol / 100);
        hud.callbacks.onMuteToggle = (isMuted) => audio.setMuted(isMuted);
    }

    // 4. Initialize Level Manager
    const levelManager = new LevelManager({
        canvas: canvas,
        input: input,
        camera: camera,
        audio: audio,
        particles: particles,
        hud: hud,
        storage: storage
    });

    // 5. Initialize Core Engine
    const engine = new Engine({
        canvas: canvas,
        update: (du, dt) => {
            input.update();

            // Check pause toggle
            if (input.eat(Action.PAUSE)) {
                engine.togglePause();
                hud.setPaused(engine.isPaused);
            }

            // Check mute toggle
            if (input.eat(Action.MUTE)) {
                const muted = audio.toggleMute();
                hud.showToast(muted ? 'AUDIO MUTED' : 'AUDIO UNMUTED', 'audio');
            }

            // Check fullscreen toggle
            if (input.eat(Action.FULLSCREEN)) {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            }

            levelManager.update(du, dt);
        },
        render: (ctx) => {
            // Clear canvas buffer
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Render active level and game state
            levelManager.render(ctx);
        },
        onPauseChange: (isPaused) => {
            hud.setPaused(isPaused);
        }
    });

    // 6. Canvas Mouse / Touch Click Support
    canvas.addEventListener('pointerdown', (e) => {
        // Resume Web Audio on first gesture
        audio?.resume?.();

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        levelManager.handleClick(x, y);
    });

    // 7. Start the Game!
    levelManager.init();
    engine.start();

    console.log('✨ The Game! Enhanced Edition initialized successfully.');
});
