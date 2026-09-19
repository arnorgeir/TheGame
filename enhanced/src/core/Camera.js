/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * 2D Viewport Camera System
 * ============================================================================
 * Features:
 * - Smooth lerp damping (framerate-independent with nominal du)
 * - Level bounding box clamping (minX, maxX, minY, maxY)
 * - Velocity & facing-direction look-ahead offset
 * - Trauma/decay based screen shake system
 * - World-to-Screen and Screen-to-World coordinate converters
 * - Context transformation helper (begin / end) with sub-pixel snap
 */

export class Camera {
    /**
     * @param {Object} options
     * @param {number} [options.viewportWidth=800]
     * @param {number} [options.viewportHeight=600]
     * @param {number} [options.lerpFactor=0.1] - Lerp damping factor per nominal frame
     * @param {number} [options.zoom=1.0] - Viewport zoom factor
     * @param {number} [options.lookAheadDistance=80] - Look-ahead offset distance
     * @param {number} [options.lookAheadDamping=0.08] - Look-ahead transition damping
     */
    constructor(options = {}) {
        this.viewportWidth = options.viewportWidth || 800;
        this.viewportHeight = options.viewportHeight || 600;
        this.zoom = options.zoom || 1.0;
        this.lerpFactor = options.lerpFactor ?? 0.1;

        // Current Camera Center in world coordinates
        this.x = this.viewportWidth / 2;
        this.y = this.viewportHeight / 2;

        // Target tracking
        this.target = null; // Can be an entity with { cx/x, cy/y, facing, vx/xVel }
        this.targetX = this.x;
        this.targetY = this.y;

        // Look-ahead system
        this.lookAheadDistance = options.lookAheadDistance ?? 80;
        this.lookAheadDamping = options.lookAheadDamping ?? 0.08;
        this.lookAheadOffsetX = 0;
        this.targetLookAheadX = 0;

        // World Bounding Box
        this.bounds = {
            minX: 0,
            maxX: Infinity,
            minY: 0,
            maxY: Infinity
        };
        this.hasBounds = false;

        // Screen Shake System
        this.shakeTimer = 0;
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        this.shakeFrequency = 30; // Hz
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeTrauma = 0; // 0.0 to 1.0
    }

