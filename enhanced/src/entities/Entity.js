/**
 * Entity.js - Base Entity class for The Game Enhanced Edition
 * Provides core spatial, physical, and rendering lifecycle primitives
 * for all interactive game objects (Player, Baddies, Collectibles, Hazards, etc.)
 */

export class Entity {
    /**
     * @param {Object} options Configuration descriptor
     * @param {number} [options.x=0] - Top-left X coordinate
     * @param {number} [options.y=0] - Top-left Y coordinate
     * @param {number} [options.width=24] - Entity width in pixels
     * @param {number} [options.height=24] - Entity height in pixels
     * @param {number} [options.vx=0] - Initial horizontal velocity (px/s)
     * @param {number} [options.vy=0] - Initial vertical velocity (px/s)
     * @param {number} [options.radius] - Collision radius (defaults to half max dimension)
     * @param {string} [options.tag='entity'] - Entity type identifier
     * @param {number} [options.layer=0] - Render layer / z-index
     */
    constructor(options = {}) {
        this.x = options.x ?? options.cx ?? 0;
        this.y = options.y ?? options.cy ?? 0;
        this.width = options.width ?? 24;
        this.height = options.height ?? 24;

        // If cx/cy were explicitly passed, adjust x/y so center is at cx/cy
        if (options.cx !== undefined && options.x === undefined) {
            this.x = options.cx - this.width / 2;
        }
        if (options.cy !== undefined && options.y === undefined) {
            this.y = options.cy - this.height / 2;
        }

        // Velocities (in pixels per second)
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? 0;

        // Accelerations / external forces
        this.ax = options.ax ?? 0;
        this.ay = options.ay ?? 0;

        // Collision radius
        this._radius = options.radius ?? Math.max(this.width, this.height) / 2;

        // Lifecycle & identity
        this.alive = true;
        this.tag = options.tag ?? 'entity';
        this.layer = options.layer ?? 0;

        // Transform properties
        this.scaleX = 1;
        this.scaleY = 1;
        this.rotation = 0; // in radians
        this.opacity = 1;
        this.visible = true;

        // Visual sprite (if any)
        this.sprite = options.sprite ?? null;

        // Initial spawn state for resets
        this.spawnX = this.x;
        this.spawnY = this.y;
        this.spawnVx = this.vx;
        this.spawnVy = this.vy;

        // Sub-step and collision resolution flags
        this.isGrounded = false;
        this.collidable = options.collidable ?? true;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
    }

    // ==========================================
    // Positional Getters & Setters
    // ==========================================

    /** Center X coordinate */
    get cx() {
        return this.x + this.width / 2;
    }
    set cx(val) {
        this.x = val - this.width / 2;
    }

    /** Center Y coordinate */
    get cy() {
        return this.y + this.height / 2;
    }
    set cy(val) {
        this.y = val - this.height / 2;
    }

    /** Center position object */
    get center() {
        return { x: this.cx, y: this.cy };
    }

    /** Collision radius */
    get radius() {
        return this._radius ?? Math.max(this.width, this.height) / 2;
    }
    set radius(val) {
        this._radius = val;
    }

    /** Bounding box coordinates */
    get left() {
        return this.x;
    }
    get right() {
        return this.x + this.width;
    }
    get top() {
        return this.y;
    }
    get bottom() {
        return this.y + this.height;
    }

    /**
     * Returns an AABB object
     * @returns {{x: number, y: number, width: number, height: number, left: number, right: number, top: number, bottom: number, cx: number, cy: number}}
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            left: this.left,
            right: this.right,
            top: this.top,
            bottom: this.bottom,
            cx: this.cx,
            cy: this.cy
        };
    }

    // ==========================================
    // Collision Detection Methods
    // ==========================================

    /**
     * Axis-Aligned Bounding Box (AABB) intersection check
     * @param {Entity|Object} other 
     * @param {number} [padding=0] - Optional inset / outset padding for collision box
     * @returns {boolean}
     */
    intersects(other, padding = 0) {
        if (!other || !other.alive) return false;
        
        const b1 = this.getBounds();
        const b2 = typeof other.getBounds === 'function' ? other.getBounds() : other;

        return (
            b1.left + padding < b2.right &&
            b1.right - padding > b2.left &&
            b1.top + padding < b2.bottom &&
            b1.bottom - padding > b2.top
        );
    }

