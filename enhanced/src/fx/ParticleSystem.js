/**
 * ParticleSystem.js
 * High-Performance Visual Juice & Particle FX Engine
 * The Game! — Enhanced Edition
 * 
 * Features:
 * - Dust clouds for running, jumping, and landing
 * - Sparkling stars & diamonds for coins & powerup pickups
 * - Expanding shockwave rings for stomps and heavy ground impacts
 * - Energetic bouncy debris shards, flame puffs & flash for explosions
 * - Juicy floating score/combo text popups with stroke outlines & pop-in scale punch
 * - Multicolored fireworks starbursts for victory sequences
 * - Camera offset and viewport culling for 60 FPS performance
 */

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.rings = [];
        this.floatingTexts = [];
    }

    /**
     * Resets and clears all active particles, rings, and floating texts.
     */
    clear() {
        this.particles.length = 0;
        this.rings.length = 0;
        this.floatingTexts.length = 0;
    }

    /**
     * Returns the total number of currently active visual FX entities.
     */
    getActiveCount() {
        return this.particles.length + this.rings.length + this.floatingTexts.length;
    }

    // ==========================================
    // PARTICLE EMITTERS
    // ==========================================

    /**
     * Emits small smoke/dust puffs at player's feet.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {number} dir - Movement direction: -1 (moving left), 1 (moving right), 0 (landing/jumping)
     * @param {number} count - Number of dust particles
     */
    emitDust(x, y, dir = 0, count = 5) {
        const colors = ['#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8'];

        for (let i = 0; i < count; i++) {
            let vx, vy;
            if (dir < 0) {
                // Moving left: dust drifts to the right
                vx = Math.random() * 45 + 15;
                vy = -(Math.random() * 25 + 5);
            } else if (dir > 0) {
                // Moving right: dust drifts to the left
                vx = -(Math.random() * 45 + 15);
                vy = -(Math.random() * 25 + 5);
            } else {
                // Landing / jumping: puffs spread both left and right
                vx = (Math.random() - 0.5) * 80;
                vy = -(Math.random() * 35 + 10);
            }

            const startSize = Math.random() * 2.5 + 2.5;
            const endSize = startSize * (Math.random() * 1.5 + 1.8);
            const life = Math.random() * 0.15 + 0.22;

            this.particles.push({
                x: x + (Math.random() - 0.5) * 8,
                y: y + (Math.random() - 0.5) * 4,
                vx,
                vy,
                gravity: -10, // Gentle upward buoyancy
                friction: 0.94,
                size: startSize,
                startSize,
                endSize,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0.75,
                startAlpha: 0.75,
                endAlpha: 0.0,
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 4,
                life: 0,
                maxLife: life,
                shape: 'smoke'
            });
        }
    }

    /**
     * Emits sparkling stars and diamonds with gravity for coin pickups & powerups.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {string|string[]} color - Particle color or array of colors (e.g. '#ffd700' for coin)
     * @param {number} count - Particle count
     */
    emitSparkles(x, y, color = '#ffd700', count = 12) {
        const colorPalette = Array.isArray(color) ? color : [color, '#ffffff', '#fff275'];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 130 + 40;
            const startSize = Math.random() * 3 + 3;

            this.particles.push({
                x: x + (Math.random() - 0.5) * 6,
                y: y + (Math.random() - 0.5) * 6,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 35,
                gravity: 120, // Gentle gravity
                friction: 0.96,
                size: startSize,
                startSize,
                endSize: 1.0,
                color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
                alpha: 1.0,
                startAlpha: 1.0,
                endAlpha: 0.0,
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 10,
                life: 0,
                maxLife: Math.random() * 0.25 + 0.45,
                shape: i % 2 === 0 ? 'star' : 'diamond'
            });
        }
    }

    /**
     * Emits an expanding shockwave ring for enemy stomps or heavy impacts.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {number} radius - Initial radius
     * @param {number} maxRadius - Target expanded radius
     * @param {string} color - Ring stroke color
     */
    emitStompRing(x, y, radius = 10, maxRadius = 46, color = '#ffffff') {
        this.rings.push({
            x,
            y,
            radius,
            startRadius: radius,
            maxRadius,
            lineWidth: 4,
            startWidth: 4,
            endWidth: 1,
            color,
            alpha: 0.95,
            startAlpha: 0.95,
            endAlpha: 0.0,
            life: 0,
            maxLife: 0.28
        });

        // Also emit a couple small lateral dust puffs
        this.emitDust(x, y, 0, 4);
    }

    /**
     * Emits bouncy energetic debris shards, smoke puffs, and flash for enemy defeat / boss damage.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {number} count - Total debris shard count
     * @param {string[]} colors - Palette of colors for shards
     */
    emitExplosion(x, y, count = 22, colors = ['#ff3300', '#ff8800', '#ffea00', '#ffffff', '#475569']) {
        // 1. Center Flash Particle
        this.particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            gravity: 0,
            friction: 1.0,
            size: 8,
            startSize: 8,
            endSize: 32,
            color: '#ffffff',
            alpha: 0.95,
            startAlpha: 0.95,
            endAlpha: 0.0,
            rotation: 0,
            vRot: 0,
            life: 0,
            maxLife: 0.12,
            shape: 'circle'
        });

        // 2. High-speed Debris Shards
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 220 + 80;
            const size = Math.random() * 4 + 3;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                gravity: 280, // Heavy gravity for energetic arc
                friction: 0.97,
                size,
                startSize: size,
                endSize: size * 0.4,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                startAlpha: 1.0,
                endAlpha: 0.0,
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 14,
                life: 0,
                maxLife: Math.random() * 0.3 + 0.4,
                shape: i % 3 === 0 ? 'shard' : (i % 3 === 1 ? 'square' : 'circle')
            });
        }

        // 3. Smoke puffs lingering
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 50 + 15;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                gravity: -15,
                friction: 0.92,
                size: 5,
                startSize: 5,
                endSize: 18,
                color: '#64748b',
                alpha: 0.6,
                startAlpha: 0.6,
                endAlpha: 0.0,
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 2,
                life: 0,
                maxLife: Math.random() * 0.25 + 0.4,
                shape: 'smoke'
            });
        }
    }

    /**
     * Emits juicy floating numbers/text that rise, punch scale, and fade out.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {string} text - Floating label (e.g. '+100', 'STOMP!', 'COMBO x2', 'SPEED UP!')
     * @param {string} color - Text fill color
     * @param {number} fontSize - Text font size in pixels
     */
    emitFloatingText(x, y, text, color = '#ffffff', fontSize = 16) {
        this.floatingTexts.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 20,
            vy: -(Math.random() * 20 + 55), // Floats upward
            text: String(text),
            color,
            strokeColor: '#000000',
            strokeWidth: Math.max(3, Math.round(fontSize * 0.25)),
            fontSize,
            fontFamily: "'Press Start 2P', 'Outfit', monospace, sans-serif",
            scale: 1.4, // Initial punch scale
            startScale: 1.4,
            endScale: 1.0,
            alpha: 1.0,
            startAlpha: 1.0,
            endAlpha: 0.0,
            life: 0,
            maxLife: 0.85
        });
    }

    /**
     * Emits multicolored exploding starbursts for victory sequences.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     * @param {number} count - Spark count per firework burst
     */
    emitFireworks(x, y, count = 38) {
        const palette = ['#ff0055', '#00f0ff', '#ffe600', '#00ff66', '#ff00ea', '#ffffff', '#ff9900'];
        const chosenPalette = [
            palette[Math.floor(Math.random() * palette.length)],
            palette[Math.floor(Math.random() * palette.length)],
            '#ffffff'
        ];

        // Central burst
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 240 + 70;
            const size = Math.random() * 3 + 3;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 95, // Gravity curves the fireworks downward gracefully
                friction: 0.965,
                size,
                startSize: size,
                endSize: 1.0,
                color: chosenPalette[Math.floor(Math.random() * chosenPalette.length)],
                alpha: 1.0,
                startAlpha: 1.0,
                endAlpha: 0.0,
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 8,
                life: 0,
                maxLife: Math.random() * 0.35 + 0.75,
                shape: i % 2 === 0 ? 'star' : 'diamond'
            });
        }

        // Add a central flash ring
        this.rings.push({
            x,
            y,
            radius: 4,
            startRadius: 4,
            maxRadius: 55,
            lineWidth: 3,
            startWidth: 3,
            endWidth: 0.5,
            color: chosenPalette[0],
            alpha: 0.9,
            startAlpha: 0.9,
            endAlpha: 0.0,
            life: 0,
            maxLife: 0.35
        });
    }

    /**
     * Additional juice helper: Directional sparks when hitting walls / bouncing.
     */
    emitHitSparks(x, y, normalX = 0, normalY = -1, color = '#ffea00', count = 8) {
        const baseAngle = Math.atan2(normalY, normalX);
        for (let i = 0; i < count; i++) {
            const spread = (Math.random() - 0.5) * 1.4;
            const angle = baseAngle + spread;
            const speed = Math.random() * 140 + 60;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 160,
                friction: 0.95,
                size: 3,
                startSize: 3,
                endSize: 1,
                color,
                alpha: 1.0,
                startAlpha: 1.0,
                endAlpha: 0.0,
                rotation: angle,
                vRot: 0,
                life: 0,
                maxLife: Math.random() * 0.15 + 0.25,
                shape: 'spark'
            });
        }
    }

    /**
     * Additional juice helper: Ghost speed trail.
     */
    emitTrail(x, y, width = 24, height = 32, color = '#00f0ff', alpha = 0.4) {
        this.particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            gravity: 0,
            friction: 1.0,
            size: width,
            startSize: width,
            endSize: width * 0.85,
            height,
            color,
            alpha,
            startAlpha: alpha,
            endAlpha: 0.0,
            rotation: 0,
            vRot: 0,
            life: 0,
            maxLife: 0.18,
            shape: 'trail'
        });
    }

    // ==========================================
    // SIMULATION UPDATE
    // ==========================================

    /**
     * Updates all active particles, rings, and floating texts.
     * @param {number} dt - Delta time in seconds (e.g. 1/60 = 0.0166)
     */
    update(dt) {
        // Guard against massive dt spikes (e.g. tab switches)
        const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);

        // 1. Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += safeDt;

            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }

            const t = p.life / p.maxLife; // 0 to 1 progress

            // Physics integration
            p.vy += p.gravity * safeDt;
            p.vx *= Math.pow(p.friction, safeDt * 60);
            p.vy *= Math.pow(p.friction, safeDt * 60);
            p.x += p.vx * safeDt;
            p.y += p.vy * safeDt;
            p.rotation += p.vRot * safeDt;

            // Interpolate size & alpha
            p.size = p.startSize + (p.endSize - p.startSize) * t;
            p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * t;
        }

        // 2. Update Shockwave Rings
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life += safeDt;

            if (r.life >= r.maxLife) {
                this.rings.splice(i, 1);
                continue;
            }

            const t = r.life / r.maxLife;
            // Ease out expansion
            const easeOut = 1 - Math.pow(1 - t, 2);
            r.radius = r.startRadius + (r.maxRadius - r.startRadius) * easeOut;
            r.lineWidth = r.startWidth + (r.endWidth - r.startWidth) * t;
            r.alpha = r.startAlpha + (r.endAlpha - r.startAlpha) * t;
        }

        // 3. Update Floating Text Popups
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life += safeDt;

            if (ft.life >= ft.maxLife) {
                this.floatingTexts.splice(i, 1);
                continue;
            }

            const t = ft.life / ft.maxLife;

            ft.x += ft.vx * safeDt;
            ft.y += ft.vy * safeDt;

            // Punch scale settles quickly (first 25% of life)
            if (t < 0.25) {
                const subT = t / 0.25;
                ft.scale = ft.startScale + (ft.endScale - ft.startScale) * subT;
            } else {
                ft.scale = ft.endScale;
            }

            // Alpha fades out in the last 40% of lifetime
            if (t > 0.6) {
                const fadeT = (t - 0.6) / 0.4;
                ft.alpha = ft.startAlpha + (ft.endAlpha - ft.startAlpha) * fadeT;
            } else {
                ft.alpha = ft.startAlpha;
            }
        }
    }

    // ==========================================
    // RENDERING
    // ==========================================

    /**
     * Renders all active particles, rings, and floating texts relative to camera.
     * @param {CanvasRenderingContext2D} ctx - 2D Canvas rendering context
     * @param {object|null} camera - Optional camera object with { x, y, width, height }
     */
    render(ctx, camera = null) {
        if (!ctx) return;

        const camX = camera ? (camera.x || 0) : 0;
        const camY = camera ? (camera.y || 0) : 0;
        const viewportW = camera ? (camera.width || camera.viewportWidth || 10000) : 10000;
        const viewportH = camera ? (camera.height || camera.viewportHeight || 10000) : 10000;
        const margin = 60; // culling boundary padding

        ctx.save();

        // 1. Render Shockwave Rings
        for (let i = 0; i < this.rings.length; i++) {
            const r = this.rings[i];
            const screenX = r.x - camX;
            const screenY = r.y - camY;

            // Viewport culling
            if (screenX + r.radius < -margin || screenX - r.radius > viewportW + margin ||
                screenY + r.radius < -margin || screenY - r.radius > viewportH + margin) {
                continue;
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, r.alpha));
            ctx.beginPath();
            ctx.arc(screenX, screenY, Math.max(0.5, r.radius), 0, Math.PI * 2);
            ctx.lineWidth = Math.max(0.5, r.lineWidth);
            ctx.strokeStyle = r.color;
            ctx.stroke();
            ctx.restore();
        }

        // 2. Render Particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const screenX = p.x - camX;
            const screenY = p.y - camY;

            // Viewport culling
            if (screenX + p.size < -margin || screenX - p.size > viewportW + margin ||
                screenY + p.size < -margin || screenY - p.size > viewportH + margin) {
                continue;
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.translate(screenX, screenY);
            if (p.rotation !== 0) {
                ctx.rotate(p.rotation);
            }

            ctx.fillStyle = p.color;

            if (p.shape === 'circle' || p.shape === 'smoke') {
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'square') {
                const half = Math.max(0.5, p.size / 2);
                ctx.fillRect(-half, -half, p.size, p.size);
            } else if (p.shape === 'shard') {
                // Sharp angular triangle
                ctx.beginPath();
                ctx.moveTo(0, -p.size * 1.2);
                ctx.lineTo(p.size * 0.7, p.size * 0.8);
                ctx.lineTo(-p.size * 0.7, p.size * 0.8);
                ctx.closePath();
                ctx.fill();
            } else if (p.shape === 'star') {
                // 4-pointed twinkling star
                const s = Math.max(1, p.size);
                ctx.beginPath();
                ctx.moveTo(0, -s * 1.4);
                ctx.quadraticCurveTo(0, 0, s * 1.4, 0);
                ctx.quadraticCurveTo(0, 0, 0, s * 1.4);
                ctx.quadraticCurveTo(0, 0, -s * 1.4, 0);
                ctx.quadraticCurveTo(0, 0, 0, -s * 1.4);
                ctx.fill();
            } else if (p.shape === 'diamond') {
                // Diamond sparkle
                const s = Math.max(1, p.size);
                ctx.beginPath();
                ctx.moveTo(0, -s * 1.2);
                ctx.lineTo(s * 0.8, 0);
                ctx.lineTo(0, s * 1.2);
                ctx.lineTo(-s * 0.8, 0);
                ctx.closePath();
                ctx.fill();
            } else if (p.shape === 'spark') {
                // Fast streak spark
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'trail') {
                // Ghost trail silhouette
                const w = p.size;
                const h = p.height || (p.size * 1.3);
                ctx.fillRect(-w / 2, -h / 2, w, h);
            }

            ctx.restore();
        }

        // 3. Render Floating Score/Combo Texts
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const ft = this.floatingTexts[i];
            const screenX = ft.x - camX;
            const screenY = ft.y - camY;

            // Viewport culling
            if (screenX < -margin || screenX > viewportW + margin ||
                screenY < -margin || screenY > viewportH + margin) {
                continue;
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
            ctx.translate(screenX, screenY);
            ctx.scale(ft.scale, ft.scale);

            ctx.font = `bold ${ft.fontSize}px ${ft.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Crisp dark outline for max legibility over any background
            ctx.lineJoin = 'miter';
            ctx.miterLimit = 2;
            ctx.strokeStyle = ft.strokeColor;
            ctx.lineWidth = ft.strokeWidth;
            ctx.strokeText(ft.text, 0, 0);

            // Colored inner text
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, 0, 0);

            ctx.restore();
        }

        ctx.restore();
    }
}

export default ParticleSystem;
