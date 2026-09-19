/**
 * LevelManager.js - State Machine & Progression Orchestrator
 * The Game! — Enhanced Edition
 * 
 * Manages transitions between:
 * - TITLE -> LEVEL_1 -> LEVEL_2 -> LEVEL_3_BOSS -> VICTORY -> GAME_OVER
 * - Preserves player stats (Score, Lives, Elapsed Time, Best Times) across levels
 * - Connects Camera, ParticleSystem, SoundSynth, HUD, and StorageManager
 */

import { Action } from '../core/Input.js';
import { TitleScreen } from './TitleScreen.js';
import { Level1Platformer } from './Level1Platformer.js';
import { Level2Maze } from './Level2Maze.js';
import { Level3Boss } from './Level3Boss.js';

export const GameState = {
    TITLE: 'TITLE',
    LEVEL_1: 'LEVEL_1',
    LEVEL_2: 'LEVEL_2',
    LEVEL_3_BOSS: 'LEVEL_3_BOSS',
    VICTORY: 'VICTORY',
    GAME_OVER: 'GAME_OVER'
};

export class LevelManager {
    /**
     * @param {Object} options
     * @param {HTMLCanvasElement} options.canvas
     * @param {import('../core/Input.js').Input} options.input
     * @param {import('../core/Camera.js').Camera} options.camera
     * @param {import('../audio/SoundSynth.js').SoundSynth} options.audio
     * @param {import('../fx/ParticleSystem.js').ParticleSystem} options.particles
     * @param {import('../ui/HUD.js').HUD} options.hud
     * @param {import('../core/Storage.js').StorageManager} options.storage
     */
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.input = options.input;
        this.camera = options.camera;
        this.audio = options.audio;
        this.particles = options.particles;
        this.hud = options.hud;
        this.storage = options.storage;

        // Current Active State
        this.state = GameState.TITLE;
        this.currentLevel = null;

        // Persistent Player Session Stats
        this.sessionScore = 0;
        this.sessionLives = 3;
        this.sessionTime = 0;

        // Overlay screen timers
        this.animTime = 0;
        this.victoryParticlesTimer = 0;

        // Instantiate Title Screen
        this.titleScreen = new TitleScreen({
            audio: this.audio,
            input: this.input,
            storage: this.storage,
            onSelectOption: (optionId) => this.handleTitleSelection(optionId)
        });