    /**
     * Circle-to-Circle collision check
     * @param {Entity|Object} other
     * @returns {boolean}
     */
    intersectsCircle(other) {
        if (!other || !other.alive) return false;

        const otherCx = other.cx ?? (other.x + (other.width || 0) / 2);
        const otherCy = other.cy ?? (other.y + (other.height || 0) / 2);
        const otherRadius = other.radius ?? (Math.max(other.width || 0, other.height || 0) / 2);

        const dx = this.cx - otherCx;
        const dy = this.cy - otherCy;
        const distSq = dx * dx + dy * dy;
        const radSum = this.radius + otherRadius;

        return distSq < (radSum * radSum);
    }

    /**
     * Point containment check
     * @param {number} px
     * @param {number} py
     * @returns {boolean}
     */
    containsPoint(px, py) {
        return (
            px >= this.x &&
            px <= this.x + this.width &&
            py >= this.y &&
            py <= this.y + this.height
        );
    }

    /**
     * Euclidean distance to another entity or point
     * @param {Entity|{x: number, y: number}} other
     * @returns {number}
     */
    distanceTo(other) {
        const ox = other.cx ?? other.x;
        const oy = other.cy ?? other.y;
        const dx = this.cx - ox;
        const dy = this.cy - oy;
        return Math.hypot(dx, dy);
    }

    /**
     * Angle in radians towards another entity or point
     * @param {Entity|{x: number, y: number}} other
     * @returns {number}
     */
    angleTo(other) {
        const ox = other.cx ?? other.x;
        const oy = other.cy ?? other.y;
        return Math.atan2(oy - this.cy, ox - this.cx);
    }

    // ==========================================
    // Lifecycle & State Methods
    // ==========================================

    /**
     * Updates entity position and timers
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
        if (!this.alive) return;

        // Apply acceleration to velocity
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;

        // Apply velocity to position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Invulnerability timer countdown
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= dt;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
                this.invulnerableTimer = 0;
            }
        }
    }

    /**
     * Standard rendering wrapper with transforms
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} [camera=null]
     */
    render(ctx, camera = null) {
        if (!this.alive || !this.visible || this.opacity <= 0) return;

        // Flicker effect when invulnerable
        if (this.invulnerable && Math.floor(Date.now() / 60) % 2 === 0) {
            return;
        }

        ctx.save();

        if (this.opacity < 1) {
            ctx.globalAlpha = this.opacity;
        }

        // Apply translation to entity center for rotation and scale
        ctx.translate(Math.round(this.cx), Math.round(this.cy));

        if (this.rotation !== 0) {
            ctx.rotate(this.rotation);
        }

        if (this.scaleX !== 1 || this.scaleY !== 1) {
            ctx.scale(this.scaleX, this.scaleY);
        }

        // Draw custom entity graphics
        this.draw(ctx);

        ctx.restore();
    }

    /**
     * Override in subclasses to draw specific visuals centered around (0, 0)
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (this.sprite && this.sprite.draw) {
            this.sprite.draw(ctx, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Default placeholder box
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
    }

    /**
     * Mark entity as dead / ready for garbage cleanup
     */
    kill() {
        this.alive = false;
    }

    /**
     * Resets entity back to its initial spawn configuration
     */
    reset() {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.vx = this.spawnVx;
        this.vy = this.spawnVy;
        this.ax = 0;
        this.ay = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.rotation = 0;
        this.opacity = 1;
        this.alive = true;
        this.isGrounded = false;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
    }
}

export default Entity;
