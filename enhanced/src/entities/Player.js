/**
 * Player.js - Versatile Hero Entity for The Game Enhanced Edition
 * Supports both high-precision Platformer mode (Level 1 & Level 3 Boss)
 * and snappy Top-Down Maze mode (Level 2).
 * 
 * Features:
 * - Coyote time & Jump buffering
 * - Variable jump height
 * - Enemy head stomp mechanic with bounce & score multipliers
 * - Squash & stretch animation dynamics
 * - Powerups: Invincibility Shield, Speed Boost, Extra Life
 * - Grid alignment & tile turning assist for Maze mode
 * - Checkpoint tracking & graceful respawn system
 * - After-image speed trails & glowing shield FX
 */

import { Entity } from './Entity.js';

export class Player extends Entity {
    /**
     * @param {Object} options
     * @param {string} [options.mode='platformer'] - 'platformer' or 'maze'
     * @param {number} [options.x=50]
     * @param {number} [options.y=300]
     */
    constructor(options = {}) {
        const mode = options.mode || 'platformer';
        const defaultW = mode === 'platformer' ? 24 : 22;
        const defaultH = mode === 'platformer' ? 44 : 22;

        super({
            x: options.x ?? 50,
            y: options.y ?? 300,
            width: options.width ?? defaultW,
            height: options.height ?? defaultH,
            tag: 'player',
            layer: 10
        });

        this.mode = mode; // 'platformer' | 'maze'

        // ==========================================
        // Platformer Physics Constants
        // ==========================================
        this.runMaxSpeed = 290;
        this.accelGround = 1900;
        this.decelGround = 2400;
        this.accelAir = 1300;
        this.decelAir = 400;
        this.gravity = 1250;
        this.maxFallSpeed = 680;
        this.jumpInitialForce = -530;
        this.jumpCutDamping = 0.45; // Variable jump: cutting upward velocity when released
        this.stompBounceForce = -420;

        // ==========================================
        // Maze Mode Physics Constants
        // ==========================================
        this.mazeBaseSpeed = 160;
        this.mazeSpeed = 160;
        this.gridSize = 24;
        this.currentDir = { x: 0, y: 0 };
        this.desiredDir = { x: 0, y: 0 };
        this.turnBufferWindow = 0.18; // Seconds of input buffer for next turn
        this.turnBufferTimer = 0;

        // ==========================================
        // Jump Assist Mechanics
        // ==========================================
        this.coyoteTimeMax = 0.12; // ~7 frames at 60fps
        this.coyoteTimer = 0;
        this.jumpBufferMax = 0.14; // ~8 frames at 60fps
        this.jumpBufferTimer = 0;
        this.isJumping = false;
        this.wasGrounded = false;

        // ==========================================
        // Powerups & Active Modifiers
        // ==========================================
        this.shieldDuration = 8.0;
        this.shieldTimer = 0;
        this.speedDuration = 10.0;
        this.speedTimer = 0;
        this.speedMultiplier = 1.55;

        // Ghost trail after-images for speed boost
        this.ghostTrails = [];
        this.ghostSpawnInterval = 0.04;
        this.ghostSpawnTimer = 0;

        // ==========================================
        // Lives, Score & Progression
        // ==========================================
        this.lives = options.lives ?? 3;
        this.score = options.score ?? 0;
        this.coinsCollected = 0;
        this.keysCollected = 0;
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.comboDuration = 3.5;

        // Checkpoint & Respawn
        this.respawnX = this.x;
        this.respawnY = this.y;
        this.lastCheckpointId = null;
        this.isDead = false;
        this.respawnTimer = 0;
        this.respawnDelay = 1.2;

        // ==========================================
        // Animation & Visual Polish
        // ==========================================
        this.facing = 1; // 1 = right, -1 = left, (in maze: 0=up, 1=right, 2=down, 3=left)
        this.mazeDirection = 1; // 0=Up, 1=Right, 2=Down, 3=Left
        this.animTime = 0;
        this.walkCycleFrame = 0;
        
        // Squash & Stretch Spring
        this.scaleX = 1;
        this.scaleY = 1;
        this.targetScaleX = 1;
        this.targetScaleY = 1;
        this.springStiffness = 240;
        this.springDamping = 16;
        this.scaleVelX = 0;
        this.scaleVelY = 0;

        // Visual Assets
        this.spriteSheet = options.spriteSheet ?? null;
        this.spritePlatformer = options.spritePlatformer ?? null;
        this.spriteMaze = options.spriteMaze ?? null;

        // Audio & Particle references
        this.audio = options.audio ?? null;
        this.particles = options.particles ?? null;
    }