        // Bind HUD event listeners if available
        if (this.hud) {
            this.hud.callbacks.onRestart = () => this.restartCurrentLevel();
            this.hud.callbacks.onQuitToMenu = () => this.goToTitle();
        }
    }

    init() {
        this.goToTitle();
    }

    goToTitle() {
        this.state = GameState.TITLE;
        this.currentLevel = this.titleScreen;
        this.titleScreen.init();
        this.particles?.clear?.();
        this.hud?.hideBossBar?.();
        this.hud?.setTopBarVisible?.(false);
    }

    handleTitleSelection(optionId, extra = 1) {
        this.sessionScore = 0;
        this.sessionLives = 3;
        this.sessionTime = 0;

        switch (optionId) {
            case 'start':
            case 'start_game':
            case 'level1':
                this.loadLevel(GameState.LEVEL_1);
                break;
            case 'level2':
                this.loadLevel(GameState.LEVEL_2);
                break;
            case 'level3':
                this.loadLevel(GameState.LEVEL_3_BOSS);
                break;
            case 'load_level':
                if (extra === 1) this.loadLevel(GameState.LEVEL_1);
                else if (extra === 2) this.loadLevel(GameState.LEVEL_2);
                else if (extra === 3) this.loadLevel(GameState.LEVEL_3_BOSS);
                break;
            case 'classic':
            case 'classic_mode':
                window.location.href = '../classic/THEGAME.html';
                break;
        }
    }

    handleClick(x, y) {
        if (this.currentLevel?.handleClick) {
            this.currentLevel.handleClick(x, y);
        } else if (this.state === GameState.VICTORY || this.state === GameState.GAME_OVER) {
            this.goToTitle();
        }
    }

    loadLevel(state) {
        this.state = state;
        this.particles?.clear?.();
        this.hud?.hideBossBar?.();
        this.hud?.setTopBarVisible?.(true);

        const playerStats = {
            score: this.sessionScore,
            lives: this.sessionLives
        };

        switch (state) {
            case GameState.LEVEL_1:
                this.hud?.setLevelTitle?.('LEVEL 1: PLATFORMER');
                this.currentLevel = new Level1Platformer({
                    audio: this.audio,
                    particles: this.particles,
                    camera: this.camera,
                    hud: this.hud,
                    onComplete: (stats) => {
                        this.sessionScore = stats.score;
                        this.sessionLives = stats.lives;
                        this.loadLevel(GameState.LEVEL_2);
                    },
                    onGameOver: (finalScore) => this.triggerGameOver(finalScore)
                });
                if (this.currentLevel.player) {
                    this.currentLevel.player.score = this.sessionScore;
                    this.currentLevel.player.lives = this.sessionLives;
                }
                break;

            case GameState.LEVEL_2:
                this.hud?.setLevelTitle?.('LEVEL 2: MAZE RUNNER');
                this.currentLevel = new Level2Maze({
                    audio: this.audio,
                    particles: this.particles,
                    camera: this.camera,
                    hud: this.hud,
                    onComplete: (stats) => {
                        this.sessionScore = stats.score;
                        this.sessionLives = stats.lives;
                        this.loadLevel(GameState.LEVEL_3_BOSS);
                    },
                    onGameOver: (finalScore) => this.triggerGameOver(finalScore)
                });
                if (this.currentLevel.player) {
                    this.currentLevel.player.score = this.sessionScore;
                    this.currentLevel.player.lives = this.sessionLives;
                }
                break;

            case GameState.LEVEL_3_BOSS:
                this.hud?.setLevelTitle?.('LEVEL 3: MEGA BADDIE BOSS');
                this.currentLevel = new Level3Boss({
                    audio: this.audio,
                    particles: this.particles,
                    camera: this.camera,
                    hud: this.hud,
                    onComplete: (stats) => {
                        this.sessionScore = stats.score;
                        this.sessionLives = stats.lives;
                        this.triggerVictory();
                    },
                    onGameOver: (finalScore) => this.triggerGameOver(finalScore)
                });
                if (this.currentLevel.player) {
                    this.currentLevel.player.score = this.sessionScore;
                    this.currentLevel.player.lives = this.sessionLives;
                }
                break;
        }
    }

    triggerVictory() {
        this.state = GameState.VICTORY;
        this.audio?.playMusic?.('menu');
        this.hud?.hideBossBar?.();
        this.hud?.showToast('CONGRATULATIONS! YOU BEAT THE GAME!', 'achievement');
        this.storage?.saveHighScore?.(this.sessionScore);
    }

    triggerGameOver(finalScore) {
        this.state = GameState.GAME_OVER;
        this.sessionScore = finalScore ?? this.sessionScore;
        this.audio?.playDie?.();
        this.audio?.stopMusic?.();
        this.hud?.hideBossBar?.();
        this.storage?.saveHighScore?.(this.sessionScore);
    }

    restartCurrentLevel() {
        if (this.state === GameState.LEVEL_1 || this.state === GameState.LEVEL_2 || this.state === GameState.LEVEL_3_BOSS) {
            this.loadLevel(this.state);
        } else {
            this.goToTitle();
        }
    }

    update(du, dtMs) {
        const dt = dtMs / 1000;
        this.animTime += dt;

        // Global key actions (Restart / Skip)
        if (this.input?.eat?.(Action.RESTART)) {
            this.restartCurrentLevel();
            return;
        }

        if (this.input?.eat?.(Action.SKIP_LEVEL)) {
            if (this.state === GameState.LEVEL_1) this.loadLevel(GameState.LEVEL_2);
            else if (this.state === GameState.LEVEL_2) this.loadLevel(GameState.LEVEL_3_BOSS);
            else if (this.state === GameState.LEVEL_3_BOSS) this.triggerVictory();
            return;
        }

        // Update active state
        if (this.state === GameState.TITLE) {
            this.titleScreen.update(dt, this.input);
        } else if (this.state === GameState.VICTORY) {
            this.updateVictory(dt);
        } else if (this.state === GameState.GAME_OVER) {
            this.updateGameOver(dt);
        } else if (this.currentLevel) {
            this.sessionTime += dt;
            this.currentLevel.update(dt, this.input);

            // Update Camera lerp (Level1/Level2 set targetX/targetY via follow())
            if (this.camera) {
                this.camera.update(du);
            }

            // Update live HUD stats
            if (this.hud && this.currentLevel.player) {
                const p = this.currentLevel.player;
                this.hud.updateHealth(p.lives);
                this.hud.updateScore(p.score);
                this.hud.updateCombo(p.comboCount, p.comboMultiplier, p.comboTimer / p.comboDuration);
                this.hud.updateTimer(this.sessionTime);
            }
        }

        // Update global particles
        if (this.particles) {
            this.particles.update(dt);
        }
    }

    updateVictory(dt) {
        this.victoryParticlesTimer -= dt;
        if (this.victoryParticlesTimer <= 0) {
            this.victoryParticlesTimer = 0.4;
            const rx = 100 + Math.random() * (this.canvas.width - 200);
            const ry = 80 + Math.random() * 250;
            this.particles?.emitFireworks?.(rx, ry, 25);
        }

        if (this.input?.eat?.(Action.JUMP) || this.input?.eat?.(Action.ACTION) || this.input?.eat?.(Action.PAUSE)) {
            this.goToTitle();
        }
    }

    updateGameOver(dt) {
        if (this.input?.eat?.(Action.JUMP) || this.input?.eat?.(Action.ACTION) || this.input?.eat?.(Action.PAUSE)) {
            this.goToTitle();
        }
    }

    render(ctx) {
        ctx.save();

        if (this.state === GameState.TITLE) {
            this.titleScreen.render(ctx);
        } else if (this.state === GameState.VICTORY) {
            this.renderVictory(ctx);
        } else if (this.state === GameState.GAME_OVER) {
            this.renderGameOver(ctx);
        } else if (this.currentLevel) {
            // Apply Camera Transform
            if (this.camera) {
                this.camera.begin(ctx);
            }

            // Render Level World
            this.currentLevel.render(ctx, this.camera);

            // Render Particles in world space
            if (this.particles) {
                this.particles.render(ctx, this.camera);
            }

            // Restore Camera Transform
            if (this.camera) {
                this.camera.end(ctx);
            }
        }

        ctx.restore();
    }

    renderVictory(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Dark festive background
        ctx.fillStyle = '#0a0d1a';
        ctx.fillRect(0, 0, w, h);

        // Render fireworks particles in screen space
        if (this.particles) {
            this.particles.render(ctx, null);
        }

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '28px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 20;
        ctx.fillText('★ VICTORY! ★', w / 2, h * 0.3);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#06d6a0';
        ctx.shadowColor = '#06d6a0';
        ctx.shadowBlur = 10;
        ctx.fillText('YOU CONQUERED ALL 3 STAGES & DEFEATED MEGA BADDIE!', w / 2, h * 0.4);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`FINAL SCORE: ${this.sessionScore.toLocaleString()} PTS`, w / 2, h * 0.52);

        const mins = Math.floor(this.sessionTime / 60);
        const secs = Math.floor(this.sessionTime % 60);
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#8c96b5';
        ctx.fillText(`COMPLETION TIME: ${mins}:${secs < 10 ? '0' : ''}${secs}`, w / 2, h * 0.6);

        ctx.fillStyle = '#ff9900';
        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = 15;
        ctx.font = '13px "Press Start 2P", monospace';
        ctx.fillText('► PRESS SPACE OR CLICK TO RETURN TO TITLE ◄', w / 2, h * 0.78);

        ctx.restore();
    }

    renderGameOver(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        ctx.fillStyle = 'rgba(15, 5, 10, 0.95)';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '32px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff3b30';
        ctx.shadowColor = '#ff3b30';
        ctx.shadowBlur = 25;
        ctx.fillText('GAME OVER', w / 2, h * 0.35);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd166';
        ctx.shadowBlur = 10;
        ctx.fillText(`SCORE: ${this.sessionScore.toLocaleString()} PTS`, w / 2, h * 0.5);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('► PRESS SPACE TO TRY AGAIN ◄', w / 2, h * 0.68);

        ctx.restore();
    }
}
