/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Boss.js — "Mega Baddie" Level 3 Boss Entity
 * ============================================================================
 * Features:
 * - Multi-Phase Boss Battle AI:
 *   - Phase 1 (100% - 60% HP): Heavy ground leaps across arena platforms that
 *     create expanding ground shockwaves on impact. Player must jump over shockwaves.
 *   - Phase 2 (60% - 20% HP): Enraged mode with fiery aura, faster leaping,
 *     bouncy fireball projectiles, and summoning mini-baddies.
 *   - Phase 3 / Vulnerability Window: After slamming the ground, the boss is stunned
 *     for ~3.5 seconds with circling dizzy stars, allowing player to leap from
 *     high platforms and stomp its weak head spot.
 * - Stomp Interaction: Flashes white, shakes, loses 1 HP, pushes player upward
 *   with high bounce velocity, triggers sound effect and camera screen shake.
 * - Defeat Sequence: Slow-motion chain explosions, fireworks, and victory trigger.
 */

import { Entity } from './Entity.js';
import { PlatformerBaddie } from './Baddie.js';

export const BossState = {
    INTRO: 'INTRO',
    IDLE: 'IDLE',
    LEAP_WINDUP: 'LEAP_WINDUP',
    LEAP_AIR: 'LEAP_AIR',
    SLAM_IMPACT: 'SLAM_IMPACT',
    STUNNED_VULNERABLE: 'STUNNED_VULNERABLE',
    SHOOT_PROJECTILES: 'SHOOT_PROJECTILES',
    SUMMON_MINIONS: 'SUMMON_MINIONS',
    HIT_RECOVERY: 'HIT_RECOVERY',
    DEFEATED: 'DEFEATED'
};

/**
 * Bouncy fireball / spike projectile fired by Boss in Phase 2
 */
export class BossProjectile extends Entity {
    constructor(options = {}) {
        super({
            x: options.x ?? 0,
            y: options.y ?? 0,
            width: options.width ?? 18,
            height: options.height ?? 18,
            vx: options.vx ?? 0,
            vy: options.vy ?? 0,
            tag: 'boss_projectile',
            layer: 8
        });

        this.gravity = options.gravity ?? 650;
        this.bouncesRemaining = options.bounces ?? 3;
        this.bounceDamping = 0.85;
        this.lifeTime = options.lifeTime ?? 5.0;
        this.age = 0;
        this.animTime = Math.random() * 5;
        this.color = options.color ?? '#ff3b30';
    }

