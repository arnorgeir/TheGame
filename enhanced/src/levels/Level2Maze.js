/**
 * Level2Maze.js - Top-Down Arcade Maze & Speed Track for The Game Enhanced Edition
 * Map dimensions: 600px x 600px (25 x 25 tiles @ 24px)
 * 
 * Features:
 * - Rich neon-grid labyrinth with corridor turning assist & line-of-sight raycasting
 * - Interactive Speed Booster Pads with directional particle surges
 * - Hundreds of glowing arcade dots & powerup caches
 * - Multi-baddie patrol & chase AI across distinct sectors
 * - Locked Finish Gate / Exit Portal that unlocks once required collectibles are gathered
 * - Seamless integration with Camera, Particles, Audio, and HUD
 */

import { Player } from '../entities/Player.js';
import { MazeBaddie } from '../entities/Baddie.js';
import { Collectable } from '../entities/Collectable.js';

export class BoosterPad {
    /**
     * @param {number} x
     * @param {number} y
     * @param {{x: number, y: number}} direction Boost surge direction
     */
    constructor(x, y, direction = { x: 1, y: 0 }) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
        this.direction = direction;
        this.animTime = Math.random() * 5;
        this.cooldown = 0;
    }

    get cx() { return this.x + this.width / 2; }
    get cy() { return this.y + this.height / 2; }

    update(dt, player, particles, audio) {
        this.animTime += dt;
        if (this.cooldown > 0) {
            this.cooldown -= dt;
        }

        if (this.cooldown <= 0 && player && !player.isDead) {
            const dx = Math.abs(player.cx - this.cx);
            const dy = Math.abs(player.cy - this.cy);
            if (dx < 12 && dy < 12) {
                this.cooldown = 0.5;
                player.speedTimer = 4.0; // 4s speed surge
                player.currentDir = { ...this.direction };
                
                particles?.createSpeedBoostSurge?.(this.cx, this.cy, this.direction);
                audio?.playBooster?.();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.cx, this.cy);

        // Rotating angle based on boost direction
        const angle = Math.atan2(this.direction.y, this.direction.x);
        ctx.rotate(angle);

        const pulse = Math.sin(this.animTime * 10) * 0.2;
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 10;

        // Base Pad
        ctx.fillStyle = 'rgba(0, 245, 212, 0.25)';
        ctx.fillRect(-10, -10, 20, 20);

        // Animated Chevron Arrows
        ctx.fillStyle = '#00f5d4';
        for (let i = -1; i <= 1; i++) {
            const offset = i * 5 + (pulse * 4);
            ctx.beginPath();
            ctx.moveTo(offset - 3, -6);
            ctx.lineTo(offset + 3, 0);
            ctx.lineTo(offset - 3, 6);
            ctx.lineTo(offset - 1, 6);
            ctx.lineTo(offset + 5, 0);
            ctx.lineTo(offset - 1, -6);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

export class FinishGate {
    constructor(x, y, width = 24, height = 48) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.unlocked = false;
        this.animTime = 0;
    }

    get cx() { return this.x + this.width / 2; }
    get cy() { return this.y + this.height / 2; }

    update(dt, player, level) {
        this.animTime += dt;

        if (this.unlocked && player && !player.isDead) {
            if (
                player.right > this.x &&
                player.left < this.x + this.width &&
                player.bottom > this.y &&
                player.top < this.y + this.height
            ) {
                level.completeLevel();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        const pulse = Math.sin(this.animTime * 6) * 0.2;

        if (this.unlocked) {
            // Radiant Emerald Victory Portal
            ctx.shadowColor = '#06d6a0';
            ctx.shadowBlur = 16;
            ctx.fillStyle = `rgba(6, 214, 160, ${0.75 + pulse})`;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Swirling portal core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "Press Start 2P", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('EXIT', this.cx, this.cy + 3);
        } else {
            // Locked Red Laser Barrier
            ctx.shadowColor = '#d90429';
            ctx.shadowBlur = 12;
            ctx.fillStyle = 'rgba(217, 4, 41, 0.45)';
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Laser beam lines
            ctx.strokeStyle = '#ef233c';
            ctx.lineWidth = 2;
            for (let y = this.y + 6; y < this.y + this.height; y += 10) {
                ctx.beginPath();
                ctx.moveTo(this.x, y);
                ctx.lineTo(this.x + this.width, y);
                ctx.stroke();
            }

            // Lock Icon
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(this.cx, this.cy - 3, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(this.cx - 4, this.cy - 1, 8, 8);
        }

        ctx.restore();
    }
}

export class Level2Maze {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
        this.tileWidth = 24;
        this.tileHeight = 24;
        this.mapCols = 25;
        this.mapRows = 25;
        this.width = this.mapCols * this.tileWidth;   // 600px
        this.height = this.mapRows * this.tileHeight; // 600px

        // System integrations
        this.audio = options.audio ?? null;
        this.particles = options.particles ?? null;
        this.camera = options.camera ?? null;
        this.onComplete = options.onComplete ?? null;

        // Gameplay Progression
        this.dotsCollected = 0;
        this.dotsRequired = 0;
        this.totalDots = 0;
        this.isCompleted = false;
        this.completionTimer = 0;
        this.timeElapsed = 0;

        // Maze Grid: 1 = Corridor (Walkable), 0 = Solid Wall
        this.mazeGrid = new Uint8Array(this.mapCols * this.mapRows);

        // Collections
        this.player = null;
        this.baddies = [];
        this.collectables = [];
        this.boosterPads = [];
        this.finishGate = null;

        // Construct Maze
        this.buildStage();
    }

    buildStage() {
        // 1. Generate Corridor Grid
        this.generateCorridorLayout();

        // 2. Spawn Player at top-left corridor entrance
        this.player = new Player({
            x: 1 * this.tileWidth + 1,
            y: 1 * this.tileHeight + 1,
            mode: 'maze',
            audio: this.audio,
            particles: this.particles
        });

        // 3. Spawn Speed Booster Pads
        this.spawnBoosterPads();

        // 4. Spawn Collectibles (Dots, Powerups, Master Keys)
        this.spawnCollectibles();

        // 5. Spawn Maze Baddies (Ghosts/Drones with distinct patrol hubs)
        this.spawnMazeBaddies();

        // 6. Spawn Locked Exit Gate at bottom-right corridor exit
        this.finishGate = new FinishGate(23 * this.tileWidth, 22 * this.tileHeight, 24, 48);

        // Required dots to unlock gate (75% of total dots)
        this.dotsRequired = Math.floor(this.totalDots * 0.75);
    }

    /** Authentic layout matching classic 25x25 track matrix */
    generateCorridorLayout() {
        // Raw walking matrix matching classic Level 2 (1 = Walkable corridor, 0 = Wall)
        const mazePattern = [
            0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
            0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,0,0,
            0,1,0,0,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,0,1,0,0,0,
            0,1,0,0,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,0,1,0,0,0,
            0,1,1,1,1,1,1,1,1,0,0,1,0,0,1,1,1,1,1,1,1,1,0,0,0,
            0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,
            0,1,0,0,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,0,0,1,0,0,0,
            0,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,
            0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,
            0,0,0,1,0,0,1,0,1,1,1,1,1,1,1,0,1,0,0,1,0,0,0,0,0,
            0,1,1,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,1,1,0,0,0,
            0,1,0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1,0,0,0,
            0,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,
            0,1,0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1,0,0,0,
            0,1,1,1,0,0,1,0,1,1,1,1,1,1,1,0,1,0,0,1,1,1,0,0,0,
            0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,
            0,0,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,1,0,0,0,0,0,
            0,1,1,1,1,1,1,0,0,1,0,0,0,1,0,0,1,1,1,1,1,1,0,0,0,
            0,1,0,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,
            0,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,0,0,0,
            0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,
            0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,
            0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
            0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,
            0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        ];

        for (let i = 0; i < mazePattern.length; i++) {
            this.mazeGrid[i] = mazePattern[i];
        }
    }

    isCorridor(col, row) {
        if (col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows) {
            return false;
        }
        return this.mazeGrid[row * this.mapCols + col] === 1;
    }

    spawnBoosterPads() {
        this.boosterPads = [
            new BoosterPad(4 * this.tileWidth, 1 * this.tileHeight, { x: 1, y: 0 }),
            new BoosterPad(1 * this.tileWidth, 12 * this.tileHeight, { x: 0, y: 1 }),
            new BoosterPad(20 * this.tileWidth, 12 * this.tileHeight, { x: 0, y: -1 }),
            new BoosterPad(12 * this.tileWidth, 22 * this.tileHeight, { x: 1, y: 0 })
        ];
    }

    spawnCollectibles() {
        this.collectables = [];
        this.totalDots = 0;

        for (let r = 0; r < this.mapRows; r++) {
            for (let c = 0; c < this.mapCols; c++) {
                if (this.isCorridor(c, r)) {
                    // Skip spawn at player start
                    if (c === 1 && r === 1) continue;

                    // Powerup placement at strategic alcoves
                    if (c === 21 && r === 1) {
                        this.collectables.push(new Collectable({
                            x: c * this.tileWidth + 1,
                            y: r * this.tileHeight + 1,
                            itemType: 'extraLife',
                            particles: this.particles,
                            audio: this.audio
                        }));
                    } else if (c === 1 && r === 22) {
                        this.collectables.push(new Collectable({
                            x: c * this.tileWidth + 1,
                            y: r * this.tileHeight + 1,
                            itemType: 'shield',
                            particles: this.particles,
                            audio: this.audio
                        }));
                    } else if (c === 11 && r === 9) {
                        this.collectables.push(new Collectable({
                            x: c * this.tileWidth + 1,
                            y: r * this.tileHeight + 1,
                            itemType: 'gem',
                            particles: this.particles,
                            audio: this.audio
                        }));
                    } else {
                        // Standard Glowing Arcade Dot
                        this.collectables.push(new Collectable({
                            x: c * this.tileWidth + 3,
                            y: r * this.tileHeight + 3,
                            itemType: 'coin',
                            particles: this.particles,
                            audio: this.audio
                        }));
                        this.totalDots++;
                    }
                }
            }
        }
    }

    spawnMazeBaddies() {
        this.baddies = [
            // Red Chaser (Blinky style)
            new MazeBaddie({
                x: 10 * this.tileWidth + 1,
                y: 10 * this.tileHeight + 1,
                speed: 80,
                chaseSpeed: 130,
                colorTheme: '#e63946',
                particles: this.particles,
                audio: this.audio
            }),
            // Cyan Interceptor (Inky style)
            new MazeBaddie({
                x: 14 * this.tileWidth + 1,
                y: 10 * this.tileHeight + 1,
                speed: 75,
                chaseSpeed: 125,
                colorTheme: '#00b4d8',
                particles: this.particles,
                audio: this.audio
            }),
            // Orange Roamer (Clyde style)
            new MazeBaddie({
                x: 12 * this.tileWidth + 1,
                y: 14 * this.tileHeight + 1,
                speed: 70,
                chaseSpeed: 115,
                colorTheme: '#ffb703',
                particles: this.particles,
                audio: this.audio
            })
        ];
    }

    // ==========================================
    // Maze AI & Navigation Helpers
    // ==========================================

    /**
     * Checks if moving in the given direction from current tile is unobstructed
     */
    canMoveInDirection(entity, dir) {
        const curCol = Math.floor(entity.cx / this.tileWidth);
        const curRow = Math.floor(entity.cy / this.tileHeight);
        const nextCol = curCol + dir.x;
        const nextRow = curRow + dir.y;

        return this.isCorridor(nextCol, nextRow);
    }

    getTileCenterCoord(pos, axis = 'x') {
        const tileSize = axis === 'x' ? this.tileWidth : this.tileHeight;
        const colOrRow = Math.floor(pos / tileSize);
        return colOrRow * tileSize + tileSize / 2;
    }

    /**
     * Clamps and resolves bounding box collisions against corridor walls
     */
    resolveMazeCollision(entity) {
        const leftCol = Math.floor((entity.left + 2) / this.tileWidth);
        const rightCol = Math.floor((entity.right - 2) / this.tileWidth);
        const topRow = Math.floor((entity.top + 2) / this.tileHeight);
        const bottomRow = Math.floor((entity.bottom - 2) / this.tileHeight);

        // Check 4 corner points
        const corners = [
            { c: leftCol, r: topRow },
            { c: rightCol, r: topRow },
            { c: leftCol, r: bottomRow },
            { c: rightCol, r: bottomRow }
        ];

        for (const pt of corners) {
            if (!this.isCorridor(pt.c, pt.r)) {
                // Wall hit: push entity back to nearest valid corridor center
                const validCol = Math.floor(entity.cx / this.tileWidth);
                const validRow = Math.floor(entity.cy / this.tileHeight);
                
                if (this.isCorridor(validCol, validRow)) {
                    entity.cx = validCol * this.tileWidth + this.tileWidth / 2;
                    entity.cy = validRow * this.tileHeight + this.tileHeight / 2;
                }
                break;
            }
        }
    }

    /** Raycast line of sight check between two points in the maze */
    hasLineOfSight(x1, y1, x2, y2) {
        const col1 = Math.floor(x1 / this.tileWidth);
        const row1 = Math.floor(y1 / this.tileHeight);
        const col2 = Math.floor(x2 / this.tileWidth);
        const row2 = Math.floor(y2 / this.tileHeight);

        if (col1 === col2) {
            const startR = Math.min(row1, row2);
            const endR = Math.max(row1, row2);
            for (let r = startR; r <= endR; r++) {
                if (!this.isCorridor(col1, r)) return false;
            }
            return true;
        }

        if (row1 === row2) {
            const startC = Math.min(col1, col2);
            const endC = Math.max(col1, col2);
            for (let c = startC; c <= endC; c++) {
                if (!this.isCorridor(c, row1)) return false;
            }
            return true;
        }

        return false;
    }

    /** AI pathing & intersection turning for maze baddies */
    handleMazeBaddieMovement(baddie, dt) {
        const curCol = Math.floor(baddie.cx / this.tileWidth);
        const curRow = Math.floor(baddie.cy / this.tileHeight);
        const tileCx = curCol * this.tileWidth + this.tileWidth / 2;
        const tileCy = curRow * this.tileHeight + this.tileHeight / 2;

        const distToCenter = Math.hypot(baddie.cx - tileCx, baddie.cy - tileCy);

        // If baddie is near tile center, make turn decisions
        if (distToCenter < 3.5) {
            const validDirs = [];
            const cardinal = [
                { x: 0, y: -1 }, // Up
                { x: 1, y: 0 },  // Right
                { x: 0, y: 1 },  // Down
                { x: -1, y: 0 }  // Left
            ];

            for (const d of cardinal) {
                // Avoid immediate 180 turnaround unless dead end
                if (d.x === -baddie.direction.x && d.y === -baddie.direction.y) continue;

                if (this.isCorridor(curCol + d.x, curRow + d.y)) {
                    validDirs.push(d);
                }
            }

            if (validDirs.length > 0) {
                // If in CHASE mode, pick the direction that minimizes distance to player
                if (baddie.state === 'CHASE' && this.player) {
                    let bestDir = validDirs[0];
                    let minDist = Infinity;
                    for (const d of validDirs) {
                        const targetX = (curCol + d.x) * this.tileWidth + this.tileWidth / 2;
                        const targetY = (curRow + d.y) * this.tileHeight + this.tileHeight / 2;
                        const dist = Math.hypot(this.player.cx - targetX, this.player.cy - targetY);
                        if (dist < minDist) {
                            minDist = dist;
                            bestDir = d;
                        }
                    }
                    baddie.direction = bestDir;
                } else {
                    // Random patrol selection at junctions
                    const chosen = validDirs[Math.floor(Math.random() * validDirs.length)];
                    baddie.direction = chosen;
                }

                // Snap to corridor axis
                baddie.cx = tileCx;
                baddie.cy = tileCy;
            } else {
                // Dead end: reverse direction
                baddie.direction = { x: -baddie.direction.x, y: -baddie.direction.y };
            }
        }
    }

    // ==========================================
    // Update Loop
    // ==========================================
    update(dt, input) {
        this.timeElapsed += dt;

        // 1. Update Player
        if (this.player) {
            this.player.update(dt, input, this);
        }

        // 2. Update Camera (Smooth Tracking or Centered)
        if (this.camera && this.player) {
            this.camera.follow(this.player.cx, this.player.cy, dt);
            this.camera.clamp(0, 0, this.width, this.height);
        }

        // 3. Update Booster Pads
        for (const pad of this.boosterPads) {
            pad.update(dt, this.player, this.particles, this.audio);
        }

        // 4. Update Collectibles & Player pickup checks
        for (let i = this.collectables.length - 1; i >= 0; i--) {
            const item = this.collectables[i];
            item.update(dt);

            if (item.alive && this.player && !this.player.isDead && this.player.intersects(item)) {
                if (item.itemType === 'coin') {
                    this.dotsCollected++;
                }
                this.player.collectItem(item);

                // Check gate unlock trigger
                if (!this.finishGate.unlocked && this.dotsCollected >= this.dotsRequired) {
                    this.finishGate.unlocked = true;
                    this.particles?.createGateUnlockFountain?.(this.finishGate.cx, this.finishGate.cy);
                    this.audio?.playGateUnlock?.();
                }
            }

            if (!item.alive) {
                this.collectables.splice(i, 1);
            }
        }

        // 5. Update Maze Baddies
        for (let i = this.baddies.length - 1; i >= 0; i--) {
            const baddie = this.baddies[i];
            baddie.update(dt, this, this.player);

            if (!baddie.alive) {
                this.baddies.splice(i, 1);
            }
        }

        // 6. Update Finish Gate
        if (this.finishGate) {
            this.finishGate.update(dt, this.player, this);
        }

        // 7. Handle Level Completion Sequence
        if (this.isCompleted) {
            this.completionTimer += dt;
            if (this.completionTimer >= 2.5 && typeof this.onComplete === 'function') {
                this.onComplete({
                    score: this.player?.score || 0,
                    dots: this.dotsCollected,
                    lives: this.player?.lives || 3,
                    time: this.timeElapsed
                });
                this.onComplete = null;
            }
        }
    }

    completeLevel() {
        if (this.isCompleted) return;
        this.isCompleted = true;
        this.completionTimer = 0;

        const timeBonus = Math.max(0, Math.round((200 - this.timeElapsed) * 15));
        this.player?.addScore(2000 + timeBonus);

        this.particles?.createLevelCompleteCelebration?.(this.finishGate.cx, this.finishGate.cy);
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
        const viewW = camera?.viewportWidth ?? 600;
        const viewH = camera?.viewportHeight ?? 600;

        // 1. Draw Maze Arena Backdrop
        this.drawMazeBackdrop(ctx, camX, camY, viewW, viewH);

        // 2. Draw Speed Booster Pads
        for (const pad of this.boosterPads) {
            pad.draw(ctx);
        }

        // 3. Draw Finish Gate
        if (this.finishGate) {
            this.finishGate.draw(ctx);
        }

        // 4. Draw Collectibles
        for (const item of this.collectables) {
            item.render(ctx, camera);
        }

        // 5. Draw Baddies
        for (const baddie of this.baddies) {
            baddie.render(ctx, camera);
        }

        // 6. Draw Player
        if (this.player) {
            this.player.render(ctx, camera);
        }

        // 7. Draw HUD / Objective Progress
        this.drawMazeHUD(ctx, camX, camY, viewW, viewH);

        // 8. Victory Banner
        if (this.isCompleted) {
            this.drawVictoryBanner(ctx, camX, camY, viewW, viewH);
        }
    }

    drawMazeBackdrop(ctx, camX, camY, viewW, viewH) {
        // Deep cyber space / retro dark blue backdrop
        ctx.fillStyle = '#050814';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw Walls & Corridors
        for (let r = 0; r < this.mapRows; r++) {
            for (let c = 0; c < this.mapCols; c++) {
                const tx = c * this.tileWidth;
                const ty = r * this.tileHeight;

                if (!this.isCorridor(c, r)) {
                    // Solid Neon Cyber Wall
                    ctx.fillStyle = '#10172a';
                    ctx.fillRect(tx, ty, this.tileWidth, this.tileHeight);

                    // Glowing Border Outlines
                    ctx.strokeStyle = '#1e3a8a';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(tx + 1, ty + 1, this.tileWidth - 2, this.tileHeight - 2);

                    // Inner Core
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(tx + 4, ty + 4, this.tileWidth - 8, this.tileHeight - 8);
                } else {
                    // Walkable Track Grid Floor
                    ctx.fillStyle = '#0b1120';
                    ctx.fillRect(tx, ty, this.tileWidth, this.tileHeight);

                    // Subtle grid lines
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(tx, ty, this.tileWidth, this.tileHeight);
                }
            }
        }
    }

    drawMazeHUD(ctx, camX, camY, viewW, viewH) {
        ctx.save();
        // Dot Progress Bar Top Header
        const barW = 200;
        const barH = 10;
        const bx = camX + (viewW - barW) / 2;
        const by = camY + 12;

        const progress = Math.min(1.0, this.dotsCollected / Math.max(1, this.dotsRequired));

        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx, by, barW, barH);
        ctx.strokeRect(bx, by, barW, barH);

        // Fill bar
        ctx.fillStyle = this.finishGate.unlocked ? '#06d6a0' : '#ffd166';
        ctx.shadowColor = this.finishGate.unlocked ? '#06d6a0' : '#ffd166';
        ctx.shadowBlur = 6;
        ctx.fillRect(bx + 1, by + 1, (barW - 2) * progress, barH - 2);

        // Text Indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px "Press Start 2P", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            this.finishGate.unlocked ? 'GATE UNLOCKED! REACH EXIT' : `DOTS: ${this.dotsCollected} / ${this.dotsRequired}`,
            bx + barW / 2,
            by - 4
        );

        ctx.restore();
    }

    drawVictoryBanner(ctx, camX, camY, viewW, viewH) {
        ctx.save();
        const alpha = Math.min(1, this.completionTimer * 1.5);
        ctx.globalAlpha = alpha;

        const bannerW = 380;
        const bannerH = 140;
        const bx = camX + (viewW - bannerW) / 2;
        const by = camY + 140;

        ctx.fillStyle = 'rgba(10, 17, 40, 0.9)';
        ctx.strokeStyle = '#06d6a0';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#06d6a0';
        ctx.shadowBlur = 18;

        ctx.fillRect(bx, by, bannerW, bannerH);
        ctx.strokeRect(bx, by, bannerW, bannerH);

        ctx.fillStyle = '#06d6a0';
        ctx.font = 'bold 18px "Press Start 2P", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAZE CLEARED!', bx + bannerW / 2, by + 45);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Press Start 2P", sans-serif';
        ctx.fillText(`SCORE: ${this.player?.score || 0}`, bx + bannerW / 2, by + 80);
        ctx.fillText(`DOTS: ${this.dotsCollected}`, bx + bannerW / 2, by + 105);

        ctx.restore();
    }
}

export default Level2Maze;
