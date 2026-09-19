/**
 * Baddie.js - Enemy Entity System for The Game Enhanced Edition
 * Features:
 * - PlatformerPatrollingBaddie: cliff detection, wall bounce, head stomp vulnerability, squish animation.
 * - MazeChasingBaddie: grid track patrol, line-of-sight raycast chase AI, alert states.
 * - Variety archetypes: FlyingBaddie, SpikeBaddie.
 */

import { Entity } from './Entity.js';

export class Baddie extends Entity {
    /**
     * @param {Object} options
     * @param {string} [options.baddieType='platformer'] - 'platformer' | 'maze' | 'flying'
     */
    constructor(options = {}) {
        super({
            x: options.x ?? 0,
            y: options.y ?? 0,
            width: options.width ?? 24,
            height: options.height ?? 24,
            tag: 'baddie',
            layer: 5
        });

        this.baddieType = options.baddieType ?? 'platformer';
        this.state = 'PATROL'; // 'PATROL' | 'ALERT' | 'CHASE' | 'SQUISHED' | 'DEFEATED'
        this.stateTimer = 0;
        this.scoreValue = options.scoreValue ?? 200;

        // Visuals
        this.facing = options.facing ?? -1;
        this.animTime = Math.random() * 10;
        this.squishTimer = 0;
        this.squishDuration = 0.4;

        // Custom references
        this.audio = options.audio ?? null;
        this.particles = options.particles ?? null;
    }

    /** Called when player jumps/stomps onto the head of this enemy */
    takeStomp(player) {
        if (this.state === 'SQUISHED' || this.state === 'DEFEATED') return false;

        this.state = 'SQUISHED';
        this.squishTimer = this.squishDuration;
        this.vx = 0;
        this.vy = 0;
        this.collidable = false;

        // Squash deformation
        this.scaleY = 0.25;
        this.scaleX = 1.45;

        // Bounce the player
        if (player && typeof player.bounceOnEnemy === 'function') {
            player.bounceOnEnemy();
        }

        this.particles?.createStompBurst?.(this.cx, this.cy);
        this.audio?.playStomp?.();

        return true;
    }

    /** Defeated instantly (e.g. by player shield powerup or projectile) */
    takeKnockout(direction = 1) {
        if (this.state === 'DEFEATED') return;

        this.state = 'DEFEATED';
        this.collidable = false;
        this.vx = direction * 150;
        this.vy = -300; // Launch into air
        this.rotation = 0.2;

        this.particles?.createExplosion?.(this.cx, this.cy);
        this.audio?.playEnemyHit?.();
    }
}

// =========================================================================
// 1. Platformer Patrolling Baddie
// =========================================================================
export class PlatformerBaddie extends Baddie {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
        super({
            ...options,
            baddieType: 'platformer',
            width: options.width ?? 24,
            height: options.height ?? 24
        });

