/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Level3Boss.js — Level 3 Mega Baddie Boss Arena
 * ============================================================================
 * Features:
 * - Enclosed Boss Arena (800px x 600px) with dynamic tiered floating platforms
 * - Hazard lava/plasma pits on side flanks
 * - Animated torches & atmospheric ambient ember particles
 * - Dramatic Boss Intro Sequence ("MEGA BADDIE - GUARDIAN OF THE COIN")
 * - Full combat lifecycle: Boss phase transitions, adds, stomp collision, screen shake
 * - Victory Celebration sequence with fireworks, fanfare, and score bonus calculation
 */

import { Player } from '../entities/Player.js';
import { MegaBaddieBoss, BossState } from '../entities/Boss.js';
import { Collectable } from '../entities/Collectable.js';

export class Level3Boss {
    /**
     * @param {Object} options
     * @param {import('../audio/SoundSynth.js').SoundSynth} [options.audio]
     * @param {import('../fx/ParticleSystem.js').ParticleSystem} [options.particles]
     * @param {import('../core/Camera.js').Camera} [options.camera]
     * @param {import('../ui/HUD.js').HUD} [options.hud]
     * @param {Function} [options.onComplete]
     * @param {Function} [options.onGameOver]
     * @param {number} [options.startingScore=0]
     * @param {number} [options.startingLives=3]
     */
    constructor(options = {}) {
        this.width = 800;
        this.height = 600;
        this.tileWidth = 24;
        this.tileHeight = 24;

        // Systems
        this.audio = options.audio ?? null;
        this.particles = options.particles ?? null;
        this.camera = options.camera ?? null;
        this.hud = options.hud ?? null;
        this.onComplete = options.onComplete ?? null;
        this.onGameOver = options.onGameOver ?? null;

        // Persistent stats
        this.startingScore = options.startingScore ?? 0;
        this.startingLives = options.startingLives ?? 3;

        // Arena Platforms Geometry
        this.platforms = [
            // Main Center Arena Floor
            { x: 80, y: 520, width: 640, height: 80, type: 'floor' },
            // Left Hazard Lava Pit
            { x: 0, y: 540, width: 80, height: 60, type: 'hazard' },
            // Right Hazard Lava Pit
            { x: 720, y: 540, width: 80, height: 60, type: 'hazard' },

            // Lower Left Tier Platform
            { x: 120, y: 400, width: 140, height: 16, type: 'platform' },
            // Lower Right Tier Platform
            { x: 540, y: 400, width: 140, height: 16, type: 'platform' },

            // Middle High Tier Platform (Stomp Launchpad)
            { x: 310, y: 300, width: 180, height: 16, type: 'platform' },

            // Upper High Left Vantage Point
            { x: 80, y: 200, width: 120, height: 16, type: 'platform' },
            // Upper High Right Vantage Point
            { x: 600, y: 200, width: 120, height: 16, type: 'platform' }
        ];

        // Animated Torches
        this.torches = [
            { x: 140, y: 380, animTime: 0 },
            { x: 660, y: 380, animTime: 1.5 },
            { x: 100, y: 180, animTime: 2.2 },
            { x: 700, y: 180, animTime: 3.1 },
            { x: 400, y: 80, animTime: 0.8 }
        ];

        // Entities
        this.player = null;
        this.boss = null;
        this.collectables = [];

        // Intro / Lifecycle State
        this.state = 'INTRO'; // 'INTRO' | 'BATTLE' | 'VICTORY' | 'GAME_OVER'
        this.introTimer = 0;
        this.introDuration = 3.5;
        this.victoryTimer = 0;
        this.timeElapsed = 0;
        this.isCompleted = false;

        // Init level
        this.buildStage();
    }

