/**
 * Level1Platformer.js - Side-Scrolling Platformer Stage for The Game Enhanced Edition
 * Map dimensions: 3000px x 600px (125 x 25 tiles @ 24px)
 * 
 * Features:
 * - Multi-layer Parallax Backgrounds (Sky, Sun/Mountains, Cloud layers at variable speeds)
 * - Robust 2-axis AABB tile collision with one-way platforms and cliff detection
 * - Checkpoint Flagpoles with smooth flag raising animations and particle fountains
 * - Rich entity ecosystem: Player, Patrolling Baddies, Coin trails, Powerups
 * - Final Victory Gate / Goal Flagpole with level completion sequence
 * - Seamless integration with Camera, Particles, Audio, and HUD
 */

import { Player } from '../entities/Player.js';
import { PlatformerBaddie } from '../entities/Baddie.js';
import { Collectable } from '../entities/Collectable.js';

export class Checkpoint {
    constructor(x, y, id = 1) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.width = 24;
        this.height = 72; // Flagpole height
        this.activated = false;
        this.flagHeightRatio = 0.0; // 0 = at bottom, 1 = at top of pole
        this.flagWaveTime = 0;
    }

    get bounds() {
        return {
            x: this.x,
            y: this.y,
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height
        };
    }

    update(dt, player, particles, audio) {
        this.flagWaveTime += dt;

        // Check player activation
        if (!this.activated && player && !player.isDead) {
            const b = this.bounds;
            if (
                player.right > b.left &&
                player.left < b.right &&
                player.bottom > b.top &&
                player.top < b.bottom
            ) {
                this.activated = true;
                player.setCheckpoint(this.x + 8, this.y + this.height - player.height, this.id);
                
                // Trigger effects
                particles?.createCheckpointFountain?.(this.x + 12, this.y + this.height);
                audio?.playCheckpoint?.();
            }
        }

        // Animate flag raising smoothly
        if (this.activated && this.flagHeightRatio < 1.0) {
            this.flagHeightRatio = Math.min(1.0, this.flagHeightRatio + dt * 2.2);
        }
    }

    draw(ctx) {
        ctx.save();

        // 1. Flagpole Base
        ctx.fillStyle = '#4a4e69';
        ctx.fillRect(this.x + 4, this.y + this.height - 8, 16, 8);
        ctx.fillStyle = '#22223b';
        ctx.fillRect(this.x + 6, this.y + this.height - 12, 12, 4);

        // 2. Metallic Pole
        const poleGrad = ctx.createLinearGradient(this.x + 10, 0, this.x + 14, 0);
        poleGrad.addColorStop(0, '#f8f9fa');
        poleGrad.addColorStop(0.5, '#adb5bd');
        poleGrad.addColorStop(1, '#495057');
        ctx.fillStyle = poleGrad;
        ctx.fillRect(this.x + 10, this.y, 4, this.height - 12);

        // Gold Finial Ball at pole top
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(this.x + 12, this.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // 3. Animated Flag
        const flagY = (this.y + this.height - 24) - (this.flagHeightRatio * (this.height - 28));
        const wave = Math.sin(this.flagWaveTime * 8) * 3;

        ctx.fillStyle = this.activated ? '#06d6a0' : '#e63946'; // Green when active, red when inactive
        ctx.shadowColor = this.activated ? '#06d6a0' : '#e63946';
        ctx.shadowBlur = this.activated ? 8 : 0;

        ctx.beginPath();
        ctx.moveTo(this.x + 14, flagY);
        ctx.quadraticCurveTo(this.x + 24, flagY + wave, this.x + 34, flagY + 8);
        ctx.lineTo(this.x + 14, flagY + 16);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

export class GoalFlag {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 96;
        this.reached = false;
        this.flagProgress = 0;
        this.animTime = 0;
    }

    update(dt, player, level) {
        this.animTime += dt;
        if (!this.reached && player && !player.isDead) {
            if (
                player.right > this.x &&
                player.left < this.x + this.width &&
                player.bottom > this.y &&
                player.top < this.y + this.height
            ) {
                this.reached = true;
                level.completeLevel();
            }
        }

        if (this.reached && this.flagProgress < 1.0) {
            this.flagProgress = Math.min(1.0, this.flagProgress + dt * 1.5);
        }
    }

    draw(ctx) {
        ctx.save();
        // Golden Goal Arch / Tower
        ctx.fillStyle = '#ffb703';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 12;

        // Base & Pillars
        ctx.fillRect(this.x, this.y + this.height - 12, this.width, 12);
        ctx.fillRect(this.x + 4, this.y, 6, this.height);
        ctx.fillRect(this.x + this.width - 10, this.y, 6, this.height);

        // Arch Header
        ctx.fillRect(this.x, this.y - 8, this.width, 10);

        // Golden Victory Star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - 14, 6, 0, Math.PI * 2);
        ctx.fill();

        // Shimmering Victory Portal Beam
        const beamAlpha = 0.35 + Math.sin(this.animTime * 6) * 0.15;
        const portalGrad = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
        portalGrad.addColorStop(0, `rgba(255, 214, 10, ${beamAlpha})`);
        portalGrad.addColorStop(1, 'rgba(255, 183, 3, 0.05)');
        ctx.fillStyle = portalGrad;
        ctx.fillRect(this.x + 10, this.y, this.width - 20, this.height - 12);

        ctx.restore();
    }
}

export class Level1Platformer {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
        this.tileWidth = 24;
        this.tileHeight = 24;
        this.mapCols = 125;
        this.mapRows = 25;
        this.width = this.mapCols * this.tileWidth;   // 3000px
        this.height = this.mapRows * this.tileHeight; // 600px

        // System integrations
        this.audio = options.audio ?? null;
        this.particles = options.particles ?? null;
        this.camera = options.camera ?? null;
        this.onComplete = options.onComplete ?? null;

        // State
        this.isCompleted = false;
        this.completionTimer = 0;
        this.timeElapsed = 0;

        // Tilemap data structure (1 = solid terrain, 0 = empty)
        this.collisionGrid = new Uint8Array(this.mapCols * this.mapRows);

        // Entity Collections
        this.player = null;
        this.baddies = [];
        this.collectables = [];
        this.checkpoints = [];
        this.goal = null;

        // Parallax Clouds
        this.clouds = [
            { x: 120, y: 60, speed: 12, scale: 1.2, alpha: 0.8 },
            { x: 450, y: 110, speed: 8, scale: 0.9, alpha: 0.6 },
            { x: 820, y: 40, speed: 15, scale: 1.4, alpha: 0.75 },
            { x: 1300, y: 90, speed: 10, scale: 1.0, alpha: 0.65 },
            { x: 1750, y: 55, speed: 14, scale: 1.3, alpha: 0.8 },
            { x: 2200, y: 120, speed: 7, scale: 0.85, alpha: 0.55 },
            { x: 2650, y: 45, speed: 16, scale: 1.5, alpha: 0.85 }
        ];

        // Initialize stage
        this.buildStage();
    }

    /** Construct collision geometry, items, enemies, and interactive objects */
    buildStage() {
        // 1. Build Base Terrain and Platforms
        this.generatePlatformTerrain();

        // 2. Spawn Player
        this.player = new Player({
            x: 48,
            y: 480,
            mode: 'platformer',
            audio: this.audio,
            particles: this.particles
        });

        // 3. Spawn Checkpoints
        this.checkpoints = [
            new Checkpoint(1020, 440, 1),
            new Checkpoint(2040, 392, 2)
        ];

        // 4. Spawn Goal Flag
        this.goal = new GoalFlag(2900, 416);

        // 5. Spawn Collectibles (Coins & Powerups)
        this.spawnCollectibles();

        // 6. Spawn Baddies
        this.spawnBaddies();
    }

    /** Procedural authentic recreation of Level 1 layout */
    generatePlatformTerrain() {
        // Ground floor with strategic pit gaps
        for (let c = 0; c < this.mapCols; c++) {
            // Pit gaps at: [24-27], [52-56], [82-86], [108-111]
            const isPit = (c >= 24 && c <= 27) || (c >= 52 && c <= 56) || (c >= 82 && c <= 86) || (c >= 108 && c <= 111);
            if (!isPit) {
                // Ground rows (Row 22, 23, 24)
                this.setTile(c, 22, 1);
                this.setTile(c, 23, 1);
                this.setTile(c, 24, 1);
            }
        }

        // Stepping Platforms & Floating Structures
        // Area 1: Opening Run (Cols 0 - 30)
        this.createPlatform(10, 18, 5);
        this.createPlatform(18, 15, 4);
        this.createPlatform(24, 17, 3); // Over pit 1
        this.createPlatform(29, 14, 5);

        // Area 2: Vertical Ascents & Stairs (Cols 32 - 60)
        this.createPlatform(35, 19, 4);
        this.createPlatform(41, 16, 5);
        this.createPlatform(48, 13, 4);
        this.createPlatform(52, 15, 3); // Over pit 2
        this.createPlatform(57, 18, 4);

        // Area 3: Mid-tier Highlands & Checkpoint 1 (Cols 60 - 85)
        this.createPlatform(64, 16, 6);
        this.createPlatform(72, 13, 5);
        this.createPlatform(78, 10, 4);
        this.createPlatform(82, 14, 3); // Over pit 3
        this.createPlatform(87, 17, 6);

        // Area 4: High-Stakes Floating Islands (Cols 88 - 112)
        this.createPlatform(93, 14, 4);
        this.createPlatform(99, 11, 5);
        this.createPlatform(105, 15, 4);
        this.createPlatform(108, 13, 3); // Over pit 4
        this.createPlatform(113, 18, 5);

        // Area 5: Victory Stretch (Cols 114 - 125)
        this.createPlatform(118, 20, 6);
    }

    createPlatform(startCol, row, length) {
        for (let c = startCol; c < startCol + length && c < this.mapCols; c++) {
            this.setTile(c, row, 1);
        }
    }

    setTile(col, row, val) {
        if (col >= 0 && col < this.mapCols && row >= 0 && row < this.mapRows) {
            this.collisionGrid[row * this.mapCols + col] = val;
        }
    }

    getTile(col, row) {
        if (col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows) {
            return 0;
        }
        return this.collisionGrid[row * this.mapCols + col];
    }

    spawnCollectibles() {
        this.collectables = [];

        // Helper to spawn coin arc
        const spawnCoinArc = (startCol, row, count) => {
            for (let i = 0; i < count; i++) {
                const c = startCol + i;
                const arcY = row * this.tileHeight - Math.sin((i / (count - 1)) * Math.PI) * 24;
                this.collectables.push(new Collectable({
                    x: c * this.tileWidth + 4,
                    y: arcY,
                    itemType: 'coin',
                    particles: this.particles,
                    audio: this.audio
                }));
            }
        };

        // Coin Trails along jumping arcs
        spawnCoinArc(10, 17, 5);
        spawnCoinArc(18, 14, 4);
        spawnCoinArc(24, 16, 4);
        spawnCoinArc(35, 18, 4);
        spawnCoinArc(41, 15, 5);
        spawnCoinArc(48, 12, 4);
        spawnCoinArc(64, 15, 6);
        spawnCoinArc(72, 12, 5);
        spawnCoinArc(78, 9, 4);
        spawnCoinArc(93, 13, 4);
        spawnCoinArc(99, 10, 5);
        spawnCoinArc(105, 14, 4);
        spawnCoinArc(114, 17, 6);

        // Powerups (Strategic Secret Nooks)
        // 1. Extra Life at High Ledge
        this.collectables.push(new Collectable({
            x: 49 * this.tileWidth,
            y: 10 * this.tileHeight,
            itemType: 'extraLife',
            particles: this.particles,
            audio: this.audio
        }));

        // 2. Speed Boost before long jump section
        this.collectables.push(new Collectable({
            x: 65 * this.tileWidth,
            y: 14 * this.tileHeight,
            itemType: 'speed',
            particles: this.particles,
            audio: this.audio
        }));

        // 3. Invincibility Shield on high platform
        this.collectables.push(new Collectable({
            x: 79 * this.tileWidth,
            y: 7 * this.tileHeight,
            itemType: 'shield',
            particles: this.particles,
            audio: this.audio
        }));

        // 4. Bonus Gems
        this.collectables.push(new Collectable({
            x: 101 * this.tileWidth,
            y: 8 * this.tileHeight,
            itemType: 'gem',
            particles: this.particles,
            audio: this.audio
        }));
    }

    spawnBaddies() {
        this.baddies = [];

        const baddieConfigs = [
            { x: 380, y: 500, speed: 65 },
            { x: 450, y: 330, speed: 70 },
            { x: 700, y: 500, speed: 60 },
            { x: 1000, y: 350, speed: 75 },
            { x: 1200, y: 500, speed: 70 },
            { x: 1550, y: 350, speed: 80 },
            { x: 1750, y: 280, speed: 85 },
            { x: 1900, y: 500, speed: 70 },
            { x: 2250, y: 300, speed: 80 },
            { x: 2450, y: 330, speed: 75 },
            { x: 2750, y: 500, speed: 85 }
        ];

        for (const cfg of baddieConfigs) {
            this.baddies.push(new PlatformerBaddie({
                x: cfg.x,
                y: cfg.y,
                speed: cfg.speed,
                avoidsEdges: true,
                particles: this.particles,
                audio: this.audio
            }));
        }
    }

    // ==========================================
    // Physics & Collision Resolution
    // ==========================================

    /**
     * Resolves horizontal solid collisions for an entity
     * @returns {boolean} true if a wall was hit
     */
    resolveCollisionX(entity) {
        const leftCol = Math.floor(entity.left / this.tileWidth);
        const rightCol = Math.floor((entity.right - 0.1) / this.tileWidth);
        const topRow = Math.floor(entity.top / this.tileHeight);
        const bottomRow = Math.floor((entity.bottom - 0.1) / this.tileHeight);

        let hitWall = false;

        if (entity.vx > 0) {
            // Moving Right
            for (let r = topRow; r <= bottomRow; r++) {
                if (this.getTile(rightCol, r) === 1) {
                    entity.x = rightCol * this.tileWidth - entity.width;
                    entity.vx = 0;
                    hitWall = true;
                    break;
                }
            }
        } else if (entity.vx < 0) {
            // Moving Left
            for (let r = topRow; r <= bottomRow; r++) {
                if (this.getTile(leftCol, r) === 1) {
                    entity.x = (leftCol + 1) * this.tileWidth;
                    entity.vx = 0;
                    hitWall = true;
                    break;
                }
            }
        }

        // Clamp entity within level bounds
        if (entity.x < 0) {
            entity.x = 0;
            entity.vx = 0;
            hitWall = true;
        } else if (entity.right > this.width) {
            entity.x = this.width - entity.width;
            entity.vx = 0;
            hitWall = true;
        }

        return hitWall;
    }

    /**
     * Resolves vertical solid collisions for an entity
     */
    resolveCollisionY(entity) {
        const leftCol = Math.floor((entity.left + 2) / this.tileWidth);
        const rightCol = Math.floor((entity.right - 2) / this.tileWidth);
        const topRow = Math.floor(entity.top / this.tileHeight);
        const bottomRow = Math.floor((entity.bottom - 0.05) / this.tileHeight);

        if (entity.vy >= 0) {
            // Falling / Landing
            for (let c = leftCol; c <= rightCol; c++) {
                if (this.getTile(c, bottomRow) === 1) {
                    entity.y = bottomRow * this.tileHeight - entity.height;
                    entity.vy = 0;
                    entity.isGrounded = true;
                    break;
                }
            }
        } else if (entity.vy < 0) {
            // Jumping / Head Bump
            for (let c = leftCol; c <= rightCol; c++) {
                if (this.getTile(c, topRow) === 1) {
                    entity.y = (topRow + 1) * this.tileHeight;
                    entity.vy = 0;
                    break;
                }
            }
        }
    }

    /** Checks if there is a pit/cliff 1 tile ahead for patrolling enemies */
    isCliffAhead(baddie, facing) {
        const checkX = facing > 0 ? baddie.right + 4 : baddie.left - 4;
        const checkCol = Math.floor(checkX / this.tileWidth);
        const groundRow = Math.floor((baddie.bottom + 4) / this.tileHeight);

        return this.getTile(checkCol, groundRow) === 0;
    }

    // ==========================================
    // Update Loop
    // ==========================================
    update(dt, input) {
        this.timeElapsed += dt;

        // 1. Update Parallax Clouds
        for (const cloud of this.clouds) {
            cloud.x += cloud.speed * dt;
            if (cloud.x > this.width + 100) {
                cloud.x = -150;
            }
        }

        // 2. Update Player
        if (this.player) {
            this.player.update(dt, input, this);
        }

        // 3. Update Camera to smoothly follow player
        if (this.camera && this.player) {
            this.camera.follow(this.player.cx + this.player.facing * 40, this.player.cy - 20, dt);
            this.camera.clamp(0, 0, this.width, this.height);
        }

        // 4. Update Checkpoints
        for (const cp of this.checkpoints) {
            cp.update(dt, this.player, this.particles, this.audio);
        }

        // 5. Update Goal Flag
        if (this.goal) {
            this.goal.update(dt, this.player, this);
        }

        // 6. Update Collectibles & Player Collisions
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const item = this.collectables[i];
            item.update(dt);

            if (item.alive && this.player && !this.player.isDead && this.player.intersects(item)) {
                this.player.collectItem(item);
            }

            if (!item.alive) {
                this.collectables.splice(i, 1);
            }
        }

        // 7. Update Baddies
        for (let i = this.baddies.length - 1; i >= 0; i--) {
            const baddie = this.baddies[i];
            baddie.update(dt, this, this.player);

            if (!baddie.alive) {
                this.baddies.splice(i, 1);
            }
        }

        // 8. Handle Level Completion Sequence
        if (this.isCompleted) {
            this.completionTimer += dt;
            if (this.completionTimer >= 2.5 && typeof this.onComplete === 'function') {
                this.onComplete({
                    score: this.player?.score || 0,
                    coins: this.player?.coinsCollected || 0,
                    lives: this.player?.lives || 3,
                    time: this.timeElapsed
                });
                this.onComplete = null; // Ensure single trigger
            }
        }
    }

    completeLevel() {
        if (this.isCompleted) return;
        this.isCompleted = true;
        this.completionTimer = 0;

        // Victory bonus
        const timeBonus = Math.max(0, Math.round((300 - this.timeElapsed) * 10));
        this.player?.addScore(1000 + timeBonus);

        this.particles?.createLevelCompleteCelebration?.(this.goal.x + 18, this.goal.y + 40);
        this.audio?.playVictory?.();
    }

    handleGameOver() {
        this.audio?.playGameOver?.();
    }

    // ==========================================
    // Render Loop
    // ==========================================
    render(ctx, camera = null) {
        const camX = camera?.x ?? 0;
        const camY = camera?.y ?? 0;
        const viewW = camera?.viewportWidth ?? 800;
        const viewH = camera?.viewportHeight ?? 600;

        // 1. Draw Parallax Backgrounds
        this.drawParallaxBackground(ctx, camX, camY, viewW, viewH);

        // 2. Draw Clouds
        this.drawClouds(ctx, camX);

        // 3. Draw Tilemap Terrain
        this.drawTerrain(ctx, camX, camY, viewW, viewH);

        // 4. Draw Checkpoints
        for (const cp of this.checkpoints) {
            if (cp.x + cp.width >= camX && cp.x <= camX + viewW) {
                cp.draw(ctx);
            }
        }

        // 5. Draw Goal Flag
        if (this.goal && this.goal.x + this.goal.width >= camX && this.goal.x <= camX + viewW) {
            this.goal.draw(ctx);
        }

        // 6. Draw Collectibles
        for (const item of this.collectables) {
            if (item.right >= camX && item.left <= camX + viewW) {
                item.render(ctx, camera);
            }
        }

        // 7. Draw Baddies
        for (const baddie of this.baddies) {
            if (baddie.right >= camX && baddie.left <= camX + viewW) {
                baddie.render(ctx, camera);
            }
        }

        // 8. Draw Player
        if (this.player) {
            this.player.render(ctx, camera);
        }

        // 9. Level Complete Banner Overlay
        if (this.isCompleted) {
            this.drawVictoryBanner(ctx, camX, camY, viewW, viewH);
        }
    }

    drawParallaxBackground(ctx, camX, camY, viewW, viewH) {
        // Sky Gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        skyGrad.addColorStop(0, '#0d1b2a');
        skyGrad.addColorStop(0.35, '#1b263b');
        skyGrad.addColorStop(0.7, '#415a77');
        skyGrad.addColorStop(1, '#778da9');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(camX, camY, viewW, viewH);

        // Distant Mountain Silhouettes (Parallax factor: 0.2x)
        const mountOffset = camX * 0.2;
        ctx.fillStyle = '#1d2d44';
        ctx.beginPath();
        ctx.moveTo(camX, this.height);
        for (let x = -100; x <= this.width + 100; x += 180) {
            const peakY = 280 + Math.sin(x * 0.005) * 60;
            ctx.lineTo(x - mountOffset, peakY);
            ctx.lineTo(x + 90 - mountOffset, 420);
        }
        ctx.lineTo(camX + viewW + 100, this.height);
        ctx.closePath();
        ctx.fill();

        // Mid-distance Hills (Parallax factor: 0.4x)
        const hillOffset = camX * 0.4;
        ctx.fillStyle = '#2b4162';
        ctx.beginPath();
        ctx.moveTo(camX, this.height);
        for (let x = -100; x <= this.width + 100; x += 120) {
            const peakY = 380 + Math.cos(x * 0.008) * 35;
            ctx.lineTo(x - hillOffset, peakY);
        }
        ctx.lineTo(camX + viewW + 100, this.height);
        ctx.closePath();
        ctx.fill();
    }

    drawClouds(ctx, camX) {
        for (const cloud of this.clouds) {
            ctx.save();
            ctx.globalAlpha = cloud.alpha;
            ctx.fillStyle = '#ffffff';

            const cx = cloud.x;
            const cy = cloud.y;
            const s = cloud.scale;

            ctx.beginPath();
            ctx.arc(cx, cy, 20 * s, 0, Math.PI * 2);
            ctx.arc(cx + 18 * s, cy - 8 * s, 24 * s, 0, Math.PI * 2);
            ctx.arc(cx + 42 * s, cy - 4 * s, 22 * s, 0, Math.PI * 2);
            ctx.arc(cx + 60 * s, cy, 18 * s, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    drawTerrain(ctx, camX, camY, viewW, viewH) {
        const startCol = Math.max(0, Math.floor(camX / this.tileWidth));
        const endCol = Math.min(this.mapCols - 1, Math.ceil((camX + viewW) / this.tileWidth));
        const startRow = Math.max(0, Math.floor(camY / this.tileHeight));
        const endRow = Math.min(this.mapRows - 1, Math.ceil((camY + viewH) / this.tileHeight));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (this.getTile(c, r) === 1) {
                    const tx = c * this.tileWidth;
                    const ty = r * this.tileHeight;

                    const isTopSolid = this.getTile(c, r - 1) === 0;

                    if (isTopSolid) {
                        // Grass Top Block
                        ctx.fillStyle = '#38b000'; // Lush Green Grass Top
                        ctx.fillRect(tx, ty, this.tileWidth, 5);

                        // Dirt Body
                        ctx.fillStyle = '#6b4226'; // Rich Earth Brown
                        ctx.fillRect(tx, ty + 5, this.tileWidth, this.tileHeight - 5);

                        // Pixel grass tufts
                        ctx.fillStyle = '#70e000';
                        ctx.fillRect(tx + 2, ty, 3, 2);
                        ctx.fillRect(tx + 12, ty, 4, 3);
                    } else {
                        // Subterranean Dirt Block
                        ctx.fillStyle = '#53331b';
                        ctx.fillRect(tx, ty, this.tileWidth, this.tileHeight);

                        // Rock Pebble highlights
                        ctx.fillStyle = '#7f4f24';
                        if ((c + r) % 3 === 0) {
                            ctx.fillRect(tx + 4, ty + 6, 4, 3);
                        } else if ((c * 2 + r) % 5 === 0) {
                            ctx.fillRect(tx + 14, ty + 12, 5, 4);
                        }
                    }

                    // Tile border shading
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                    ctx.fillRect(tx, ty + this.tileHeight - 1, this.tileWidth, 1);
                    ctx.fillRect(tx + this.tileWidth - 1, ty, 1, this.tileHeight);
                }
            }
        }
    }

    drawVictoryBanner(ctx, camX, camY, viewW, viewH) {
        ctx.save();
        const alpha = Math.min(1, this.completionTimer * 1.5);
        ctx.globalAlpha = alpha;

        const bannerW = 420;
        const bannerH = 140;
        const bx = camX + (viewW - bannerW) / 2;
        const by = camY + 120;

        // Banner backdrop
        ctx.fillStyle = 'rgba(10, 17, 40, 0.88)';
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 18;

        ctx.fillRect(bx, by, bannerW, bannerH);
        ctx.strokeRect(bx, by, bannerW, bannerH);

        // Text
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 20px "Press Start 2P", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STAGE 1 CLEAR!', bx + bannerW / 2, by + 45);

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px "Press Start 2P", sans-serif';
        ctx.fillText(`SCORE: ${this.player?.score || 0}`, bx + bannerW / 2, by + 80);
        ctx.fillText(`COINS: ${this.player?.coinsCollected || 0}`, bx + bannerW / 2, by + 105);

        ctx.restore();
    }
}

export default Level1Platformer;
