/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Core Engine Loop & Time Management
 * ============================================================================
 * Fixed-timestep delta update loop with nominal 60 FPS scaling, requestAnimationFrame,
 * pause handling, frame stepping, FPS calculation, and spiral-of-death clamping.
 */

export const NOMINAL_FPS = 60;
export const NOMINAL_INTERVAL = 1000 / NOMINAL_FPS; // ~16.666667 ms
export const MAX_DT = 200; // Clamping upper limit in ms to prevent physics glitches

export class Engine {
    /**
     * @param {Object} options
     * @param {HTMLCanvasElement} [options.canvas]
     * @param {Function} [options.update] - update callback: (du, dt) => void
     * @param {Function} [options.render] - render callback: (ctx, alpha) => void
     * @param {boolean} [options.fixedTimestep=false] - whether to run fixed sub-stepping
     * @param {number} [options.maxSubSteps=5] - max sub-steps for fixed timestep accumulator
     */
    constructor(options = {}) {
        this.canvas = options.canvas || null;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        this.updateCallback = options.update || null;
        this.renderCallback = options.render || null;
        this.onPauseChange = options.onPauseChange || null;

        this.fixedTimestep = options.fixedTimestep || false;
        this.maxSubSteps = options.maxSubSteps || 5;

        // Lifecycle & State
        this.isRunning = false;
        this.isPaused = false;
        this.isStepping = false; // Flag for single-frame stepping
        this.animationFrameId = null;

        // Time tracking
        this.lastTime = 0;
        this.totalTime = 0; // Total active game time in seconds
        this.frameCount = 0;
        this.du = 1.0; // Nominal delta factor (1.0 at 60 FPS)
        this.dt = NOMINAL_INTERVAL; // Raw delta in ms
        this.accumulator = 0; // For fixed timestep physics

        // Performance & FPS tracking
        this.fps = NOMINAL_FPS;
        this.fpsSmoothed = NOMINAL_FPS;
        this.fpsUpdateTimer = 0;
        this.fpsFramesCounted = 0;
        this.instantFps = NOMINAL_FPS;

        // Bind main loop to retain context
        this._loop = this._loop.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);

        // Listen for tab focus/blur to prevent huge dt spikes
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this._handleVisibilityChange);
        }
    }

    /**
     * Set or replace the canvas and 2d context.
     * @param {HTMLCanvasElement} canvas
     */
    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
    }

    /**
     * Set the update callback.
     * @param {Function} callback - (du, dt) => void
     */
    setUpdate(callback) {
        this.updateCallback = callback;
    }

    /**
     * Set the render callback.
     * @param {Function} callback - (ctx, alpha) => void
     */
    setRender(callback) {
        this.renderCallback = callback;
    }

    /**
     * Starts the main engine loop.
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.animationFrameId = requestAnimationFrame(this._loop);
    }

    /**
     * Stops the engine loop.
     */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Pauses the simulation update. Rendering continues.
     */
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        if (this.onPauseChange) this.onPauseChange(true);
    }

    /**
     * Resumes the simulation update.
     */
    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.lastTime = performance.now(); // Reset lastTime so delta doesn't jump
        if (this.onPauseChange) this.onPauseChange(false);
    }

    /**
     * Toggles pause state.
     * @returns {boolean} New pause state
     */
    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
        return this.isPaused;
    }

    /**
     * Steps the simulation forward by a single nominal frame while paused.
     */
    stepFrame() {
        if (!this.isPaused) {
            this.pause();
        }
        this.isStepping = true;
    }

    /**
     * Internal animation frame loop.
     * @param {DOMHighResTimeStamp} currentTime
     */
    _loop(currentTime) {
        if (!this.isRunning) return;

        // Calculate delta time
        let dt = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Clamp large dt (tab switching, debugging, lag spikes)
        if (dt > MAX_DT) {
            dt = NOMINAL_INTERVAL;
        }
        if (dt < 0) {
            dt = 0;
        }

        this.dt = dt;
        this.du = dt / NOMINAL_INTERVAL;

        // FPS Calculations
        this._updateFPS(dt);

        // Simulation Update
        const shouldUpdate = !this.isPaused || this.isStepping;

        if (shouldUpdate) {
            if (this.fixedTimestep) {
                // Fixed-timestep sub-stepping with accumulator
                this.accumulator += dt;
                let steps = 0;
                while (this.accumulator >= NOMINAL_INTERVAL && steps < this.maxSubSteps) {
                    if (this.updateCallback) {
                        this.updateCallback(1.0, NOMINAL_INTERVAL);
                    }
                    this.accumulator -= NOMINAL_INTERVAL;
                    this.totalTime += NOMINAL_INTERVAL / 1000;
                    steps++;
                }
                // Discard excess accumulated time to prevent spiral of death
                if (steps >= this.maxSubSteps) {
                    this.accumulator = 0;
                }
            } else {
                // Variable delta factor 'du' based on nominal 60 FPS
                const nominalDu = this.isStepping ? 1.0 : this.du;
                const updateDt = this.isStepping ? NOMINAL_INTERVAL : dt;

                if (this.updateCallback) {
                    this.updateCallback(nominalDu, updateDt);
                }
                this.totalTime += updateDt / 1000;
            }

            this.frameCount++;
            this.isStepping = false; // Reset single step flag
        }

        // Render pass
        if (this.renderCallback && this.ctx) {
            const alpha = this.fixedTimestep ? (this.accumulator / NOMINAL_INTERVAL) : 1.0;
            this.renderCallback(this.ctx, alpha);
        }

        // Request next frame
        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame(this._loop);
        }
    }

    /**
     * Compute instantaneous and smoothed frames per second.
     * @param {number} dt - delta time in ms
     */
    _updateFPS(dt) {
        if (dt > 0) {
            this.instantFps = 1000 / dt;
            // Exponential moving average for smooth display
            this.fpsSmoothed = (this.fpsSmoothed * 0.9) + (this.instantFps * 0.1);
        }

        this.fpsFramesCounted++;
        this.fpsUpdateTimer += dt;
        if (this.fpsUpdateTimer >= 1000) {
            this.fps = this.fpsFramesCounted;
            this.fpsFramesCounted = 0;
            this.fpsUpdateTimer = 0;
        }
    }

    /**
     * Handle visibility change to automatically mitigate time jumps.
     */
    _handleVisibilityChange() {
        if (document.hidden) {
            // Optional: Auto pause or just reset timestamp
        } else {
            this.lastTime = performance.now();
            this.accumulator = 0;
        }
    }

    /**
     * Destroy engine and remove listeners.
     */
    destroy() {
        this.stop();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this._handleVisibilityChange);
        }
    }
}