        this.walkSpeed = options.speed ?? 70;
        this.facing = options.facing ?? (Math.random() > 0.5 ? 1 : -1);
        this.vx = this.facing * this.walkSpeed;
        this.gravity = 1100;
        this.avoidsEdges = options.avoidsEdges ?? true;
        this.isGrounded = false;
    }

    update(dt, level, player) {
        if (!this.alive) return;

        this.animTime += dt;

        // Handle squished defeat countdown
        if (this.state === 'SQUISHED') {
            this.squishTimer -= dt;
            this.opacity = Math.max(0, this.squishTimer / this.squishDuration);
            if (this.squishTimer <= 0) {
                this.kill();
            }
            return;
        }

        // Handle defeated launch arc
        if (this.state === 'DEFEATED') {
            this.vy += this.gravity * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.rotation += 8 * dt;
            if (this.y > (level?.height || 700) + 100) {
                this.kill();
            }
            return;
        }

        // Apply patrol movement
        this.vx = this.facing * this.walkSpeed;

        // Gravity
        if (!this.isGrounded) {
            this.vy += this.gravity * dt;
        }

        // Move horizontally & vertically with level collision resolution
        this.moveAndCollidePlatformer(dt, level);

        // Check platform cliff edge ahead
        if (this.isGrounded && this.avoidsEdges && level && level.isCliffAhead) {
            if (level.isCliffAhead(this, this.facing)) {
                this.turnAround();
            }
        }

        // Check interaction with Player
        if (player && player.alive && !player.isDead) {
            this.checkPlayerInteraction(player);
        }
    }

    turnAround() {
        this.facing = -this.facing;
        this.vx = this.facing * this.walkSpeed;
    }

    moveAndCollidePlatformer(dt, level) {
        if (!level || !level.resolveCollisionX) {
            // Basic fallback movement
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            return;
        }

        // Horizontal step
        this.x += this.vx * dt;
        const hitWall = level.resolveCollisionX(this);
        if (hitWall) {
            this.turnAround();
        }

        // Vertical step
        this.y += this.vy * dt;
        this.isGrounded = false;
        level.resolveCollisionY(this);
    }

    checkPlayerInteraction(player) {
        if (!this.collidable || this.state === 'SQUISHED' || this.state === 'DEFEATED') return;

        if (this.intersects(player, 2)) {
            // If player has active invincibility shield -> baddie is destroyed!
            if (player.shieldTimer > 0) {
                this.takeKnockout(player.facing);
                player.addScore(this.scoreValue);
                return;
            }

            // Check if player is stomping from above:
            // Condition: player was above baddie's center, falling downwards (vy > 0)
            const playerBottom = player.bottom;
            const baddieTop = this.top + 8;

            if (player.vy > 0 && playerBottom <= baddieTop + player.vy * 0.05 + 6) {
                this.takeStomp(player);
            } else {
                // Horizontal contact: hurt player
                player.takeDamage(this);
            }
        }
    }

    draw(ctx) {
        const hw = this.width / 2;
        const hh = this.height / 2;
        const walkCycle = Math.sin(this.animTime * 12);
        const squish = Math.abs(Math.sin(this.animTime * 12)) * 2;

        ctx.save();
        ctx.scale(this.facing, 1);

        if (this.state === 'SQUISHED') {
            // Flattened squish graphic
            ctx.fillStyle = '#6a040f';
            ctx.beginPath();
            ctx.ellipse(0, hh - 3, hw * 1.3, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, hh - 1, hw * 0.8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. Monster Body (Deep Crimson / Purple Slime-Goblin)
        const grad = ctx.createLinearGradient(0, -hh, 0, hh);
        grad.addColorStop(0, '#9d0208');
        grad.addColorStop(0.7, '#6a040f');
        grad.addColorStop(1, '#370617');

        ctx.fillStyle = grad;
        ctx.beginPath();
        // Slime dome shape
        ctx.moveTo(-hw + 2, hh);
        ctx.lineTo(-hw, -hh + 8 + squish);
        ctx.quadraticCurveTo(-hw, -hh + squish, 0, -hh + squish);
        ctx.quadraticCurveTo(hw, -hh + squish, hw, -hh + 8 + squish);
        ctx.lineTo(hw - 2, hh);
        ctx.closePath();
        ctx.fill();

        // Little Horns / Spikes
        ctx.fillStyle = '#ffba08';
        ctx.beginPath();
        ctx.moveTo(-hw + 4, -hh + squish);
        ctx.lineTo(-hw + 1, -hh - 4 + squish);
        ctx.lineTo(-hw + 7, -hh + squish);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(hw - 4, -hh + squish);
        ctx.lineTo(hw - 1, -hh - 4 + squish);
        ctx.lineTo(hw - 7, -hh + squish);
        ctx.fill();

        // 2. Menacing Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(3, -2 + squish, 4, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Red Pupil looking forward
        ctx.fillStyle = '#d90429';
        ctx.beginPath();
        ctx.arc(4.5, -2 + squish, 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Spiky Teeth
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 5 + squish);
        ctx.lineTo(3, 8 + squish);
        ctx.lineTo(6, 5 + squish);
        ctx.fill();

        // 4. Little Animated Walking Feet
        ctx.fillStyle = '#370617';
        ctx.fillRect(-hw + 2, hh - 3 + walkCycle * 2, 5, 4);
        ctx.fillRect(hw - 7, hh - 3 - walkCycle * 2, 5, 4);

        ctx.restore();
    }
}

// =========================================================================
// 2. Top-Down Maze Chasing Baddie
// =========================================================================
export class MazeBaddie extends Baddie {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
        super({
            ...options,
            baddieType: 'maze',
            width: options.width ?? 22,
            height: options.height ?? 22
        });

        this.patrolSpeed = options.speed ?? 85;
        this.chaseSpeed = options.chaseSpeed ?? 135;
        this.gridSize = 24;

        this.direction = { x: 1, y: 0 };
        this.visionRange = options.visionRange ?? 220; // Raycast detection range
        this.alertTimer = 0;
        this.colorTheme = options.colorTheme ?? '#e63946'; // Red ghost / Drone
    }

    update(dt, level, player) {
        if (!this.alive) return;

        this.animTime += dt;

        if (this.state === 'DEFEATED') {
            this.scaleX -= dt * 2;
            this.scaleY -= dt * 2;
            this.opacity -= dt * 2;
            if (this.opacity <= 0) this.kill();
            return;
        }

        // 1. AI Decision Tree: Line of sight check to player
        if (player && player.alive && !player.isDead) {
            this.evaluatePlayerDetection(level, player, dt);
        }

        // 2. Navigation & Movement
        const currentSpeed = this.state === 'CHASE' ? this.chaseSpeed : this.patrolSpeed;
        this.vx = this.direction.x * currentSpeed;
        this.vy = this.direction.y * currentSpeed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Maze collision resolution & corridor turning
        if (level && level.handleMazeBaddieMovement) {
            level.handleMazeBaddieMovement(this, dt);
        }

        // 3. Collision with player
        if (player && player.alive && !player.isDead && this.intersects(player, 2)) {
            if (player.shieldTimer > 0) {
                this.takeKnockout(this.direction.x || 1);
                player.addScore(this.scoreValue * 2);
            } else {
                player.takeDamage(this);
            }
        }
    }

    evaluatePlayerDetection(level, player, dt) {
        const dist = this.distanceTo(player);

        // Check direct raycast / unobstructed line of sight in cardinal directions
        const dx = player.cx - this.cx;
        const dy = player.cy - this.cy;
        const isSameCol = Math.abs(dx) < 14;
        const isSameRow = Math.abs(dy) < 14;

        let hasLineOfSight = false;
        if (dist <= this.visionRange && (isSameCol || isSameRow)) {
            if (level && level.hasLineOfSight) {
                hasLineOfSight = level.hasLineOfSight(this.cx, this.cy, player.cx, player.cy);
            } else {
                hasLineOfSight = true; // Fallback
            }
        }

        if (hasLineOfSight) {
            if (this.state !== 'CHASE') {
                this.state = 'CHASE';
                this.particles?.createAlertIcon?.(this.cx, this.top - 10);
                this.audio?.playAlert?.();
            }
            this.alertTimer = 2.0; // Stay alerted for 2s after breaking line of sight

            // Steer towards player along the clear corridor axis
            if (isSameCol) {
                this.direction = { x: 0, y: dy > 0 ? 1 : -1 };
            } else if (isSameRow) {
                this.direction = { x: dx > 0 ? 1 : -1, y: 0 };
            }
        } else {
            if (this.alertTimer > 0) {
                this.alertTimer -= dt;
            } else if (this.state === 'CHASE') {
                this.state = 'PATROL';
            }
        }
    }

    draw(ctx) {
        const r = this.width / 2;
        const floatY = Math.sin(this.animTime * 8) * 2;
        const isChasing = this.state === 'CHASE';

        ctx.save();
        ctx.translate(0, floatY);

        // Glow Aura
        ctx.shadowColor = isChasing ? '#ff0055' : this.colorTheme;
        ctx.shadowBlur = isChasing ? 14 : 6;

        // 1. Ghost Dome Body
        const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, r);
        if (isChasing) {
            grad.addColorStop(0, '#ff5964');
            grad.addColorStop(0.8, '#d90429');
            grad.addColorStop(1, '#7a0015');
        } else {
            grad.addColorStop(0, '#a2d2ff');
            grad.addColorStop(0.7, '#3a86ff');
            grad.addColorStop(1, '#023e8a');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -2, r, Math.PI, 0, false);
        ctx.lineTo(r, r - 2);

        // Wavy skirt tentacles
        const wave = Math.sin(this.animTime * 14) * 2;
        ctx.quadraticCurveTo(r * 0.5, r + wave, 0, r - 2);
        ctx.quadraticCurveTo(-r * 0.5, r - wave, -r, r - 2);
        ctx.closePath();
        ctx.fill();

        // 2. Eyes looking in current direction
        ctx.fillStyle = '#ffffff';
        const eyeOffset = 3.5;
        const lookX = this.direction.x * 2.5;
        const lookY = this.direction.y * 2.5;

        // Left Eye
        ctx.beginPath();
        ctx.arc(-eyeOffset + lookX * 0.5, -3 + lookY * 0.5, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Right Eye
        ctx.beginPath();
        ctx.arc(eyeOffset + lookX * 0.5, -3 + lookY * 0.5, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = isChasing ? '#ff0000' : '#03045e';
        ctx.beginPath();
        ctx.arc(-eyeOffset + lookX, -3 + lookY, 1.8, 0, Math.PI * 2);
        ctx.arc(eyeOffset + lookX, -3 + lookY, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Alert "!" bubble when in chase mode
        if (isChasing) {
            ctx.fillStyle = '#ffbe0b';
            ctx.font = 'bold 12px "Press Start 2P", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', 0, -r - 6);
        }

        ctx.restore();
    }
}

export default {
    Baddie,
    PlatformerBaddie,
    MazeBaddie
};