    buildStage() {
        // 1. Spawn Player in platformer mode
        this.player = new Player({
            x: 140,
            y: 450,
            mode: 'platformer',
            score: this.startingScore,
            lives: this.startingLives,
            audio: this.audio,
            particles: this.particles
        });

        // 2. Spawn Mega Baddie Boss
        this.boss = new MegaBaddieBoss({
            x: 400 - 38,
            y: 320,
            maxHp: 5,
            audio: this.audio,
            particles: this.particles,
            camera: this.camera,
            hud: this.hud,
            onDefeated: () => this.handleBossDefeated()
        });

        // 3. Spawn Emergency Powerups on high platforms
        this.collectables = [
            new Collectable({
                x: 130,
                y: 160,
                itemType: 'speed',
                scoreValue: 250,
                audio: this.audio,
                particles: this.particles
            }),
            new Collectable({
                x: 650,
                y: 160,
                itemType: 'shield',
                scoreValue: 300,
                audio: this.audio,
                particles: this.particles
            }),
            new Collectable({
                x: 390,
                y: 260,
                itemType: 'extraLife',
                scoreValue: 500,
                audio: this.audio,
                particles: this.particles
            })
        ];

        // Setup Camera
        if (this.camera) {
            this.camera.setBounds(0, 0, this.width, this.height);
            this.camera.snapTo(this.width / 2, this.height / 2);
        }

        // Setup HUD
        if (this.hud) {
            this.hud.setLevel('LEVEL 3: MEGA BADDIE ARENA');
            this.hud.setHealth(3, 3, this.player.lives);
            this.hud.setScore(this.player.score, true);
            this.hud.showBoss('MEGA BADDIE', 5, 5, 'PHASE 1');
            this.hud.showToast('FINAL BATTLE!', 'Stun the boss to stomp its head!', 3500);
        }

        // Start Boss Music
        this.audio?.playMusic?.('boss');
    }

    // =========================================================================
    // UPDATE LOOP
    // =========================================================================
    update(du = 1.0, dtMs = 16.666, input = null) {
        const dt = dtMs / 1000;
        this.timeElapsed += dt;

        // Update Torches
        for (const torch of this.torches) {
            torch.animTime += dt;
            if (Math.random() < 0.25 && this.particles) {
                this.particles.emitDust(torch.x, torch.y, 0, 1);
            }
        }

        // State Machine
        if (this.state === 'INTRO') {
            this.introTimer += dt;
            this.boss.update(dt, this.player, this);

            if (this.introTimer >= this.introDuration) {
                this.state = 'BATTLE';
            }
        } else if (this.state === 'BATTLE') {
            // Update Player
            if (this.player) {
                this.player.update(du, dtMs, input, this);

                // Update HUD stats
                if (this.hud) {
                    this.hud.setHealth(this.player.isDead ? 0 : 3, 3, this.player.lives);
                    this.hud.setScore(this.player.score);
                    this.hud.setTime(this.timeElapsed);
                    this.hud.setCombo(this.player.comboCount, this.player.comboMultiplier, this.player.comboTimer / this.player.comboDuration);
                }

                // Check Game Over
                if (this.player.lives <= 0 && this.player.isDead) {
                    this.state = 'GAME_OVER';
                    if (this.onGameOver) this.onGameOver(this.player.score);
                    return;
                }

                // Check Hazard Pits Collision
                this._checkHazardPits();

                // Check Collectables Collision
                this._checkCollectables();

                // Check Boss & Projectiles Collision
                this._checkBossCombat(dt);
            }

            // Update Boss
            if (this.boss && this.boss.alive) {
                this.boss.update(dt, this.player, this);
            }

            // Camera target lerping between player and boss
            if (this.camera && this.player && this.boss) {
                const midX = (this.player.cx * 0.6 + this.boss.cx * 0.4);
                const midY = (this.player.cy * 0.6 + this.boss.cy * 0.4);
                this.camera.targetX = midX;
                this.camera.targetY = midY;
                this.camera.update(du, dtMs);
            }
        } else if (this.state === 'VICTORY') {
            this.victoryTimer += dt;

            // Player victory cheer
            if (this.player) {
                this.player.vx = 0;
                this.player.update(du, dtMs, null, this);
            }

            // Celebratory Fireworks
            if (Math.random() < 0.3 && this.particles) {
                const rx = 100 + Math.random() * (this.width - 200);
                const ry = 80 + Math.random() * 250;
                const colors = ['#ffd60a', '#00f5d4', '#ff0055', '#7209b7', '#ffffff'];
                this.particles.emitFireworks?.(rx, ry, 35, colors[Math.floor(Math.random() * colors.length)]);
            }

            if (this.victoryTimer >= 4.0 && !this.isCompleted) {
                this.isCompleted = true;
                if (this.onComplete) {
                    this.onComplete({
                        score: this.player.score,
                        lives: this.player.lives,
                        time: this.timeElapsed,
                        coins: this.player.coinsCollected
                    });
                }
            }
        }
    }

    // =========================================================================
    // COLLISION RESOLUTION FOR PLATFORMS & HAZARDS
    // =========================================================================

    /**
     * Resolves horizontal entity collisions with platforms/walls.
     */
    resolveCollisionX(entity) {
        // Arena outer walls
        if (entity.left < 16) {
            entity.x = 16;
            entity.vx = 0;
        } else if (entity.right > this.width - 16) {
            entity.x = this.width - 16 - entity.width;
            entity.vx = 0;
        }
    }