    /** Set or change gameplay mode */
    setMode(mode) {
        this.mode = mode;
        if (mode === 'platformer') {
            this.width = 24;
            this.height = 44;
            this.vx = 0;
            this.vy = 0;
        } else if (mode === 'maze') {
            this.width = 22;
            this.height = 22;
            this.vx = 0;
            this.vy = 0;
            this.currentDir = { x: 0, y: 0 };
            this.desiredDir = { x: 0, y: 0 };
        }
    }

    /** Set new checkpoint respawn position */
    setCheckpoint(x, y, id = null) {
        this.respawnX = x;
        this.respawnY = y;
        this.lastCheckpointId = id;
    }

    // ==========================================
    // Update Loop
    // ==========================================
    update(dt, input, level) {
        if (!this.alive) return;

        // Handle death state
        if (this.isDead) {
            this.updateDeathState(dt, level);
            return;
        }

        // Update active powerup timers
        this.updatePowerups(dt);

        // Update combo timer
        this.updateCombo(dt);

        // Squash & Stretch physics simulation
        this.updateSquashStretch(dt);

        // Update Ghost trails
        this.updateGhostTrails(dt);

        // Invulnerability flicker timer
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= dt;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
                this.invulnerableTimer = 0;
            }
        }

        // Branch physics based on mode
        if (this.mode === 'platformer') {
            this.updatePlatformer(dt, input, level);
        } else {
            this.updateMaze(dt, input, level);
        }

        // Update animation clocks
        this.animTime += dt;
    }

    // ==========================================
    // Powerup Timers & FX
    // ==========================================
    updatePowerups(dt) {
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shieldTimer = 0;
            }
        }

        if (this.speedTimer > 0) {
            this.speedTimer -= dt;
            if (this.speedTimer <= 0) {
                this.speedTimer = 0;
            }
        }
    }

    updateCombo(dt) {
        if (this.comboCount > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                this.comboMultiplier = 1;
                this.comboTimer = 0;
            }
        }
    }

    updateGhostTrails(dt) {
        // Remove expired trails
        for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
            this.ghostTrails[i].alpha -= dt * 3.5;
            if (this.ghostTrails[i].alpha <= 0) {
                this.ghostTrails.splice(i, 1);
            }
        }

        // Spawn new ghost trails if speed boost is active and moving
        if (this.speedTimer > 0 && (Math.abs(this.vx) > 30 || Math.abs(this.vy) > 30)) {
            this.ghostSpawnTimer += dt;
            if (this.ghostSpawnTimer >= this.ghostSpawnInterval) {
                this.ghostSpawnTimer = 0;
                this.ghostTrails.push({
                    x: this.cx,
                    y: this.cy,
                    width: this.width,
                    height: this.height,
                    facing: this.facing,
                    direction: this.mazeDirection,
                    alpha: 0.65,
                    scaleX: this.scaleX,
                    scaleY: this.scaleY,
                    mode: this.mode
                });
            }
        }
    }

    // ==========================================
    // Squash & Stretch Spring Model
    // ==========================================
    triggerSquashStretch(sx, sy) {
        this.scaleX = sx;
        this.scaleY = sy;
    }

    updateSquashStretch(dt) {
        // Hooke's Law Spring: F = -k*(x - target) - c*v
        const forceX = -this.springStiffness * (this.scaleX - 1) - this.springDamping * this.scaleVelX;
        const forceY = -this.springStiffness * (this.scaleY - 1) - this.springDamping * this.scaleVelY;

        this.scaleVelX += forceX * dt;
        this.scaleVelY += forceY * dt;

        this.scaleX += this.scaleVelX * dt;
        this.scaleY += this.scaleVelY * dt;

        // Clamp to avoid extreme distortion
        this.scaleX = Math.max(0.4, Math.min(1.8, this.scaleX));
        this.scaleY = Math.max(0.4, Math.min(1.8, this.scaleY));
    }

    // ==========================================
    // Platformer Mode Logic
    // ==========================================
    updatePlatformer(dt, input, level) {
        const moveLeft = input?.isDown('left') || input?.isDown('KeyA') || input?.isDown('ArrowLeft');
        const moveRight = input?.isDown('right') || input?.isDown('KeyD') || input?.isDown('ArrowRight');
        const jumpPressed = input?.isPressed('jump') || input?.isPressed('Space') || input?.isPressed('KeyW') || input?.isPressed('ArrowUp');
        const jumpHeld = input?.isDown('jump') || input?.isDown('Space') || input?.isDown('KeyW') || input?.isDown('ArrowUp');

        // Speed calculation
        let maxSpeed = this.runMaxSpeed;
        if (this.speedTimer > 0) {
            maxSpeed *= this.speedMultiplier;
        }

        // Horizontal Acceleration / Deceleration
        let targetVx = 0;
        if (moveLeft && !moveRight) {
            targetVx = -maxSpeed;
            this.facing = -1;
        } else if (moveRight && !moveLeft) {
            targetVx = maxSpeed;
            this.facing = 1;
        }

        const accel = this.isGrounded ? this.accelGround : this.accelAir;
        const decel = this.isGrounded ? this.decelGround : this.decelAir;

        if (targetVx !== 0) {
            if (this.vx * targetVx < 0) {
                // Changing direction: apply responsive turning decel
                this.vx = this.approach(this.vx, 0, decel * 1.5 * dt);
            }
            this.vx = this.approach(this.vx, targetVx, accel * dt);
        } else {
            this.vx = this.approach(this.vx, 0, decel * dt);
        }

        // Coyote Time tracking
        if (this.isGrounded) {
            this.coyoteTimer = this.coyoteTimeMax;
            this.isJumping = false;
        } else {
            this.coyoteTimer -= dt;
        }

        // Jump Buffering
        if (jumpPressed) {
            this.jumpBufferTimer = this.jumpBufferMax;
        } else if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer -= dt;
        }

        // Execute Jump if buffer and coyote window match
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.isJumping) {
            this.executeJump();
        }

        // Variable Jump Height: cut jump short if button released early
        if (this.isJumping && !jumpHeld && this.vy < -60) {
            this.vy *= this.jumpCutDamping;
            this.isJumping = false; // Prevent cutting repeatedly
        }

        // Apply Gravity
        if (!this.isGrounded) {
            this.vy += this.gravity * dt;
            if (this.vy > this.maxFallSpeed) {
                this.vy = this.maxFallSpeed;
            }
        }

        // Move and resolve collisions with platforms/tilemap
        this.moveAndCollidePlatformer(dt, level);

        // Detect landing event for squash & stretch and particle effects
        if (!this.wasGrounded && this.isGrounded) {
            this.triggerSquashStretch(1.35, 0.75); // Landing squash
            this.particles?.createLandingDust?.(this.cx, this.bottom);
            this.audio?.playLand?.();
        }

        this.wasGrounded = this.isGrounded;

        // Pit death check
        if (level && this.y > (level.height || 640) + 80) {
            this.die('pit');
        }
    }

    executeJump() {
        this.vy = this.jumpInitialForce;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.isJumping = true;

        // Jump Stretch
        this.triggerSquashStretch(0.75, 1.35);

        // Jump effects
        this.particles?.createJumpSparks?.(this.cx, this.bottom);
        this.audio?.playJump?.();
    }

    /** Bounce jump off a stomped baddie */
    bounceOnEnemy() {
        this.vy = this.stompBounceForce;
        this.isGrounded = false;
        this.isJumping = true;
        this.coyoteTimer = 0;
        this.triggerSquashStretch(0.8, 1.3);

        // Combo system
        this.comboCount++;
        this.comboMultiplier = Math.min(5, 1 + (this.comboCount - 1) * 0.5);
        this.comboTimer = this.comboDuration;

        const stompScore = Math.round(200 * this.comboMultiplier);
        this.addScore(stompScore);

        this.particles?.createStompBurst?.(this.cx, this.bottom + 8);
        this.audio?.playStomp?.();
    }

    /**
     * Resolves movement and solid tile/platform collisions in 2 axes
     */
    moveAndCollidePlatformer(dt, level) {
        if (!level || !level.resolveCollisionX) {
            // Standalone fallback
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            if (this.y >= 500) {
                this.y = 500;
                this.vy = 0;
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
            }
            return;
        }

        // Horizontal Step
        this.x += this.vx * dt;
        level.resolveCollisionX(this);

        // Vertical Step
        this.y += this.vy * dt;
        this.isGrounded = false;
        level.resolveCollisionY(this);
    }

    // ==========================================
    // Top-Down Maze Mode Logic
    // ==========================================
    updateMaze(dt, input, level) {
        const up = input?.isDown('up') || input?.isDown('KeyW') || input?.isDown('ArrowUp');
        const down = input?.isDown('down') || input?.isDown('KeyS') || input?.isDown('ArrowDown');
        const left = input?.isDown('left') || input?.isDown('KeyA') || input?.isDown('ArrowLeft');
        const right = input?.isDown('right') || input?.isDown('KeyD') || input?.isDown('ArrowRight');

        // Parse desired directional intent
        if (up && !down) {
            this.desiredDir = { x: 0, y: -1 };
            this.turnBufferTimer = this.turnBufferWindow;
        } else if (down && !up) {
            this.desiredDir = { x: 0, y: 1 };
            this.turnBufferTimer = this.turnBufferWindow;
        } else if (left && !right) {
            this.desiredDir = { x: -1, y: 0 };
            this.turnBufferTimer = this.turnBufferWindow;
        } else if (right && !left) {
            this.desiredDir = { x: 1, y: 0 };
            this.turnBufferTimer = this.turnBufferWindow;
        }

        if (this.turnBufferTimer > 0) {
            this.turnBufferTimer -= dt;
        } else {
            this.desiredDir = { x: 0, y: 0 };
        }

        let speed = this.mazeBaseSpeed;
        if (this.speedTimer > 0) {
            speed *= this.speedMultiplier;
        }

        // Attempt corner turning assist & tile snapping
        this.handleMazeTurningAssist(level, speed, dt);

        // Apply velocity
        this.vx = this.currentDir.x * speed;
        this.vy = this.currentDir.y * speed;

        // Move entity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Maze collision resolution
        if (level && level.resolveMazeCollision) {
            level.resolveMazeCollision(this);
        }

        // Update direction orientation for rendering
        if (this.currentDir.y < 0) this.mazeDirection = 0; // Up
        else if (this.currentDir.x > 0) this.mazeDirection = 1; // Right
        else if (this.currentDir.y > 0) this.mazeDirection = 2; // Down
        else if (this.currentDir.x < 0) this.mazeDirection = 3; // Left
    }

    /**
     * Tile turning assist ensures the player doesn't get stuck on corridor corners
     */
    handleMazeTurningAssist(level, speed, dt) {
        if (!this.desiredDir.x && !this.desiredDir.y) return;

        // If reversing direction on same axis, change immediately
        if (this.desiredDir.x === -this.currentDir.x && this.desiredDir.x !== 0) {
            this.currentDir = { ...this.desiredDir };
            return;
        }
        if (this.desiredDir.y === -this.currentDir.y && this.desiredDir.y !== 0) {
            this.currentDir = { ...this.desiredDir };
            return;
        }

        // If turning perpendicular (e.g. from horizontal to vertical)
        if (level && level.canMoveInDirection) {
            const canTurn = level.canMoveInDirection(this, this.desiredDir);
            if (canTurn) {
                // Snap slightly to corridor axis for smooth corner glide
                if (this.desiredDir.y !== 0) {
                    const snappedX = level.getTileCenterCoord(this.cx, 'x');
                    this.cx = this.approach(this.cx, snappedX, speed * 2 * dt);
                } else if (this.desiredDir.x !== 0) {
                    const snappedY = level.getTileCenterCoord(this.cy, 'y');
                    this.cy = this.approach(this.cy, snappedY, speed * 2 * dt);
                }
                this.currentDir = { ...this.desiredDir };
            }
        } else {
            // Default fallback
            this.currentDir = { ...this.desiredDir };
        }
    }

    // ==========================================
    // Items, Powerups & Interactions
    // ==========================================
    collectItem(item) {
        if (!item || !item.alive) return;

        switch (item.itemType) {
            case 'coin':
                this.coinsCollected++;
                this.addScore(100 * this.comboMultiplier);
                this.audio?.playCoin?.();
                this.particles?.createCoinSparkle?.(item.cx, item.cy);
                break;
            case 'extraLife':
                this.lives++;
                this.addScore(500);
                this.audio?.playLife?.();
                this.particles?.createHeartExplosion?.(item.cx, item.cy);
                break;
            case 'speed':
                this.speedTimer = this.speedDuration;
                this.addScore(250);
                this.audio?.playPowerup?.();
                this.particles?.createSpeedSparks?.(item.cx, item.cy);
                break;
            case 'shield':
                this.shieldTimer = this.shieldDuration;
                this.addScore(300);
                this.audio?.playShield?.();
                this.particles?.createShieldBurst?.(item.cx, item.cy);
                break;
            case 'key':
                this.keysCollected++;
                this.addScore(500);
                this.audio?.playKey?.();
                this.particles?.createKeySparkle?.(item.cx, item.cy);
                break;
            case 'gem':
                this.addScore(500 * this.comboMultiplier);
                this.audio?.playGem?.();
                this.particles?.createGemSparkle?.(item.cx, item.cy);
                break;
            default:
                this.addScore(50);
                break;
        }

        item.kill();
    }

    addScore(points) {
        this.score += points;
    }

    // ==========================================
    // Damage, Death & Respawn
    // ==========================================
    takeDamage(source = null) {
        // Immune if shield is active or currently in respawn invulnerability
        if (this.shieldTimer > 0 || this.invulnerable || this.isDead) {
            return false;
        }

        this.die(source);
        return true;
    }

    die(cause = null) {
        if (this.isDead) return;

        this.isDead = true;
        this.lives--;
        this.respawnTimer = this.respawnDelay;
        this.vx = 0;
        this.vy = -280; // Death hop
        this.triggerSquashStretch(0.6, 1.4);

        this.particles?.createDeathExplosion?.(this.cx, this.cy);
        this.audio?.playDeath?.();
    }

    updateDeathState(dt, level) {
        this.respawnTimer -= dt;

        // Platformer death arc
        if (this.mode === 'platformer') {
            this.vy += this.gravity * 0.8 * dt;
            this.y += this.vy * dt;
        }

        if (this.respawnTimer <= 0) {
            if (this.lives > 0) {
                this.respawn();
            } else {
                // Game Over triggered
                level?.handleGameOver?.();
            }
        }
    }

    respawn() {
        this.x = this.respawnX;
        this.y = this.respawnY;
        this.vx = 0;
        this.vy = 0;
        this.isDead = false;
        this.isGrounded = false;
        this.invulnerable = true;
        this.invulnerableTimer = 2.0; // 2 seconds of grace flicker
        this.scaleX = 1;
        this.scaleY = 1;
        this.currentDir = { x: 0, y: 0 };
        this.desiredDir = { x: 0, y: 0 };

        this.particles?.createRespawnRays?.(this.cx, this.cy);
        this.audio?.playRespawn?.();
    }

    // ==========================================
    // Math Utilities
    // ==========================================
    approach(current, target, maxDelta) {
        if (current < target) {
            return Math.min(current + maxDelta, target);
        } else {
            return Math.max(current - maxDelta, target);
        }
    }

    // ==========================================
    // Rendering & Visual FX
    // ==========================================
    render(ctx, camera = null) {
        if (!this.alive) return;

        // 1. Draw Speed Ghost Trails behind player
        this.renderGhostTrails(ctx);

        // 2. Invulnerability flicker
        if (this.invulnerable && Math.floor(Date.now() / 80) % 2 === 0) {
            return;
        }

        ctx.save();
        ctx.translate(Math.round(this.cx), Math.round(this.cy));

        if (this.rotation !== 0) {
            ctx.rotate(this.rotation);
        }

        // Apply Squash and Stretch
        ctx.scale(this.scaleX * (this.mode === 'platformer' ? this.facing : 1), this.scaleY);

        // 3. Draw Character Body (Sprite or Procedural Pixel Hero)
        this.drawCharacter(ctx);

        // 4. Draw Active Shield Aura
        if (this.shieldTimer > 0) {
            this.drawShieldAura(ctx);
        }

        ctx.restore();
    }

    renderGhostTrails(ctx) {
        for (const ghost of this.ghostTrails) {
            ctx.save();
            ctx.translate(Math.round(ghost.x), Math.round(ghost.y));
            ctx.scale(ghost.scaleX * (ghost.mode === 'platformer' ? ghost.facing : 1), ghost.scaleY);
            ctx.globalAlpha = ghost.alpha * 0.45;

            // Draw glowing cyan / golden silhouette
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 8;
            
            if (ghost.mode === 'platformer') {
                ctx.fillRect(-ghost.width / 2, -ghost.height / 2, ghost.width, ghost.height);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, ghost.width / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    drawCharacter(ctx) {
        if (this.mode === 'platformer') {
            this.drawPlatformerHero(ctx);
        } else {
            this.drawMazeHero(ctx);
        }
    }

    /** High-polish procedural platformer hero with pixel art aesthetics */
    drawPlatformerHero(ctx) {
        const w = this.width;
        const h = this.height;
        const hw = w / 2;
        const hh = h / 2;

        const isMoving = Math.abs(this.vx) > 15;
        const walkCycle = isMoving ? Math.sin(this.animTime * 14) : 0;
        const bob = isMoving ? Math.abs(Math.cos(this.animTime * 14)) * 3 : 0;

        // Drop shadow under feet
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(0, hh - 1, hw * 0.85, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 1. Red Hero Cap / Head
        ctx.fillStyle = '#e63946'; // Vibrant Retro Red
        ctx.fillRect(-hw + 2, -hh + bob, w - 4, 16);

        // Cap Visor / Front
        ctx.fillStyle = '#d62828';
        ctx.fillRect(hw - 4, -hh + 5 + bob, 4, 4);

        // 2. Face / Skin
        ctx.fillStyle = '#ffdfba'; // Skin Tone
        ctx.fillRect(-hw + 3, -hh + 12 + bob, w - 6, 12);

        // Big Retro Pixel Eye
        ctx.fillStyle = '#1d3557';
        ctx.fillRect(hw - 8, -hh + 14 + bob, 4, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hw - 7, -hh + 14 + bob, 2, 2);

        // Cheek blush
        ctx.fillStyle = '#f4a261';
        ctx.fillRect(hw - 10, -hh + 19 + bob, 4, 3);

        // 3. Blue Dungarees / Shirt
        ctx.fillStyle = '#1d3557'; // Navy Blue Overall
        ctx.fillRect(-hw + 2, -hh + 24 + bob, w - 4, 12);

        // Gold Buttons
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(-hw + 4, -hh + 26 + bob, 3, 3);
        ctx.fillRect(hw - 7, -hh + 26 + bob, 3, 3);

        // 4. Red Sleeves
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-hw, -hh + 24 + bob, 3, 8);
        ctx.fillRect(hw - 3, -hh + 24 + bob, 3, 8);

        // 5. Legs & Boots (Animated walk cycle)
        ctx.fillStyle = '#457b9d'; // Pants
        const legOffset1 = walkCycle * 5;
        const legOffset2 = -walkCycle * 5;

        // Left Leg
        ctx.fillRect(-hw + 3, -hh + 34 + (this.isGrounded ? legOffset1 : 0), 6, 6);
        // Right Leg
        ctx.fillRect(hw - 9, -hh + 34 + (this.isGrounded ? legOffset2 : 0), 6, 6);

        // Boots (Brown)
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(-hw + 1, -hh + 39 + (this.isGrounded ? legOffset1 : 0), 8, 5);
        ctx.fillRect(hw - 9, -hh + 39 + (this.isGrounded ? legOffset2 : 0), 8, 5);

        // If airborn, draw jumping pose
        if (!this.isGrounded) {
            ctx.fillStyle = '#e63946'; // Fist raised
            ctx.fillRect(hw - 5, -hh - 4, 5, 6);
        }
    }

    /** Top-down maze arcade hero */
    drawMazeHero(ctx) {
        const r = this.width / 2;
        const isMoving = Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10;
        const pulse = Math.sin(this.animTime * 12) * 1.5;

        // Outer glow
        ctx.save();
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 10;

        // Body Circle (Vibrant Teal / Yellow Arcade Disc)
        const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, r);
        grad.addColorStop(0, '#70e000');
        grad.addColorStop(0.7, '#38b000');
        grad.addColorStop(1, '#007200');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r + (isMoving ? pulse * 0.4 : 0), 0, Math.PI * 2);
        ctx.fill();

        // Directional Visor / Eyes
        ctx.fillStyle = '#ffffff';
        let eyeDx = 0;
        let eyeDy = 0;
        if (this.mazeDirection === 0) eyeDy = -5; // Up
        else if (this.mazeDirection === 1) eyeDx = 5; // Right
        else if (this.mazeDirection === 2) eyeDy = 5; // Down
        else if (this.mazeDirection === 3) eyeDx = -5; // Left

        ctx.beginPath();
        ctx.arc(eyeDx, eyeDy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#001219';
        ctx.beginPath();
        ctx.arc(eyeDx * 1.25, eyeDy * 1.25, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /** Pulsating Rainbow Invincibility Shield Aura */
    drawShieldAura(ctx) {
        const time = this.animTime * 6;
        const r = Math.max(this.width, this.height) * 0.75 + Math.sin(time * 2) * 4;

        ctx.save();
        ctx.lineWidth = 3;

        // Rotating Rainbow Ring
        const hue = (this.animTime * 300) % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, 65%, 0.85)`;
        ctx.shadowColor = `hsla(${hue}, 100%, 75%, 1)`;
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // Inner energetic orbit sparks
        for (let i = 0; i < 3; i++) {
            const angle = time + (i * Math.PI * 2 / 3);
            const sparkX = Math.cos(angle) * r;
            const sparkY = Math.sin(angle) * r;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

export default Player;