    update(dt, level, particles) {
        this.age += dt;
        this.animTime += dt;

        if (this.age >= this.lifeTime || this.bouncesRemaining < 0) {
            this.kill();
            particles?.emitExplosion(this.cx, this.cy, 6, ['#ff3b30', '#ff9500', '#ffd60a']);
            return;
        }

        // Apply Gravity
        this.vy += this.gravity * dt;

        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Bounce on arena boundaries & platforms
        if (level) {
            // Arena walls
            if (this.left < 24) {
                this.x = 24;
                this.vx = Math.abs(this.vx) * this.bounceDamping;
                this.bouncesRemaining--;
            } else if (this.right > (level.width || 800) - 24) {
                this.x = (level.width || 800) - 24 - this.width;
                this.vx = -Math.abs(this.vx) * this.bounceDamping;
                this.bouncesRemaining--;
            }

            // Floor & Platforms
            const floorY = (level.height || 600) - 80;
            if (this.bottom >= floorY) {
                this.y = floorY - this.height;
                this.vy = -Math.abs(this.vy) * this.bounceDamping;
                this.bouncesRemaining--;
                particles?.emitDust(this.cx, this.bottom, 0, 3);
            }
        }

        // Particle trail
        if (Math.random() < 0.35 && particles) {
            particles.emitDust(this.cx, this.cy, 0, 1);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.cx, this.cy);
        ctx.rotate(this.animTime * 8);

        // Glowing Core
        ctx.shadowColor = '#ff3b30';
        ctx.shadowBlur = 12;

        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.width / 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#ffd60a');
        grad.addColorStop(0.8, '#ff3b30');
        grad.addColorStop(1, 'rgba(255, 59, 48, 0)');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Spikes
        ctx.fillStyle = '#ff9500';
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(-3, -this.width / 2);
            ctx.lineTo(0, -this.width / 2 - 5);
            ctx.lineTo(3, -this.width / 2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * Expanding Ground Shockwave created when Boss slams down
 */
export class GroundShockwave extends Entity {
    constructor(options = {}) {
        super({
            x: options.x ?? 0,
            y: options.y ?? 0,
            width: options.width ?? 28,
            height: options.height ?? 32,
            vx: options.vx ?? 0,
            vy: 0,
            tag: 'boss_shockwave',
            layer: 7
        });

        this.direction = options.direction ?? 1; // 1 = right, -1 = left
        this.speed = options.speed ?? 260;
        this.vx = this.direction * this.speed;
        this.lifeTime = options.lifeTime ?? 2.2;
        this.age = 0;
        this.color = options.color ?? '#ff9500';
        this.animTime = 0;
    }

    update(dt, level, particles) {
        this.age += dt;
        this.animTime += dt;

        if (this.age >= this.lifeTime) {
            this.kill();
            return;
        }

        this.x += this.vx * dt;

        // Despawn at arena boundaries
        if (level) {
            if (this.left < 20 || this.right > (level.width || 800) - 20) {
                this.kill();
                particles?.emitDust(this.cx, this.bottom, -this.direction, 3);
            }
        }

        // Emit ground sparks
        if (Math.random() < 0.4 && particles) {
            particles.emitDust(this.cx, this.bottom, -this.direction, 2);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.cx, this.cy);

        const fade = 1 - (this.age / this.lifeTime);
        ctx.globalAlpha = Math.max(0.2, fade);

        // Energy Shockwave Waveform / Spikes
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.fillStyle = this.color;
        const h = this.height * (0.8 + Math.sin(this.animTime * 15) * 0.2);

        ctx.beginPath();
        if (this.direction > 0) {
            // Moving Right
            ctx.moveTo(-this.width / 2, this.height / 2);
            ctx.lineTo(this.width / 2, this.height / 2);
            ctx.lineTo(this.width / 4, -h / 2);
            ctx.lineTo(-this.width / 4, -h / 4);
        } else {
            // Moving Left
            ctx.moveTo(this.width / 2, this.height / 2);
            ctx.lineTo(-this.width / 2, this.height / 2);
            ctx.lineTo(-this.width / 4, -h / 2);
            ctx.lineTo(this.width / 4, -h / 4);
        }
        ctx.closePath();
        ctx.fill();

        // Inner Bright Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, this.height / 4, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * Mega Baddie Boss Entity
 */
export class MegaBaddieBoss extends Entity {
    /**
     * @param {Object} options
     * @param {number} [options.maxHp=5]
     */
    constructor(options = {}) {
        const bossWidth = 76;
        const bossHeight = 76;

        super({
            x: options.x ?? 400 - bossWidth / 2,
            y: options.y ?? 120,
            width: bossWidth,
            height: bossHeight,
            tag: 'boss',
            layer: 12
        });

        // Boss Combat Stats
        this.maxHp = options.maxHp ?? 5;
        this.hp = this.maxHp;
        this.isEnraged = false;
        this.state = BossState.INTRO;
        this.stateTimer = 0;
        this.phase = 1; // 1: 100-60%, 2: 60-20%, 3: 20-0%

        // Integrations
        this.audio = options.audio ?? null;
        this.particles = options.particles ?? null;
        this.camera = options.camera ?? null;
        this.hud = options.hud ?? null;
        this.onDefeated = options.onDefeated ?? null;

        // Physics & AI
        this.gravity = 1100;
        this.jumpForceY = -620;
        this.leapTargetX = this.cx;
        this.slamCount = 0;
        this.slamsBeforeStun = 2; // Stunned after every 2 slams

        // Projectiles & Shockwaves collection managed by level or boss
        this.projectiles = [];
        this.shockwaves = [];
        this.minions = [];

        // Animation & Visuals
        this.animTime = 0;
        this.facing = -1; // -1 = left, 1 = right
        this.flashTimer = 0; // White hit flash
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.dizzyAngle = 0;
        this.auraPulse = 0;

        // Intro presentation
        this.introDuration = 3.0;
        this.introY = this.y;
        this.y = -100; // Drops in from above during intro
    }

    /** Center top weak-spot bounding box for stomping */
    get weakSpotBounds() {
        const spotWidth = this.width * 0.65;
        const spotHeight = 18;
        return {
            x: this.cx - spotWidth / 2,
            y: this.top - 4,
            left: this.cx - spotWidth / 2,
            right: this.cx + spotWidth / 2,
            top: this.top - 8,
            bottom: this.top + spotHeight
        };
    }

    /** Full body hurtbox */
    get bodyHurtbox() {
        return {
            x: this.x + 8,
            y: this.y + 16,
            left: this.x + 8,
            right: this.x + this.width - 8,
            top: this.y + 16,
            bottom: this.bottom
        };
    }

    /** Is the boss currently vulnerable to stomps? */
    get isVulnerable() {
        return this.state === BossState.STUNNED_VULNERABLE || this.state === BossState.SLAM_IMPACT;
    }

    // =========================================================================
    // MAIN UPDATE LOOP
    // =========================================================================
    update(dt, player, level) {
        this.animTime += dt;
        this.stateTimer += dt;
        this.auraPulse += dt * 4;

        // Update Flash & Shake
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.shakeOffsetX = (Math.random() - 0.5) * 8;
            this.shakeOffsetY = (Math.random() - 0.5) * 8;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }

        // Update Projectiles & Shockwaves
        this._updateProjectilesAndShockwaves(dt, level, player);

        // Turn towards player if not leaping or stunned
        if (player && this.state !== BossState.LEAP_AIR && this.state !== BossState.STUNNED_VULNERABLE) {
            this.facing = player.cx < this.cx ? -1 : 1;
        }

        // Update State Machine
        switch (this.state) {
            case BossState.INTRO:
                this._updateIntro(dt, level);
                break;
            case BossState.IDLE:
                this._updateIdle(dt, player, level);
                break;
            case BossState.LEAP_WINDUP:
                this._updateLeapWindup(dt, player, level);
                break;
            case BossState.LEAP_AIR:
                this._updateLeapAir(dt, player, level);
                break;
            case BossState.SLAM_IMPACT:
                this._updateSlamImpact(dt, player, level);
                break;
            case BossState.STUNNED_VULNERABLE:
                this._updateStunned(dt, player, level);
                break;
            case BossState.SHOOT_PROJECTILES:
                this._updateShootProjectiles(dt, player, level);
                break;
            case BossState.SUMMON_MINIONS:
                this._updateSummonMinions(dt, player, level);
                break;
            case BossState.HIT_RECOVERY:
                this._updateHitRecovery(dt, player, level);
                break;
            case BossState.DEFEATED:
                this._updateDefeated(dt, level);
                break;
        }

        // Aura particles when enraged
        if (this.isEnraged && this.state !== BossState.DEFEATED) {
            if (Math.random() < 0.45 && this.particles) {
                this.particles.emitSparkles(
                    this.cx + (Math.random() - 0.5) * this.width,
                    this.cy + (Math.random() - 0.5) * this.height,
                    ['#ff0055', '#ff3300', '#ffaa00'],
                    2
                );
            }
        }
    }

    // =========================================================================
    // STATE MACHINE IMPLEMENTATIONS
    // =========================================================================

    _updateIntro(dt, level) {
        // Drop down dramatically from top
        if (this.y < this.introY) {
            this.y += 380 * dt;
            if (this.y >= this.introY) {
                this.y = this.introY;
                this.camera?.shake(14, 0.4);
                this.audio?.playBossRoar?.();
                this.particles?.emitExplosion(this.cx, this.bottom, 15, ['#ff9900', '#ffffff', '#444444']);
            }
        }

        if (this.stateTimer >= this.introDuration) {
            this._enterState(BossState.IDLE);
        }
    }

    _updateIdle(dt, player, level) {
        const idleLimit = this.isEnraged ? 0.7 : 1.2;

        // Hover bobbing
        this.scaleX = 1.0 + Math.sin(this.animTime * 5) * 0.05;
        this.scaleY = 1.0 - Math.sin(this.animTime * 5) * 0.05;

        if (this.stateTimer >= idleLimit) {
            // Decide next action based on Phase and state
            const r = Math.random();

            if (this.isEnraged) {
                if (r < 0.4) {
                    this._enterState(BossState.SHOOT_PROJECTILES);
                } else if (r < 0.65) {
                    this._enterState(BossState.SUMMON_MINIONS);
                } else {
                    this._enterState(BossState.LEAP_WINDUP, player);
                }
            } else {
                if (this.phase === 2 && r < 0.35) {
                    this._enterState(BossState.SHOOT_PROJECTILES);
                } else {
                    this._enterState(BossState.LEAP_WINDUP, player);
                }
            }
        }
    }

    _updateLeapWindup(dt, player, level) {
        // Crouch squash & charge up
        this.scaleY = Math.max(0.6, 1.0 - this.stateTimer * 0.8);
        this.scaleX = Math.min(1.4, 1.0 + this.stateTimer * 0.6);

        // Windup duration: shorter when enraged
        const windupMax = this.isEnraged ? 0.45 : 0.75;

        if (this.stateTimer >= windupMax) {
            // Target player's current X or a high arena platform
            this.leapTargetX = player ? player.cx : this.cx;
            // Clamp target X within arena bounds
            const arenaW = level ? level.width : 800;
            this.leapTargetX = Math.max(80, Math.min(arenaW - 80, this.leapTargetX));

            // Calculate horizontal velocity needed to reach player
            const jumpDuration = 1.1;
            this.vx = (this.leapTargetX - this.cx) / jumpDuration;
            this.vy = this.isEnraged ? this.jumpForceY * 1.15 : this.jumpForceY;

            this.audio?.playJump?.();
            this.particles?.emitDust(this.cx, this.bottom, 0, 8);
            this._enterState(BossState.LEAP_AIR);
        }
    }

    _updateLeapAir(dt, player, level) {
        // Stretch vertically in air
        this.scaleX = 0.85;
        this.scaleY = 1.25;

        // Apply physics
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Check ground / arena floor landing
        const floorY = (level ? level.height : 600) - 80;
        if (this.bottom >= floorY && this.vy > 0) {
            this.y = floorY - this.height;
            this.vx = 0;
            this.vy = 0;
            this._enterState(BossState.SLAM_IMPACT);
        }
    }

    _updateSlamImpact(dt, player, level) {
        // Impact squash
        this.scaleX = 1.45;
        this.scaleY = 0.55;

        if (this.stateTimer === dt) {
            // First frame of impact
            this.camera?.shake(18, 0.45);
            this.audio?.playShockwave?.();
            this.particles?.emitStompRing(this.cx, this.bottom, 12, 60, '#ff9900');
            this.particles?.emitExplosion(this.cx, this.bottom, 16, ['#ff9900', '#ffd60a', '#ffffff']);

            // Spawn Expanding Ground Shockwaves left and right!
            this.shockwaves.push(
                new GroundShockwave({
                    x: this.cx - 24,
                    y: this.bottom - 28,
                    direction: -1,
                    speed: this.isEnraged ? 320 : 250,
                    color: this.isEnraged ? '#ff0055' : '#ff9900'
                }),
                new GroundShockwave({
                    x: this.cx + 4,
                    y: this.bottom - 28,
                    direction: 1,
                    speed: this.isEnraged ? 320 : 250,
                    color: this.isEnraged ? '#ff0055' : '#ff9900'
                })
            );

            this.slamCount++;
        }

        // Recover or go to Vulnerable Stun
        if (this.stateTimer >= 0.55) {
            if (this.slamCount >= this.slamsBeforeStun) {
                this.slamCount = 0;
                this._enterState(BossState.STUNNED_VULNERABLE);
            } else {
                this._enterState(BossState.IDLE);
            }
        }
    }

    _updateStunned(dt, player, level) {
        // Dizzy wobbling
        this.dizzyAngle += dt * 7;
        this.scaleX = 1.1 + Math.sin(this.dizzyAngle) * 0.08;
        this.scaleY = 0.85 + Math.cos(this.dizzyAngle) * 0.08;

        const stunDuration = this.isEnraged ? 2.8 : 3.8;

        // Particle dizzy stars
        if (Math.random() < 0.25 && this.particles) {
            this.particles.emitSparkles(
                this.cx + Math.cos(this.dizzyAngle) * 28,
                this.top - 16 + Math.sin(this.dizzyAngle) * 8,
                ['#ffd60a', '#ffffff', '#00e5ff'],
                1
            );
        }

        if (this.stateTimer >= stunDuration) {
            this.particles?.emitFloatingText(this.cx, this.top - 20, 'RECOVERED!', '#ffffff', 13);
            this._enterState(BossState.IDLE);
        }
    }

    _updateShootProjectiles(dt, player, level) {
        // Rapid 3-burst fireball attack
        const burstInterval = 0.35;
        const totalBursts = this.isEnraged ? 3 : 2;

        if (this.stateTimer >= 0.3 && this._projectileShots < totalBursts) {
            const timeSinceLast = this.stateTimer - 0.3 - (this._projectileShots * burstInterval);
            if (timeSinceLast >= 0) {
                this._projectileShots++;
                
                // Calculate trajectory towards player
                const targetX = player ? player.cx : this.cx - 200;
                const targetY = player ? player.cy : this.cy;
                const angle = Math.atan2(targetY - (this.cy - 10), targetX - this.cx);
                const speed = this.isEnraged ? 340 : 270;

                this.projectiles.push(
                    new BossProjectile({
                        x: this.cx - 9,
                        y: this.cy - 16,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 60,
                        bounces: 3,
                        color: this.isEnraged ? '#ff0055' : '#ff5500'
                    })
                );

                this.audio?.playHurt?.(); // Fireball launch sound
                this.particles?.emitExplosion(this.cx, this.cy, 6, ['#ff3300', '#ffd60a']);
            }
        }

        if (this.stateTimer >= 1.4) {
            this._enterState(BossState.IDLE);
        }
    }

    _updateSummonMinions(dt, player, level) {
        if (this.stateTimer === dt) {
            this.audio?.playBossRoar?.();
            this.camera?.shake(8, 0.3);
            this.particles?.emitFloatingText(this.cx, this.top - 20, 'MINIONS ASSEMBLE!', '#ff0055', 12);

            // Spawn 1-2 mini baddies falling from ceiling
            const spawnCount = this.hp <= 2 ? 2 : 1;
            const arenaW = level ? level.width : 800;

            for (let i = 0; i < spawnCount; i++) {
                const spawnX = 120 + Math.random() * (arenaW - 240);
                const minion = new PlatformerBaddie({
                    x: spawnX,
                    y: 60,
                    speed: 80,
                    audio: this.audio,
                    particles: this.particles
                });
                this.minions.push(minion);
                this.particles?.emitExplosion(spawnX, 60, 8, ['#ff0055', '#ffffff']);
            }
        }

        if (this.stateTimer >= 1.0) {
            this._enterState(BossState.IDLE);
        }
    }

    _updateHitRecovery(dt, player, level) {
        if (this.stateTimer >= 0.7) {
            if (this.hp <= 0) {
                this._enterState(BossState.DEFEATED);
            } else {
                // Check if enrage triggered
                if (this.hp <= 3 && !this.isEnraged) {
                    this.isEnraged = true;
                    this.phase = 2;
                    this.particles?.emitFloatingText(this.cx, this.top - 24, 'ENRAGED!', '#ff0055', 16);
                    this.hud?.showToast?.('BOSS ENRAGED!', 'Speed and firepower increased!', 2500);
                    this.audio?.playBossRoar?.();
                    this.camera?.shake(16, 0.5);
                }
                this._enterState(BossState.IDLE);
            }
        }
    }

    _updateDefeated(dt, level) {
        // Slow-motion chain explosions
        this.scaleX = 1.0 + Math.sin(this.animTime * 20) * 0.2;
        this.scaleY = 1.0 + Math.cos(this.animTime * 20) * 0.2;
        this.opacity = Math.max(0, 1 - (this.stateTimer / 4.0));

        // Periodic explosion bursts across body
        if (Math.random() < 0.4 && this.particles) {
            const rx = this.cx + (Math.random() - 0.5) * this.width * 1.2;
            const ry = this.cy + (Math.random() - 0.5) * this.height * 1.2;
            this.particles.emitExplosion(rx, ry, 12, ['#ff0055', '#ff9900', '#ffd60a', '#ffffff']);
            this.audio?.playExplosion?.();
            this.camera?.shake(10, 0.2);
        }

        // Fireworks at finale
        if (this.stateTimer >= 2.5 && Math.random() < 0.35 && this.particles) {
            const rx = 100 + Math.random() * ((level ? level.width : 800) - 200);
            const ry = 80 + Math.random() * 250;
            this.particles.emitFireworks?.(rx, ry, 30, '#ffd700');
        }

        if (this.stateTimer >= 4.5 && !this._victoryTriggered) {
            this._victoryTriggered = true;
            this.kill();
            if (this.onDefeated) this.onDefeated();
        }
    }

    _enterState(newState, extra) {
        this.state = newState;
        this.stateTimer = 0;

        if (newState === BossState.SHOOT_PROJECTILES) {
            this._projectileShots = 0;
        }

        // Update HUD
        const phaseLabel = this.isEnraged ? 'PHASE 2 (ENRAGED)' : (this.hp <= 1 ? 'FINAL PHASE' : 'PHASE 1');
        this.hud?.updateBossHp?.(this.hp, phaseLabel);
    }

    _updateProjectilesAndShockwaves(dt, level, player) {
        // Update Boss Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt, level, this.particles);
            if (!p.alive) {
                this.projectiles.splice(i, 1);
            }
        }

        // Update Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.update(dt, level, this.particles);
            if (!sw.alive) {
                this.shockwaves.splice(i, 1);
            }
        }

        // Update Minions
        for (let i = this.minions.length - 1; i >= 0; i--) {
            const m = this.minions[i];
            m.update(dt, level);
            if (!m.alive) {
                this.minions.splice(i, 1);
            }
        }
    }

    // =========================================================================
    // PLAYER INTERACTION & COMBAT RESOLUTION
    // =========================================================================

    /**
     * Called when player collides with the boss.
     * Evaluates whether it is a successful head stomp or player damage.
     * @param {import('./Player.js').Player} player
     * @returns {string} 'STOMP_HIT' | 'PLAYER_DAMAGE' | 'IMMUNE'
     */
    handlePlayerCollision(player) {
        if (!player || player.isDead || this.state === BossState.DEFEATED || this.state === BossState.INTRO) {
            return 'IMMUNE';
        }

        // 1. Check for Weak Spot Head Stomp
        const weakSpot = this.weakSpotBounds;
        const playerBottom = player.bottom;
        const playerFalling = player.vy > 0;

        const hitsWeakSpot = (
            player.right > weakSpot.left &&
            player.left < weakSpot.right &&
            playerBottom >= weakSpot.top - 6 &&
            playerBottom <= weakSpot.bottom + 12 &&
            playerFalling
        );

        if (hitsWeakSpot) {
            if (this.isVulnerable) {
                this.takeStompDamage(player);
                return 'STOMP_HIT';
            } else {
                // If boss is not stunned, stomp bounces off armor without damage
                player.bounceOnEnemy();
                this.particles?.emitFloatingText(this.cx, this.top - 18, 'DEFLECTED!', '#aaaaaa', 12);
                this.audio?.playHurt?.();
                return 'IMMUNE';
            }
        }

        // 2. Check Body Collision -> Damages Player
        const body = this.bodyHurtbox;
        const hitsBody = (
            player.right > body.left &&
            player.left < body.right &&
            player.bottom > body.top &&
            player.top < body.bottom
        );

        if (hitsBody) {
            if (player.shieldTimer > 0) {
                // Player has active invincibility shield: deflects boss
                this.particles?.emitExplosion(player.cx, player.cy, 8, ['#00e5ff', '#ffffff']);
                return 'IMMUNE';
            }

            // Normal damage to player
            player.takeDamage(this);
            return 'PLAYER_DAMAGE';
        }

        return 'IMMUNE';
    }

    /**
     * Apply 1 HP damage to boss from stomp.
     * @param {import('./Player.js').Player} player
     */
    takeStompDamage(player) {
        if (this.state === BossState.HIT_RECOVERY || this.state === BossState.DEFEATED) return;

        this.hp = Math.max(0, this.hp - 1);
        this.flashTimer = 0.35;

        // Bounce player upward
        player.bounceOnEnemy();
        player.addScore(1000 * player.comboMultiplier);

        // Visual & Audio juice
        this.camera?.shake(14, 0.4);
        this.audio?.playBossRoar?.();
        this.audio?.playStomp?.();
        this.particles?.emitStompRing(this.cx, this.top, 15, 65, '#ffd60a');
        this.particles?.emitExplosion(this.cx, this.top, 22, ['#ff0055', '#ffd60a', '#ffffff', '#ff9900']);
        this.particles?.emitFloatingText(this.cx, this.top - 28, `-1 HP! (${this.hp}/${this.maxHp})`, '#ff0055', 15);

        // Update HUD Boss Bar
        const phaseLabel = this.isEnraged ? 'PHASE 2 (ENRAGED)' : (this.hp <= 1 ? 'FINAL PHASE' : 'PHASE 1');
        this.hud?.updateBossHp?.(this.hp, phaseLabel);

        this._enterState(BossState.HIT_RECOVERY);
    }

    // =========================================================================
    // RENDERING & CUSTOM SPRITE PROCEDURAL DRAWING
    // =========================================================================
    draw(ctx) {
        // Draw Shockwaves
        for (const sw of this.shockwaves) {
            sw.draw(ctx);
        }

        // Draw Projectiles
        for (const p of this.projectiles) {
            p.draw(ctx);
        }

        // Draw Minions
        for (const m of this.minions) {
            m.draw(ctx);
        }

        if (!this.visible || !this.alive) return;

        ctx.save();
        ctx.translate(this.cx + this.shakeOffsetX, this.cy + this.shakeOffsetY);
        ctx.scale(this.scaleX * this.facing, this.scaleY);
        ctx.globalAlpha = this.opacity;

        // 1. Enraged Fiery Aura Glow
        if (this.isEnraged && this.state !== BossState.DEFEATED) {
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 24 + Math.sin(this.auraPulse) * 8;

            const auraGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, this.width * 0.85);
            auraGrad.addColorStop(0, 'rgba(255, 0, 85, 0.45)');
            auraGrad.addColorStop(0.7, 'rgba(255, 100, 0, 0.2)');
            auraGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.85, 0, Math.PI * 2);
            ctx.fill();
        }

        // White Flash on Damage
        const isFlashing = this.flashTimer > 0 && Math.floor(this.flashTimer * 30) % 2 === 0;

        // 2. Boss Body Geometry (Pixel-Mecha Demon Design)
        const bodyW = this.width;
        const bodyH = this.height;

        // Main Torso Shell
        ctx.fillStyle = isFlashing ? '#ffffff' : (this.isEnraged ? '#3a0ca3' : '#1b263b');
        ctx.strokeStyle = isFlashing ? '#ffffff' : (this.isEnraged ? '#ff0055' : '#00e5ff');
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.roundRect(-bodyW / 2 + 6, -bodyH / 2 + 10, bodyW - 12, bodyH - 16, 12);
        ctx.fill();
        ctx.stroke();

        // Armored Shoulder Plates
        ctx.fillStyle = isFlashing ? '#ffffff' : (this.isEnraged ? '#7209b7' : '#415a77');
        ctx.fillRect(-bodyW / 2, -bodyH / 2 + 8, 12, 22);
        ctx.fillRect(bodyW / 2 - 12, -bodyH / 2 + 8, 12, 22);

        // Golden Horns / Crown Spikes
        ctx.fillStyle = isFlashing ? '#ffffff' : '#ffb703';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 8;

        // Left Horn
        ctx.beginPath();
        ctx.moveTo(-bodyW / 4, -bodyH / 2 + 10);
        ctx.lineTo(-bodyW / 2 + 4, -bodyH / 2 - 14);
        ctx.lineTo(-bodyW / 4 + 8, -bodyH / 2 + 10);
        ctx.closePath();
        ctx.fill();

        // Right Horn
        ctx.beginPath();
        ctx.moveTo(bodyW / 4 - 8, -bodyH / 2 + 10);
        ctx.lineTo(bodyW / 2 - 4, -bodyH / 2 - 14);
        ctx.lineTo(bodyW / 4, -bodyH / 2 + 10);
        ctx.closePath();
        ctx.fill();

        // Center Weak-Spot Gem on Head
        const gemColor = this.isVulnerable ? '#00f5d4' : (this.isEnraged ? '#ff0055' : '#ffb703');
        ctx.fillStyle = isFlashing ? '#ffffff' : gemColor;
        ctx.shadowColor = gemColor;
        ctx.shadowBlur = this.isVulnerable ? 16 : 8;

        ctx.beginPath();
        ctx.arc(0, -bodyH / 2 + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Core Reactor in Chest
        const reactorColor = this.isEnraged ? '#ff0055' : '#00e5ff';
        ctx.fillStyle = isFlashing ? '#ffffff' : reactorColor;
        ctx.shadowColor = reactorColor;
        ctx.shadowBlur = 12 + Math.sin(this.animTime * 6) * 4;

        ctx.beginPath();
        ctx.arc(0, 10, 12, 0, Math.PI * 2);
        ctx.fill();

        // Expressive Eyes & Brow
        ctx.shadowBlur = 0;
        if (this.state === BossState.STUNNED_VULNERABLE) {
            // Dizzy Spiral Eyes
            ctx.strokeStyle = '#ffd60a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-14, -8, 6, 0, Math.PI * 2);
            ctx.moveTo(8, -8);
            ctx.arc(14, -8, 6, 0, Math.PI * 2);
            ctx.stroke();

            // Dizzy X lines inside
            ctx.beginPath();
            ctx.moveTo(-18, -12); ctx.lineTo(-10, -4);
            ctx.moveTo(-10, -12); ctx.lineTo(-18, -4);
            ctx.moveTo(10, -12); ctx.lineTo(18, -4);
            ctx.moveTo(18, -12); ctx.lineTo(10, -4);
            ctx.stroke();
        } else {
            // Angry Slanted Eyes
            ctx.fillStyle = isFlashing ? '#ffffff' : (this.isEnraged ? '#ff0055' : '#ffd60a');
            ctx.beginPath();
            // Left Eye
            ctx.moveTo(-22, -14);
            ctx.lineTo(-8, -8);
            ctx.lineTo(-20, -4);
            ctx.closePath();
            ctx.fill();

            // Right Eye
            ctx.beginPath();
            ctx.moveTo(22, -14);
            ctx.lineTo(8, -8);
            ctx.lineTo(20, -4);
            ctx.closePath();
            ctx.fill();
        }

        // Heavy Mechanical Claws / Stompers
        ctx.fillStyle = isFlashing ? '#ffffff' : '#2b2d42';
        ctx.fillRect(-bodyW / 2 + 8, bodyH / 2 - 10, 18, 12);
        ctx.fillRect(bodyW / 2 - 26, bodyH / 2 - 10, 18, 12);

        ctx.restore();

        // 3. Stunned Dizzy Stars Rotating Overhead
        if (this.state === BossState.STUNNED_VULNERABLE) {
            ctx.save();
            ctx.translate(this.cx, this.top - 16);

            for (let i = 0; i < 3; i++) {
                const angle = this.dizzyAngle + (i * (Math.PI * 2 / 3));
                const starX = Math.cos(angle) * 26;
                const starY = Math.sin(angle) * 8;

                ctx.fillStyle = '#ffd60a';
                ctx.shadowColor = '#ffd60a';
                ctx.shadowBlur = 10;

                ctx.beginPath();
                ctx.arc(starX, starY, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // "STUNNED! STOMP NOW!" indicator
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00f5d4';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText('▼ STOMP HEAD! ▼', 0, -18);

            ctx.restore();
        }
    }
}

export { MegaBaddieBoss as Boss };
export default MegaBaddieBoss;