    /**
     * Set viewport dimensions (e.g. on canvas resize).
     * @param {number} width
     * @param {number} height
     */
    setViewport(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    /**
     * Set bounding box for camera movement.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    setBounds(minX, minY, maxX, maxY) {
        this.bounds.minX = minX;
        this.bounds.minY = minY;
        this.bounds.maxX = maxX;
        this.bounds.maxY = maxY;
        this.hasBounds = true;
    }

    /**
     * Clear camera bounds.
     */
    clearBounds() {
        this.bounds.minX = 0;
        this.bounds.maxX = Infinity;
        this.bounds.minY = 0;
        this.bounds.maxY = Infinity;
        this.hasBounds = false;
    }
    /**
     * Follow an entity or custom target object, or directly set the camera
     * target position when called with (x, y [, dt]).
     * @param {Object|number} targetOrX - Target entity, or X coordinate
     * @param {number} [y] - Y coordinate (when called with numbers)
     * @param {number} [dt] - Delta time (unused, for caller compatibility)
     */
    follow(targetOrX, y, dt) {
        if (typeof targetOrX === 'number') {
            // Called as follow(x, y, dt) — direct position tracking
            this.target = null;
            this.targetX = targetOrX;
            this.targetY = y;
        } else {
            // Called as follow(target) — entity tracking
            this.target = targetOrX;
        }
    }

    /**
     * Convenience alias for setBounds, matching the level code's API.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    clamp(minX, minY, maxX, maxY) {
        this.setBounds(minX, minY, maxX, maxY);
        this._clampToBounds();
    }

    /**
     * Immediately snap camera center to coordinates (alias for teleport).
     * @param {number} x
     * @param {number} y
     */
    snapTo(x, y) {
        this.teleport(x, y);
    }

    /**
     * Immediately teleport camera center to coordinates.
     * @param {number} x
     * @param {number} y
     */
    teleport(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.lookAheadOffsetX = 0;
        this.targetLookAheadX = 0;
        this._clampToBounds();
    }

    /**
     * Triggers screen shake.
     * @param {number} durationMs - Duration of shake in milliseconds (e.g. 200)
     * @param {number} intensity - Max pixel offset (e.g. 10)
     */
    shake(durationMs = 250, intensity = 8) {
        this.shakeDuration = Math.max(durationMs / 1000, 0.01);
        this.shakeTimer = this.shakeDuration;
        this.shakeIntensity = intensity;
        this.shakeTrauma = 1.0;
    }

    /**
     * Update camera position, lerp damping, lookahead, and shake.
     * @param {number} du - nominal delta factor (1.0 at 60 FPS)
     */
    update(du = 1.0) {
        // Extract target position
        if (this.target) {
            const targetX = this.target.x ?? this.target.cx ?? this.x;
            const targetY = this.target.y ?? this.target.cy ?? this.y;

            // Compute look-ahead offset based on facing or velocity
            let facing = 0;
            if (typeof this.target.facing === 'number') {
                facing = this.target.facing; // 1 for right, -1 for left
            } else if (typeof this.target.vx === 'number' && Math.abs(this.target.vx) > 0.5) {
                facing = Math.sign(this.target.vx);
            } else if (typeof this.target.xVel === 'number' && Math.abs(this.target.xVel) > 0.5) {
                facing = Math.sign(this.target.xVel);
            }

            this.targetLookAheadX = facing * this.lookAheadDistance;
            
            // Damped lookahead interpolation
            const lookAheadFactor = 1 - Math.pow(1 - this.lookAheadDamping, du);
            this.lookAheadOffsetX += (this.targetLookAheadX - this.lookAheadOffsetX) * lookAheadFactor;

            this.targetX = targetX + this.lookAheadOffsetX;
            this.targetY = targetY;
        }

        // Framerate-independent exponential lerp
        const dampFactor = 1 - Math.pow(1 - this.lerpFactor, du);
        this.x += (this.targetX - this.x) * dampFactor;
        this.y += (this.targetY - this.y) * dampFactor;

        // Apply bounding box constraints
        this._clampToBounds();

        // Update Screen Shake
        this._updateShake(du);
    }

    /**
     * Clamps the camera center so the viewport stays within bounds.
     */
    _clampToBounds() {
        if (!this.hasBounds) return;

        const halfW = (this.viewportWidth / (2 * this.zoom));
        const halfH = (this.viewportHeight / (2 * this.zoom));

        const minCenterX = this.bounds.minX + halfW;
        const maxCenterX = this.bounds.maxX - halfW;
        const minCenterY = this.bounds.minY + halfH;
        const maxCenterY = this.bounds.maxY - halfH;

        if (minCenterX <= maxCenterX) {
            this.x = Math.max(minCenterX, Math.min(maxCenterX, this.x));
        } else {
            // Level is narrower than viewport: center horizontally
            this.x = (this.bounds.minX + this.bounds.maxX) / 2;
        }

        if (minCenterY <= maxCenterY) {
            this.y = Math.max(minCenterY, Math.min(maxCenterY, this.y));
        } else {
            // Level is shorter than viewport: center vertically
            this.y = (this.bounds.minY + this.bounds.maxY) / 2;
        }
    }

    /**
     * Decays screen shake and calculates random displacement.
     * @param {number} du
     */
    _updateShake(du) {
        if (this.shakeTimer > 0) {
            const dtSec = (du * 16.666) / 1000;
            this.shakeTimer -= dtSec;

            if (this.shakeTimer <= 0) {
                this.shakeTimer = 0;
                this.shakeOffsetX = 0;
                this.shakeOffsetY = 0;
                this.shakeTrauma = 0;
                return;
            }

            // Trauma decay
            const decay = this.shakeTimer / this.shakeDuration;
            const currentIntensity = this.shakeIntensity * (decay * decay); // Quadratic falloff

            // Perlin-like pseudo-random displacement
            const angle = Math.random() * Math.PI * 2;
            const dist = (Math.random() * 0.8 + 0.2) * currentIntensity;
            this.shakeOffsetX = Math.cos(angle) * dist;
            this.shakeOffsetY = Math.sin(angle) * dist;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    /**
     * Get top-left coordinate of the camera viewport in world space.
     * @returns {{x: number, y: number}}
     */
    getTopLeft() {
        const halfW = this.viewportWidth / (2 * this.zoom);
        const halfH = this.viewportHeight / (2 * this.zoom);
        return {
            x: this.x - halfW + this.shakeOffsetX,
            y: this.y - halfH + this.shakeOffsetY
        };
    }

    /**
     * Convert World coordinates to Screen coordinates.
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{x: number, y: number}}
     */
    worldToScreen(worldX, worldY) {
        const topLeft = this.getTopLeft();
        return {
            x: (worldX - topLeft.x) * this.zoom,
            y: (worldY - topLeft.y) * this.zoom
        };
    }

    /**
     * Convert Screen coordinates to World coordinates.
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToWorld(screenX, screenY) {
        const topLeft = this.getTopLeft();
        return {
            x: (screenX / this.zoom) + topLeft.x,
            y: (screenY / this.zoom) + topLeft.y
        };
    }

    /**
     * Returns world bounding box of visible viewport for frustum culling.
     * @param {number} [padding=64] - Extra margin for culling
     * @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}}
     */
    getViewportBounds(padding = 64) {
        const topLeft = this.getTopLeft();
        const width = (this.viewportWidth / this.zoom) + (padding * 2);
        const height = (this.viewportHeight / this.zoom) + (padding * 2);
        return {
            left: topLeft.x - padding,
            top: topLeft.y - padding,
            right: topLeft.x + width,
            bottom: topLeft.y + height,
            width,
            height
        };
    }

    /**
     * Applies camera viewport transformation to 2D canvas context.
     * Call before rendering world entities.
     * @param {CanvasRenderingContext2D} ctx
     */
    begin(ctx) {
        const topLeft = this.getTopLeft();
        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        // Round to nearest integer to maintain crisp retro pixel art
        ctx.translate(-Math.round(topLeft.x), -Math.round(topLeft.y));
    }

    /**
     * Restores canvas context state after world rendering.
     * @param {CanvasRenderingContext2D} ctx
     */
    end(ctx) {
        ctx.restore();
    }
}