    /**
     * Resolves vertical entity collisions with platforms/floor.
     */
    resolveCollisionY(entity) {
        for (const plat of this.platforms) {
            if (plat.type === 'hazard') continue;

            const platTop = plat.y;
            const platBottom = plat.y + plat.height;
            const platLeft = plat.x;
            const platRight = plat.x + plat.width;

            // Check if entity is within platform X bounds
            if (entity.right > platLeft && entity.left < platRight) {
                // One-way landing from above
                if (entity.vy >= 0 && entity.bottom >= platTop && entity.bottom <= platTop + 24) {
                    entity.y = platTop - entity.height;
                    entity.vy = 0;
                    entity.isGrounded = true;
                }
            }
        }
    }

    _checkHazardPits() {
        if (!this.player || this.player.isDead) return;

        for (const plat of this.platforms) {
            if (plat.type === 'hazard') {
                if (
                    this.player.right > plat.x &&
                    this.player.left < plat.x + plat.width &&
                    this.player.bottom >= plat.y + 12
                ) {
                    this.player.takeDamage(this);
                    this.player.vy = -450; // Pop out of pit
                    this.particles?.emitExplosion(this.player.cx, plat.y, 14, ['#ff0055', '#ff9900']);
                }
            }
        }
    }

    _checkCollectables() {
        if (!this.player || this.player.isDead) return;

        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const item = this.collectables[i];
            item.update(0.016, this.player);

            if (this.player.intersects(item)) {
                this.player.collectItem(item);
                this.collectables.splice(i, 1);
            }
        }
    }

    _checkBossCombat(dt) {
        if (!this.boss || !this.boss.alive || !this.player || this.player.isDead) return;

        // 1. Direct Boss Collision
        this.boss.handlePlayerCollision(this.player);

        // 2. Boss Shockwave Collision
        for (const sw of this.boss.shockwaves) {
            if (!sw.alive) continue;
            if (this.player.intersects(sw)) {
                // Hits player unless player is jumping high above it
                if (this.player.bottom > sw.top + 4) {
                    if (this.player.shieldTimer > 0) {
                        sw.kill();
                        this.particles?.emitExplosion(sw.cx, sw.cy, 6, ['#00e5ff', '#ffffff']);
                    } else {
                        this.player.takeDamage(sw);
                        sw.kill();
                    }
                }
            }
        }

        // 3. Boss Projectile Collision
        for (const p of this.boss.projectiles) {
            if (!p.alive) continue;
            if (this.player.intersects(p)) {
                if (this.player.shieldTimer > 0) {
                    p.kill();
                    this.particles?.emitExplosion(p.cx, p.cy, 8, ['#00e5ff', '#ffffff']);
                } else {
                    this.player.takeDamage(p);
                    p.kill();
                }
            }
        }

        // 4. Boss Minions Collision
        for (let i = this.boss.minions.length - 1; i >= 0; i--) {
            const minion = this.boss.minions[i];
            if (!minion.alive) continue;

            if (this.player.intersects(minion)) {
                // Stomp minion
                if (this.player.vy > 0 && this.player.bottom <= minion.top + 16) {
                    minion.takeStomp(this.player);
                    this.player.bounceOnEnemy();
                } else {
                    if (this.player.shieldTimer > 0) {
                        minion.takeKnockout();
                    } else {
                        this.player.takeDamage(minion);
                    }
                }
            }
        }
    }

    handleBossDefeated() {
        this.state = 'VICTORY';
        this.victoryTimer = 0;

        // Big score bonus
        if (this.player) {
            const bossBonus = 5000;
            this.player.addScore(bossBonus);
            this.particles?.emitFloatingText(this.width / 2, 200, `BOSS DEFEATED! +${bossBonus}`, '#ffd60a', 20);
        }

        // Audio Fanfare
        this.audio?.playVictory?.();
        this.hud?.hideBoss?.();
        this.hud?.showToast('VICTORY!', 'You defeated Mega Baddie and saved the coin!', 4000);
    }

    // =========================================================================
    // RENDERING
    // =========================================================================
    draw(ctx) {
        // 1. Dark Fortress / Dungeon Background
        this._drawBackground(ctx);

        // 2. Torches & Light Sources
        this._drawTorches(ctx);

        // 3. Platforms & Hazard Lava Pits
        this._drawPlatforms(ctx);

        // 4. Collectables
        for (const item of this.collectables) {
            item.draw(ctx);
        }

        // 5. Boss Entity (Shockwaves, Projectiles, Body)
        if (this.boss) {
            this.boss.draw(ctx);
        }

        // 6. Player Entity
        if (this.player) {
            this.player.draw(ctx);
        }

        // 7. Intro Title Banner ("MEGA BADDIE - GUARDIAN OF THE COIN")
        if (this.state === 'INTRO') {
            this._drawIntroTitleCard(ctx);
        }

        // 8. Victory Banner
        if (this.state === 'VICTORY') {
            this._drawVictoryCard(ctx);
        }
    }

    _drawBackground(ctx) {
        // Dungeon Wall Gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#0d0f18');
        bgGrad.addColorStop(0.5, '#16192b');
        bgGrad.addColorStop(1, '#201625');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Stone Brick Pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let y = 0; y < this.height; y += 32) {
            const shift = (Math.floor(y / 32) % 2) * 24;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();

            for (let x = shift; x < this.width; x += 48) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + 32);
                ctx.stroke();
            }
        }

        // Arena Pillars in Background
        ctx.fillStyle = 'rgba(15, 18, 30, 0.6)';
        ctx.fillRect(60, 0, 36, this.height);
        ctx.fillRect(this.width - 96, 0, 36, this.height);
        ctx.fillRect(260, 0, 24, this.height);
        ctx.fillRect(516, 0, 24, this.height);
    }

    _drawTorches(ctx) {
        for (const t of this.torches) {
            ctx.save();
            ctx.translate(t.x, t.y);

            // Torch Bracket
            ctx.fillStyle = '#4a4e69';
            ctx.fillRect(-3, 0, 6, 14);

            // Torch Flame
            const flicker = Math.sin(t.animTime * 12) * 2;
            ctx.shadowColor = '#ff9900';
            ctx.shadowBlur = 16;

            const flameGrad = ctx.createRadialGradient(0, -6, 1, 0, -6, 12);
            flameGrad.addColorStop(0, '#ffffff');
            flameGrad.addColorStop(0.4, '#ffd60a');
            flameGrad.addColorStop(0.8, '#ff3b30');
            flameGrad.addColorStop(1, 'rgba(255, 59, 48, 0)');
            ctx.fillStyle = flameGrad;

            ctx.beginPath();
            ctx.arc(0, -6 + flicker, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    _drawPlatforms(ctx) {
        for (const plat of this.platforms) {
            ctx.save();

            if (plat.type === 'hazard') {
                // Bubbling Lava Pit
                const lavaGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.height);
                lavaGrad.addColorStop(0, '#ff0055');
                lavaGrad.addColorStop(0.5, '#ff5500');
                lavaGrad.addColorStop(1, '#660000');
                ctx.fillStyle = lavaGrad;
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 12;

                ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

                // Bubbles & Surface wave
                ctx.fillStyle = '#ffd60a';
                for (let x = plat.x + 8; x < plat.x + plat.width; x += 16) {
                    const wave = Math.sin((this.timeElapsed * 5) + x) * 3;
                    ctx.beginPath();
                    ctx.arc(x, plat.y + 4 + wave, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Solid Stone Arena Platforms
                const stoneGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.height);
                stoneGrad.addColorStop(0, '#3a3f58');
                stoneGrad.addColorStop(1, '#1e2233');
                ctx.fillStyle = stoneGrad;
                ctx.strokeStyle = '#6c757d';
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 4);
                ctx.fill();
                ctx.stroke();

                // Glowing Platform Edge Rim
                ctx.fillStyle = '#00f5d4';
                ctx.shadowColor = '#00f5d4';
                ctx.shadowBlur = 6;
                ctx.fillRect(plat.x + 2, plat.y, plat.width - 4, 3);
            }

            ctx.restore();
        }
    }

    _drawIntroTitleCard(ctx) {
        ctx.save();
        const alpha = Math.min(1.0, (this.introDuration - this.introTimer) * 1.5);
        ctx.globalAlpha = Math.max(0, alpha);

        // Dark Letterbox Backing
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 190, this.width, 100);

        // Border Stripes
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(0, 186, this.width, 4);
        ctx.fillRect(0, 290, this.width, 4);

        // Boss Title
        ctx.font = 'bold 24px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd60a';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;
        ctx.fillText('MEGA BADDIE', this.width / 2, 235);

        // Subtitle
        ctx.font = '12px "Press Start 2P", monospace, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.fillText('GUARDIAN OF THE SACRED COIN', this.width / 2, 265);

        ctx.restore();
    }

    _drawVictoryCard(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 160, this.width, 140);

        ctx.font = 'bold 28px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00f5d4';
        ctx.shadowColor = '#ffd60a';
        ctx.shadowBlur = 16;
        ctx.fillText('VICTORY!', this.width / 2, 215);

        ctx.font = '12px "Press Start 2P", monospace, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fillText('THE GAME HAS BEEN MASTERED!', this.width / 2, 255);

        ctx.restore();
    }
}
