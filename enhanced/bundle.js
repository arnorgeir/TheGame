/**
 * THE GAME! - ENHANCED EDITION BUNDLE
 * Auto-generated single file bundle for zero-dependency execution across file:// and http:// protocols.
 */
(function() {
'use strict';


// ==========================================
// Module: core/Engine.js
// ==========================================
/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Core Engine Loop & Time Management
 * ============================================================================
 * Fixed-timestep delta update loop with nominal 60 FPS scaling, requestAnimationFrame,
 * pause handling, frame stepping, FPS calculation, and spiral-of-death clamping.
 */
const NOMINAL_FPS = 60;
const NOMINAL_INTERVAL = 1000 / NOMINAL_FPS; // ~16.666667 ms
const MAX_DT = 200; // Clamping upper limit in ms to prevent physics glitches
class Engine {
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


// ==========================================
// Module: core/Input.js
// ==========================================
/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Universal Input Manager
 * ============================================================================
 * Supports Keyboard (Arrows + WASD), HTML5 Gamepad API, and Virtual Mobile Touch.
 * Provides both continuous state (isDown) and edge-triggered consumption (eat / isPressed).
 */
const Action = {
    LEFT: 'left',
    RIGHT: 'right',
    UP: 'up',
    DOWN: 'down',
    JUMP: 'jump',
    ACTION: 'action',
    DASH: 'dash',
    PAUSE: 'pause',
    STEP: 'step',
    MUTE: 'mute',
    FULLSCREEN: 'fullscreen',
    DEBUG: 'debug',
    RESTART: 'restart',
    SKIP_LEVEL: 'skipLevel'
};
class Input {
    constructor(options = {}) {
        this.targetElement = options.targetElement || (typeof window !== 'undefined' ? window : null);
        this.gamepadDeadzone = options.gamepadDeadzone || 0.25;
        this.gamepadIndex = options.gamepadIndex ?? null; // Auto-detect first active gamepad if null

        // Physical Keyboard states
        this.keys = new Map(); // KeyCode/Key -> boolean
        this.prevKeys = new Map();

        // High-level Actions states
        this.actions = new Map(); // ActionName -> boolean
        this.prevActions = new Map();
        this.eatenActions = new Set(); // Actions consumed until released

        // Virtual Touch & Custom synthetic inputs
        this.virtualActions = new Map();
        this.virtualAxes = {
            horizontal: 0,
            vertical: 0
        };

        // Default Action Key Map (Physical keys mapped to actions)
        this.actionBindings = {
            [Action.LEFT]: ['ArrowLeft', 'KeyA'],
            [Action.RIGHT]: ['ArrowRight', 'KeyD'],
            [Action.UP]: ['ArrowUp', 'KeyW'],
            [Action.DOWN]: ['ArrowDown', 'KeyS'],
            [Action.JUMP]: ['Space', 'KeyW', 'ArrowUp', 'KeyK'],
            [Action.ACTION]: ['KeyZ', 'KeyJ', 'ShiftLeft', 'ShiftRight', 'KeyX', 'Enter'],
            [Action.DASH]: ['ShiftLeft', 'ShiftRight', 'KeyC'],
            [Action.PAUSE]: ['KeyP', 'Escape'],
            [Action.STEP]: ['KeyO'],
            [Action.MUTE]: ['KeyM'],
            [Action.FULLSCREEN]: ['KeyF'],
            [Action.DEBUG]: ['F3', 'Backquote', 'KeyG'],
            [Action.RESTART]: ['KeyR'],
            [Action.SKIP_LEVEL]: ['KeyL']
        };

        // Gamepad standard button index mappings
        this.gamepadBindings = {
            [Action.JUMP]: [0], // 'A' on Xbox, 'Cross' on PlayStation
            [Action.ACTION]: [2], // 'X' on Xbox, 'Square' on PlayStation
            [Action.DASH]: [1, 5], // 'B' or Right Bumper
            [Action.PAUSE]: [9], // Start / Options
            [Action.UP]: [12], // D-pad Up
            [Action.DOWN]: [13], // D-pad Down
            [Action.LEFT]: [14], // D-pad Left
            [Action.RIGHT]: [15], // D-pad Right
            [Action.RESTART]: [8] // Select / Share
        };

        // Prevent default scrolling for keys like Space and Arrows
        this.preventDefaultKeys = new Set([
            'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'
        ]);

        // Bound event handlers
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onBlur = this._onBlur.bind(this);
        this._onGamepadConnected = this._onGamepadConnected.bind(this);
        this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);

        this._setupListeners();
    }

    /**
     * Attach DOM event listeners.
     */
    _setupListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', this._onKeyDown, { passive: false });
        window.addEventListener('keyup', this._onKeyUp, { passive: false });
        window.addEventListener('blur', this._onBlur);
        window.addEventListener('gamepadconnected', this._onGamepadConnected);
        window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    }

    /**
     * Remove DOM event listeners.
     */
    destroy() {
        if (typeof window === 'undefined') return;

        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('blur', this._onBlur);
        window.removeEventListener('gamepadconnected', this._onGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    }

    _onKeyDown(e) {
        if (this.preventDefaultKeys.has(e.code) || this.preventDefaultKeys.has(e.key)) {
            e.preventDefault();
        }

        this.keys.set(e.code, true);
        this.keys.set(e.key, true);
    }

    _onKeyUp(e) {
        this.keys.set(e.code, false);
        this.keys.set(e.key, false);
    }

    _onBlur() {
        // Reset all physical keys on window blur to avoid stuck inputs
        this.keys.clear();
        this.virtualActions.clear();
        this.eatenActions.clear();
        this.virtualAxes.horizontal = 0;
        this.virtualAxes.vertical = 0;
    }

    _onGamepadConnected(e) {
        console.log(`[Input] Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
        if (this.gamepadIndex === null) {
            this.gamepadIndex = e.gamepad.index;
        }
    }

    _onGamepadDisconnected(e) {
        console.log(`[Input] Gamepad disconnected from index ${e.gamepad.index}`);
        if (this.gamepadIndex === e.gamepad.index) {
            this.gamepadIndex = null;
        }
    }

    /**
     * Updates internal action states and polls gamepads.
     * Should be called at the beginning of each frame.
     */
    update() {
        // Copy current actions to prevActions for edge detection
        this.prevActions.clear();
        for (const [action, isDown] of this.actions.entries()) {
            this.prevActions.set(action, isDown);
        }

        // Poll Gamepad state
        const gamepadState = this._pollGamepad();

        // Evaluate all actions
        for (const action of Object.values(Action)) {
            const isDown = this._computeActionState(action, gamepadState);
            this.actions.set(action, isDown);

            // If action is released, remove it from eatenActions
            if (!isDown) {
                this.eatenActions.delete(action);
            }
        }
    }

    /**
     * Poll active gamepad from navigator.getGamepads().
     * @returns {Object|null}
     */
    _pollGamepad() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;

        const gamepads = navigator.getGamepads();
        let gp = null;

        if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
            gp = gamepads[this.gamepadIndex];
        } else {
            // Find first connected gamepad
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i] && gamepads[i].connected) {
                    gp = gamepads[i];
                    this.gamepadIndex = i;
                    break;
                }
            }
        }

        if (!gp) return null;

        // Process Left Stick Axes with deadzone
        let stickX = gp.axes[0] || 0;
        let stickY = gp.axes[1] || 0;

        if (Math.abs(stickX) < this.gamepadDeadzone) stickX = 0;
        if (Math.abs(stickY) < this.gamepadDeadzone) stickY = 0;

        return {
            buttons: gp.buttons,
            stickX,
            stickY
        };
    }

    /**
     * Compute whether an action is currently active across Keyboard, Gamepad, and Virtual Touch.
     * @param {string} action
     * @param {Object|null} gp
     * @returns {boolean}
     */
    _computeActionState(action, gp) {
        // 1. Virtual Touch Actions
        if (this.virtualActions.get(action)) {
            return true;
        }

        // 2. Keyboard bindings
        const keyCodes = this.actionBindings[action] || [];
        for (const code of keyCodes) {
            if (this.keys.get(code)) {
                return true;
            }
        }

        // 3. Gamepad buttons & stick simulation
        if (gp) {
            const btnIndices = this.gamepadBindings[action] || [];
            for (const idx of btnIndices) {
                if (gp.buttons[idx] && (gp.buttons[idx].pressed || gp.buttons[idx].value > 0.5)) {
                    return true;
                }
            }

            // Analog stick directions mapped to D-pad
            if (action === Action.LEFT && gp.stickX < -this.gamepadDeadzone) return true;
            if (action === Action.RIGHT && gp.stickX > this.gamepadDeadzone) return true;
            if (action === Action.UP && gp.stickY < -this.gamepadDeadzone) return true;
            if (action === Action.DOWN && gp.stickY > this.gamepadDeadzone) return true;
        }

        return false;
    }

    /**
     * Checks if an action is currently held down.
     * @param {string} action
     * @returns {boolean}
     */
    isDown(action) {
        return !!this.actions.get(action);
    }

    /**
     * Checks if a raw key is down.
     * @param {string} code
     * @returns {boolean}
     */
    isKeyDown(code) {
        return !!this.keys.get(code);
    }

    /**
     * Edge-triggered key press consumption.
     * Returns true ONLY ONCE per button press until the button is released.
     * @param {string} action
     * @returns {boolean}
     */
    eat(action) {
        const isCurrentlyDown = this.isDown(action);
        if (isCurrentlyDown && !this.eatenActions.has(action)) {
            this.eatenActions.add(action);
            return true;
        }
        return false;
    }

    /**
     * Returns true if action transitioned from UP to DOWN this frame.
     * @param {string} action
     * @returns {boolean}
     */
    isPressed(action) {
        return !!this.actions.get(action) && !this.prevActions.get(action);
    }

    /**
     * Returns true if action transitioned from DOWN to UP this frame.
     * @param {string} action
     * @returns {boolean}
     */
    isReleased(action) {
        return !this.actions.get(action) && !!this.prevActions.get(action);
    }

    /**
     * Returns directional axis value from -1.0 to 1.0.
     * @param {'horizontal'|'vertical'} axis
     * @returns {number}
     */
    getAxis(axis) {
        if (axis === 'horizontal') {
            let val = 0;
            if (this.isDown(Action.LEFT)) val -= 1;
            if (this.isDown(Action.RIGHT)) val += 1;
            if (this.virtualAxes.horizontal !== 0) {
                val = this.virtualAxes.horizontal;
            }
            return Math.max(-1, Math.min(1, val));
        }

        if (axis === 'vertical') {
            let val = 0;
            if (this.isDown(Action.UP)) val -= 1;
            if (this.isDown(Action.DOWN)) val += 1;
            if (this.virtualAxes.vertical !== 0) {
                val = this.virtualAxes.vertical;
            }
            return Math.max(-1, Math.min(1, val));
        }

        return 0;
    }

    /**
     * Returns a normalized 2D movement vector.
     * @returns {{x: number, y: number}}
     */
    getVector() {
        const x = this.getAxis('horizontal');
        const y = this.getAxis('vertical');
        const len = Math.hypot(x, y);

        if (len > 1.0) {
            return { x: x / len, y: y / len };
        }
        return { x, y };
    }

    /**
     * Virtual Touch control binding hook: set an action state.
     * @param {string} action
     * @param {boolean} isDown
     */
    setVirtualAction(action, isDown) {
        this.virtualActions.set(action, isDown);
    }

    /**
     * Virtual Touch control binding hook: set an axis state (-1.0 to 1.0).
     * @param {'horizontal'|'vertical'} axis
     * @param {number} value
     */
    setVirtualAxis(axis, value) {
        if (axis in this.virtualAxes) {
            this.virtualAxes[axis] = Math.max(-1, Math.min(1, value));
        }
    }

    /**
     * Rebind action to custom keys.
     * @param {string} action
     * @param {string[]} keys
     */
    rebind(action, keys) {
        if (this.actionBindings[action]) {
            this.actionBindings[action] = [...keys];
        }
    }
}

// Export singleton instance for convenience
const input = new Input();


// ==========================================
// Module: core/Camera.js
// ==========================================
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
class Camera {
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


// ==========================================
// Module: core/Storage.js
// ==========================================
/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Local Storage Manager & Persistence System
 * ============================================================================
 * Handles High Scores, Level Completion, Speedrun Best Times, Audio & Display Settings.
 * Automatically falls back to an in-memory store if localStorage is blocked or restricted.
 */

const STORAGE_PREFIX = 'thegame_enhanced_';

const DEFAULT_AUDIO_SETTINGS = {
    masterVolume: 0.8,
    sfxVolume: 0.85,
    musicVolume: 0.75,
    muted: false
};

const DEFAULT_DISPLAY_SETTINGS = {
    crtFilter: false,
    screenShake: true,
    showFps: false,
    virtualControls: 'auto' // 'auto' | 'always' | 'never'
};
class StorageManager {
    constructor() {
        this.isLocalStorageAvailable = this._checkLocalStorage();
        this.memoryStore = new Map();
    }

    /**
     * Test whether localStorage is accessible in the current browser context.
     * @private
     * @returns {boolean}
     */
    _checkLocalStorage() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            const testKey = '__storage_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn('[Storage] LocalStorage is unavailable (Private mode or blocked). Using in-memory fallback.');
            return false;
        }
    }

    /**
     * Get item from storage.
     * @param {string} key
     * @param {*} [defaultValue=null]
     * @returns {*}
     */
    get(key, defaultValue = null) {
        const fullKey = STORAGE_PREFIX + key;
        try {
            if (this.isLocalStorageAvailable) {
                const item = window.localStorage.getItem(fullKey);
                if (item === null) return defaultValue;
                return JSON.parse(item);
            } else {
                if (!this.memoryStore.has(fullKey)) return defaultValue;
                return this.memoryStore.get(fullKey);
            }
        } catch (e) {
            console.error(`[Storage] Failed to read key '${key}':`, e);
            return defaultValue;
        }
    }

    /**
     * Save item to storage.
     * @param {string} key
     * @param {*} value
     * @returns {boolean} Success status
     */
    set(key, value) {
        const fullKey = STORAGE_PREFIX + key;
        try {
            if (this.isLocalStorageAvailable) {
                window.localStorage.setItem(fullKey, JSON.stringify(value));
            } else {
                this.memoryStore.set(fullKey, value);
            }
            return true;
        } catch (e) {
            console.error(`[Storage] Failed to save key '${key}':`, e);
            // Fallback to memory
            this.memoryStore.set(fullKey, value);
            return false;
        }
    }

    /**
     * Remove item from storage.
     * @param {string} key
     */
    remove(key) {
        const fullKey = STORAGE_PREFIX + key;
        try {
            if (this.isLocalStorageAvailable) {
                window.localStorage.removeItem(fullKey);
            }
            this.memoryStore.delete(fullKey);
        } catch (e) {
            console.error(`[Storage] Failed to remove key '${key}':`, e);
        }
    }

    // =========================================================================
    // HIGH SCORES & LEADERBOARDS
    // =========================================================================

    /**
     * Retrieve high score for a specific level or overall.
     * @param {string|number} [levelId='overall']
     * @returns {number}
     */
    getHighScore(levelId = 'overall') {
        const scores = this.get('high_scores', {});
        return scores[levelId] || 0;
    }

    /**
     * Save high score if it surpasses existing record.
     * @param {number} score
     * @param {string|number} [levelId='overall']
     * @returns {boolean} True if new high score was set
     */
    saveHighScore(score, levelId = 'overall') {
        const scores = this.get('high_scores', {});
        const currentHigh = scores[levelId] || 0;

        if (score > currentHigh) {
            scores[levelId] = score;
            this.set('high_scores', scores);
            this._appendLeaderboardEntry(levelId, score);
            return true;
        }
        return false;
    }

    /**
     * Get top leaderboard scores for a level.
     * @param {string|number} [levelId='overall']
     * @returns {Array<{score: number, date: string, name: string}>}
     */
    getLeaderboard(levelId = 'overall') {
        const boards = this.get('leaderboards', {});
        return boards[levelId] || [];
    }

    /**
     * Internal helper to record top 10 leaderboard entries.
     */
    _appendLeaderboardEntry(levelId, score, name = 'HERO') {
        const boards = this.get('leaderboards', {});
        const list = boards[levelId] || [];

        list.push({
            score,
            name,
            date: new Date().toLocaleDateString()
        });

        // Sort descending and keep top 10
        list.sort((a, b) => b.score - a.score);
        boards[levelId] = list.slice(0, 10);

        this.set('leaderboards', boards);
    }

    // =========================================================================
    // BEST TIME / SPEEDRUN RECORDS
    // =========================================================================

    /**
     * Get best speedrun completion time in milliseconds.
     * @param {string|number} levelId
     * @returns {number|null} Time in ms, or null if uncompleted
     */
    getBestTime(levelId) {
        const times = this.get('best_times', {});
        return times[levelId] ?? null;
    }

    /**
     * Save best time if it beats the current record.
     * @param {string|number} levelId
     * @param {number} timeMs
     * @returns {boolean} True if new record set
     */
    saveBestTime(levelId, timeMs) {
        if (typeof timeMs !== 'number' || timeMs <= 0) return false;

        const times = this.get('best_times', {});
        const currentBest = times[levelId];

        if (currentBest === undefined || currentBest === null || timeMs < currentBest) {
            times[levelId] = timeMs;
            this.set('best_times', times);
            return true;
        }
        return false;
    }

    // =========================================================================
    // LEVEL PROGRESSION & UNLOCKS
    // =========================================================================

    /**
     * Check if a level has been completed.
     * @param {string|number} levelId
     * @returns {boolean}
     */
    hasCompletedLevel(levelId) {
        const completed = this.get('completed_levels', []);
        return completed.includes(levelId);
    }

    /**
     * Mark a level as completed and unlock next level.
     * @param {string|number} levelId
     */
    setCompletedLevel(levelId) {
        const completed = this.get('completed_levels', []);
        if (!completed.includes(levelId)) {
            completed.push(levelId);
            this.set('completed_levels', completed);
        }
    }

    // =========================================================================
    // AUDIO SETTINGS
    // =========================================================================

    /**
     * Get audio configuration.
     * @returns {{masterVolume: number, sfxVolume: number, musicVolume: number, muted: boolean}}
     */
    getAudioSettings() {
        return {
            ...DEFAULT_AUDIO_SETTINGS,
            ...(this.get('audio_settings', {}) || {})
        };
    }

    /**
     * Save audio configuration.
     * @param {Object} settings
     */
    saveAudioSettings(settings) {
        const current = this.getAudioSettings();
        const updated = { ...current, ...settings };
        this.set('audio_settings', updated);
        return updated;
    }

    // =========================================================================
    // DISPLAY & ACCESSIBILITY SETTINGS
    // =========================================================================

    /**
     * Get display & rendering settings.
     * @returns {Object}
     */
    getDisplaySettings() {
        return {
            ...DEFAULT_DISPLAY_SETTINGS,
            ...(this.get('display_settings', {}) || {})
        };
    }

    /**
     * Save display & rendering settings.
     * @param {Object} settings
     */
    saveDisplaySettings(settings) {
        const current = this.getDisplaySettings();
        const updated = { ...current, ...settings };
        this.set('display_settings', updated);
        return updated;
    }

    // =========================================================================
    // GENERAL SETTINGS & RESET
    // =========================================================================

    getSetting(key, defaultValue = null) {
        return this.get(`setting_${key}`, defaultValue);
    }

    saveSetting(key, value) {
        return this.set(`setting_${key}`, value);
    }

    /**
     * Clear all saved data for The Game.
     */
    clearAll() {
        if (this.isLocalStorageAvailable) {
            try {
                const keysToRemove = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (key && key.startsWith(STORAGE_PREFIX)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => window.localStorage.removeItem(k));
            } catch (e) {
                console.error('[Storage] Error clearing localStorage:', e);
            }
        }
        this.memoryStore.clear();
    }
}

// Export singleton instance
const storage = new StorageManager();


// ==========================================
// Module: audio/SoundSynth.js
// ==========================================
/**
 * SoundSynth.js
 * Procedural 8-bit Web Audio Synthesizer & Chiptune Music Generator
 * The Game! — Enhanced Edition
 * 
 * Features:
 * - Pure procedural sound synthesis (zero external audio files needed)
 * - Retro platformer sound effects (Jump, Coin, Stomp, Powerup, Hurt, Die, Boss Roar, Shockwave, Explosion, Victory)
 * - Multi-channel polyphonic Chiptune BGM Sequencer (Lead, Harmony/Arp, Bass, Noise Percussion)
 * - 4 Handcrafted Chiptune Tracks ('menu', 'level1', 'level2', 'boss')
 * - Automatic Browser Autoplay handling & seamless AudioContext unlock
 * - Master, SFX, and Music volume controls + mute toggle
 */
class SoundSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        this.volume = 0.8;
        this.sfxVolume = 0.85;
        this.musicVolume = 0.65;
        this.muted = false;

        this.noiseBuffer = null;
        this.currentTrack = null;
        this.isPlayingMusic = false;
        this.musicTimer = null;
        this.musicStep = 0;
        this.nextNoteTime = 0;
        this.activeMusicVoices = [];

        this._setupAutoplayUnlock();
    }

    /**
     * Initializes AudioContext and master routing graph on user gesture.
     */
    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return this.ctx;
        }

        try {
            const AudioContextClass = typeof window !== 'undefined'
                ? (window.AudioContext || window.webkitAudioContext)
                : (typeof AudioContext !== 'undefined' ? AudioContext : null);

            if (!AudioContextClass) {
                return null;
            }

            this.ctx = new AudioContextClass();

            // Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // SFX Gain Channel
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // Music Gain Channel
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            // Generate shared white noise buffer
            this._generateNoiseBuffer();

            return this.ctx;
        } catch (e) {
            console.warn('Failed to initialize AudioContext:', e);
            return null;
        }
    }

    /**
     * Ensures AudioContext is alive and resumed.
     */
    ensureContext() {
        if (!this.ctx) {
            this.init();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    /**
     * Hooks browser interaction events to unlock audio seamlessly.
     */
    _setupAutoplayUnlock() {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            this.ensureContext();
            if (this.ctx && this.ctx.state === 'running') {
                window.removeEventListener('pointerdown', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
                window.removeEventListener('click', unlock);
            }
        };

        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        window.addEventListener('touchstart', unlock, { passive: true });
        window.addEventListener('click', unlock, { passive: true });
    }

    /**
     * Precomputes a 2-second white noise buffer for drums, stomps, explosions.
     */
    _generateNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
    }

    // ==========================================
    // VOLUME & MUTE CONTROLS
    // ==========================================

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && this.ctx) {
            const target = this.muted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
        }
    }

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.03);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain && this.ctx) {
            const target = this.muted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
        }
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    // ==========================================
    // PROCEDURAL SOUND EFFECTS (SFX)
    // ==========================================

    /**
     * Retro frequency sweep upward (square wave).
     */
    playJump() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    /**
     * Double-tone high pitch chime (B5 -> E6).
     */
    playCoin() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Tone 1: B5 (987.77 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(987.77, now);
        gain1.gain.setValueAtTime(0.24, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(this.sfxGain);
        osc1.start(now);
        osc1.stop(now + 0.08);

        // Tone 2: E6 (1318.51 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1318.51, now + 0.08);
        gain2.gain.setValueAtTime(0.28, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.4);
    }

    /**
     * Impact bass thud + noise burst.
     */
    playStomp() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Bass punch (pitch drop)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.16);
        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.19);

        // Noise crack
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, now);
            filter.Q.setValueAtTime(2, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.sfxGain);
            noise.start(now);
            noise.stop(now + 0.1);
        }
    }

    /**
     * Rapid arpeggio chime (C-E-G-C).
     */
    playPowerup() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
        const step = 0.055;

        notes.forEach((freq, i) => {
            const noteStart = now + i * step;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = i === notes.length - 1 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(freq, noteStart);

            const duration = i === notes.length - 1 ? 0.3 : 0.08;
            gain.gain.setValueAtTime(0.22, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStart + duration);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(noteStart);
            osc.stop(noteStart + duration + 0.02);
        });
    }

    /**
     * Low dissonant crunch / frequency drop.
     */
    playHurt() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(320, now);
        osc1.frequency.exponentialRampToValueAtTime(60, now + 0.22);

        // Dissonant detune
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(338, now);
        osc2.frequency.exponentialRampToValueAtTime(65, now + 0.22);

        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    }

    /**
     * Dramatic descending retro melody.
     */
    playDie() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [
            { f: 587.33, d: 0.12 }, // D5
            { f: 554.37, d: 0.12 }, // C#5
            { f: 523.25, d: 0.12 }, // C5
            { f: 493.88, d: 0.14 }, // B4
            { f: 440.00, d: 0.16 }, // A4
            { f: 392.00, d: 0.18 }, // G4
            { f: 329.63, d: 0.24 }, // E4
            { f: 220.00, d: 0.45 }  // A3 (final low slide)
        ];

        let offset = 0;
        notes.forEach((n, idx) => {
            const start = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(n.f, start);
            if (idx === notes.length - 1) {
                osc.frequency.exponentialRampToValueAtTime(80, start + n.d);
            }

            gain.gain.setValueAtTime(0.26, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + n.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(start);
            osc.stop(start + n.d + 0.02);
            offset += n.d * 0.92;
        });
    }

    /**
     * Low-frequency modulated rumble/growl.
     */
    playBossRoar() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const duration = 1.1;

        // Carrier oscillator
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.35);
        osc.frequency.exponentialRampToValueAtTime(45, now + duration);

        // LFO for frequency flutter
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(26, now);
        lfoGain.gain.setValueAtTime(25, now);
        lfo.connect(osc.frequency);

        // Lowpass filter sweep
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, now);
        filter.frequency.linearRampToValueAtTime(850, now + 0.35);
        filter.frequency.exponentialRampToValueAtTime(150, now + duration);
        filter.Q.setValueAtTime(4, now);

        // Amplitude envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.42, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
    }

    /**
     * Deep booming impact sound.
     */
    playShockwave() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Sub-bass impact sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(24, now + 0.55);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.62);

        // Filtered low rumble noise
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(320, now);
            filter.frequency.exponentialRampToValueAtTime(40, now + 0.5);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.4, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.sfxGain);

            noise.start(now);
            noise.stop(now + 0.58);
        }
    }

    /**
     * Filtered white noise decay explosion.
     */
    playExplosion() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Sub-punch kick
        const kick = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kick.type = 'triangle';
        kick.frequency.setValueAtTime(160, now);
        kick.frequency.exponentialRampToValueAtTime(30, now + 0.22);
        kickGain.gain.setValueAtTime(0.45, now);
        kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        kick.connect(kickGain);
        kickGain.connect(this.sfxGain);
        kick.start(now);
        kick.stop(now + 0.26);

        // Swept white noise blast
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800, now);
            filter.frequency.exponentialRampToValueAtTime(70, now + 0.6);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.48, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.sfxGain);

            noise.start(now);
            noise.stop(now + 0.68);
        }
    }

    /**
     * Celebratory retro victory fanfare.
     */
    playVictory() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Triumphant Fanfare Melody (Notes + timing)
        // C5, C5, C5, C5 (hold), Ab4, Bb4, C5 (long hold with harmonized chord)
        const notes = [
            { f: 523.25, d: 0.12, t: 0.00 }, // C5
            { f: 523.25, d: 0.12, t: 0.14 }, // C5
            { f: 523.25, d: 0.12, t: 0.28 }, // C5
            { f: 523.25, d: 0.38, t: 0.42 }, // C5
            { f: 415.30, d: 0.38, t: 0.84 }, // Ab4
            { f: 466.16, d: 0.38, t: 1.26 }, // Bb4
            { f: 523.25, d: 0.95, t: 1.68 }  // C5 (finale)
        ];

        // Harmonizing final chord notes (Eb5, G5)
        const chords = [
            { f: 659.25, d: 0.95, t: 1.68 }, // E5
            { f: 783.99, d: 0.95, t: 1.68 }  // G5
        ];

        [...notes, ...chords].forEach(n => {
            const start = now + n.t;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(n.f, start);

            gain.gain.setValueAtTime(0.24, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + n.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(start);
            osc.stop(start + n.d + 0.05);
        });
    }

    /**
     * Additional UI & Gameplay Audio helpers
     */
    playClick() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playDash() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.frequency.linearRampToValueAtTime(400, now + 0.16);
            filter.Q.setValueAtTime(3, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            noise.start(now);
            noise.stop(now + 0.19);
        }
    }

    playCheckpoint() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        chords.forEach((freq, idx) => {
            const start = now + idx * 0.06;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.25, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.38);
        });
    }

    // ==========================================
    // PROCEDURAL CHIPTUNE BACKGROUND MUSIC (BGM)
    // ==========================================

    /**
     * Plays a procedural chiptune soundtrack by name.
     * Supported names: 'menu', 'level1' / 'levelOne', 'level2' / 'levelTwo', 'boss'
     */
    playMusic(trackName, loop = true) {
        const normalized = this._normalizeTrackName(trackName);
        if (this.currentTrack === normalized && this.isPlayingMusic) {
            return;
        }

        this.stopMusic();
        const ctx = this.ensureContext();
        if (!ctx) return;

        const trackData = this._getTrackData(normalized);
        if (!trackData) {
            console.warn(`SoundSynth: Unknown track "${trackName}"`);
            return;
        }

        this.currentTrack = normalized;
        this.isPlayingMusic = true;
        this.musicStep = 0;
        this.nextNoteTime = ctx.currentTime + 0.05;

        // Start precision lookahead scheduler loop (~25ms interval)
        const stepDuration = 60 / trackData.bpm / 4; // 16th note length in seconds

        const schedule = () => {
            if (!this.isPlayingMusic) return;

            // Schedule events in advance (100ms lookahead window)
            while (this.nextNoteTime < ctx.currentTime + 0.12) {
                this._scheduleMusicStep(trackData, this.musicStep, this.nextNoteTime, stepDuration);
                this.nextNoteTime += stepDuration;
                this.musicStep++;

                if (this.musicStep >= trackData.length) {
                    if (loop) {
                        this.musicStep = 0;
                    } else {
                        this.isPlayingMusic = false;
                        break;
                    }
                }
            }
        };

        this.musicTimer = setInterval(schedule, 25);
        schedule();
    }

    /**
     * Cleanly stops background music and releases active oscillator voices.
     */
    stopMusic() {
        this.isPlayingMusic = false;
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }

        if (this.ctx) {
            // Rapid fade-out active voices to avoid clicking
            this.activeMusicVoices.forEach(voice => {
                try {
                    voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
                    voice.gain.gain.setValueAtTime(voice.gain.gain.value, this.ctx.currentTime);
                    voice.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
                    voice.osc.stop(this.ctx.currentTime + 0.05);
                } catch (e) {}
            });
        }
        this.activeMusicVoices = [];
        this.currentTrack = null;
    }

    _normalizeTrackName(name) {
        if (!name) return 'menu';
        const str = String(name).toLowerCase();
        if (str.includes('menu') || str.includes('title')) return 'menu';
        if (str.includes('1') || str.includes('one')) return 'level1';
        if (str.includes('2') || str.includes('two')) return 'level2';
        if (str.includes('boss') || str.includes('3') || str.includes('three')) return 'boss';
        return str;
    }

    /**
     * Schedules a single 16th note step across Lead, Arp, Bass, and Percussion channels.
     */
    _scheduleMusicStep(track, stepIndex, time, stepDuration) {
        const ctx = this.ctx;
        if (!ctx) return;

        // Clean finished voices
        this.activeMusicVoices = this.activeMusicVoices.filter(v => v.endTime > ctx.currentTime);

        // 1. LEAD SYNTH CHANNEL
        if (track.lead && track.lead[stepIndex]) {
            const note = track.lead[stepIndex];
            if (note.freq > 0) {
                const dur = (note.len || 1) * stepDuration * 0.92;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = note.type || 'square';
                osc.frequency.setValueAtTime(note.freq, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(note.vol || 0.18, time + 0.015);
                gain.gain.setValueAtTime(note.vol || 0.18, time + dur * 0.75);
                gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(time);
                osc.stop(time + dur + 0.02);

                this.activeMusicVoices.push({ osc, gain, endTime: time + dur + 0.02 });
            }
        }

        // 2. ARP / HARMONY CHANNEL
        if (track.arp && track.arp[stepIndex]) {
            const freq = track.arp[stepIndex];
            if (freq > 0) {
                const dur = stepDuration * 0.85;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, time);

                gain.gain.setValueAtTime(0.09, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(time);
                osc.stop(time + dur + 0.01);

                this.activeMusicVoices.push({ osc, gain, endTime: time + dur + 0.01 });
            }
        }

        // 3. BASS CHANNEL
        if (track.bass && track.bass[stepIndex]) {
            const freq = track.bass[stepIndex];
            if (freq > 0) {
                const dur = stepDuration * 0.88;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = track.bassType || 'triangle';
                osc.frequency.setValueAtTime(freq, time);

                gain.gain.setValueAtTime(0.24, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

                osc.connect(gain);
                gain.connect(this.musicGain);

                osc.start(time);
                osc.stop(time + dur + 0.01);

                this.activeMusicVoices.push({ osc, gain, endTime: time + dur + 0.01 });
            }
        }

        // 4. PROCEDURAL NOISE DRUMS (1: Kick, 2: Snare, 3: HiHat, 4: OpenHat)
        if (track.drums && track.drums[stepIndex]) {
            const drum = track.drums[stepIndex];
            if (drum === 1) {
                // Kick
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, time);
                osc.frequency.exponentialRampToValueAtTime(32, time + 0.09);
                gain.gain.setValueAtTime(0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.start(time);
                osc.stop(time + 0.11);
                this.activeMusicVoices.push({ osc, gain, endTime: time + 0.11 });
            } else if (drum === 2 && this.noiseBuffer) {
                // Snare
                const noise = ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1200, time);
                filter.Q.setValueAtTime(1.5, time);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.22, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                noise.start(time);
                noise.stop(time + 0.13);
            } else if ((drum === 3 || drum === 4) && this.noiseBuffer) {
                // Hi-Hat
                const noise = ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(6500, time);

                const dur = drum === 4 ? 0.09 : 0.035;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.12, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);
                noise.start(time);
                noise.stop(time + dur + 0.01);
            }
        }
    }

    // ==========================================
    // CHIPTUNE TRACK DEFINITIONS
    // ==========================================

    _getTrackData(name) {
        // Standard Frequencies
        const N = {
            REST: 0,
            // Octave 2
            C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
            // Octave 3
            C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
            // Octave 4
            C4: 261.63, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
            // Octave 5
            C5: 523.25, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
            // Octave 6
            C6: 1046.50, D6: 1174.66, E6: 1318.51
        };

        if (name === 'menu') {
            // Track 1: Chill Retro Arpeggio (C Major / A Minor, 114 BPM, 32 steps)
            return {
                bpm: 114,
                length: 32,
                bassType: 'triangle',
                lead: [
                    { freq: N.E5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.G5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.A5, len: 4, vol: 0.18 }, null, null, null,
                    { freq: N.G5, len: 3, vol: 0.16 }, null, null, null,

                    { freq: N.E5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.D5, len: 3, vol: 0.16 }, null, null, null,
                    { freq: N.C5, len: 6, vol: 0.18 }, null, null, null,
                    null, null, null, null
                ],
                arp: [
                    N.C4, N.E4, N.G4, N.C5,  N.C4, N.E4, N.G4, N.C5,
                    N.A3, N.C4, N.E4, N.A4,  N.A3, N.C4, N.E4, N.A4,
                    N.F3, N.A3, N.C4, N.F4,  N.F3, N.A3, N.C4, N.F4,
                    N.G3, N.B3, N.D4, N.G4,  N.G3, N.B3, N.D4, N.G4
                ],
                bass: [
                    N.C3, 0, N.C3, 0,  N.G2, 0, N.C3, 0,
                    N.A2, 0, N.A2, 0,  N.E2, 0, N.A2, 0,
                    N.F2, 0, N.F2, 0,  N.C3, 0, N.F2, 0,
                    N.G2, 0, N.G2, 0,  N.D3, 0, N.G2, 0
                ],
                drums: [
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 3, 3,  2, 3, 4, 3,
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 3, 3,  2, 3, 2, 4
                ]
            };
        }

        if (name === 'level1') {
            // Track 2: Energetic Platformer Melody (C / G Upbeat, 136 BPM, 32 steps)
            return {
                bpm: 136,
                length: 32,
                bassType: 'square',
                lead: [
                    { freq: N.E5, len: 1.5, vol: 0.2 }, { freq: N.E5, len: 1.5, vol: 0.2 }, null, { freq: N.E5, len: 1.5, vol: 0.2 },
                    null, { freq: N.C5, len: 1.5, vol: 0.2 }, { freq: N.E5, len: 2.0, vol: 0.22 }, null,
                    { freq: N.G5, len: 3.5, vol: 0.24 }, null, null, null,
                    { freq: N.G4, len: 3.0, vol: 0.22 }, null, null, null,

                    { freq: N.C5, len: 2.5, vol: 0.2 }, null, null, { freq: N.G4, len: 2.0, vol: 0.2 },
                    null, null, { freq: N.E4, len: 2.5, vol: 0.2 }, null,
                    { freq: N.A4, len: 2.0, vol: 0.2 }, null, { freq: N.B4, len: 2.0, vol: 0.2 }, null,
                    { freq: N.Bb4, len: 1.5, vol: 0.2 }, { freq: N.A4, len: 2.5, vol: 0.22 }, null, null
                ],
                arp: [
                    N.C4, N.G4, N.C5, N.G4,  N.C4, N.G4, N.C5, N.G4,
                    N.C4, N.G4, N.C5, N.G4,  N.G3, N.D4, N.G4, N.D4,
                    N.A3, N.E4, N.A4, N.E4,  N.E3, N.B3, N.E4, N.B3,
                    N.F3, N.C4, N.F4, N.C4,  N.G3, N.D4, N.G4, N.D4
                ],
                bass: [
                    N.C3, 0, N.C3, N.C3,  0, N.C3, 0, N.E3,
                    N.G3, 0, N.G3, 0,     N.G2, 0, N.B2, 0,
                    N.A2, 0, N.A2, 0,     N.E3, 0, N.E2, 0,
                    N.F2, 0, N.F2, 0,     N.G2, 0, N.G2, N.B2
                ],
                drums: [
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 1, 3,  2, 3, 4, 3,
                    1, 3, 3, 3,  2, 3, 1, 3,
                    1, 3, 1, 1,  2, 2, 2, 4
                ]
            };
        }

        if (name === 'level2') {
            // Track 3: Fast Techno/Arcade Bassline & Lead (D Minor, 150 BPM, 32 steps)
            return {
                bpm: 150,
                length: 32,
                bassType: 'sawtooth',
                lead: [
                    { freq: N.D5, len: 1.8, vol: 0.22 }, null, { freq: N.D5, len: 1.8, vol: 0.22 }, null,
                    { freq: N.F5, len: 2.0, vol: 0.24 }, null, { freq: N.G5, len: 2.0, vol: 0.24 }, null,
                    { freq: N.A5, len: 3.5, vol: 0.25 }, null, null, null,
                    { freq: N.G5, len: 1.8, vol: 0.22 }, null, { freq: N.F5, len: 1.8, vol: 0.22 }, null,

                    { freq: N.D5, len: 1.8, vol: 0.22 }, null, { freq: N.A4, len: 1.8, vol: 0.22 }, null,
                    { freq: N.C5, len: 2.0, vol: 0.24 }, null, { freq: N.D5, len: 3.0, vol: 0.25 }, null,
                    { freq: N.F5, len: 1.5, vol: 0.22 }, { freq: N.E5, len: 1.5, vol: 0.22 }, { freq: N.D5, len: 1.5, vol: 0.22 }, { freq: N.C5, len: 1.5, vol: 0.22 },
                    { freq: N.D5, len: 3.5, vol: 0.25 }, null, null, null
                ],
                arp: [
                    N.D4, N.F4, N.A4, N.D5,  N.D4, N.F4, N.A4, N.D5,
                    N.F4, N.A4, N.C5, N.F5,  N.G4, N.Bb4, N.D5, N.G5,
                    N.A4, N.C5, N.E5, N.A5,  N.G4, N.Bb4, N.D5, N.G5,
                    N.Bb4, N.D5, N.F5, N.Bb5, N.A4, N.Cs5, N.E5, N.A5
                ],
                bass: [
                    N.D3, N.D3, N.D3, N.D3,  N.D3, N.D3, N.F3, N.G3,
                    N.F3, N.F3, N.F3, N.F3,  N.G3, N.G3, N.A3, N.C4,
                    N.D3, N.D3, N.D3, N.D3,  N.D3, N.D3, N.C3, N.C3,
                    N.Bb2, N.Bb2, N.Bb2, N.Bb2, N.A2, N.A2, N.Cs3, N.E3
                ],
                drums: [
                    1, 3, 1, 3,  2, 3, 1, 3,
                    1, 3, 1, 3,  2, 3, 4, 3,
                    1, 3, 1, 3,  2, 3, 1, 1,
                    1, 3, 1, 3,  2, 2, 2, 4
                ]
            };
        }

        if (name === 'boss') {
            // Track 4: Tense, Driving Boss Battle Theme (C Minor, 160 BPM, 32 steps)
            return {
                bpm: 160,
                length: 32,
                bassType: 'sawtooth',
                lead: [
                    { freq: N.C5, len: 2.0, vol: 0.25 }, null, { freq: N.Eb5, len: 2.0, vol: 0.25 }, null,
                    { freq: N.Fs5, len: 3.5, vol: 0.28 }, null, null, null,
                    { freq: N.G5, len: 2.0, vol: 0.25 }, null, { freq: N.Fs5, len: 2.0, vol: 0.25 }, null,
                    { freq: N.Eb5, len: 3.5, vol: 0.25 }, null, null, null,

                    { freq: N.C5, len: 1.5, vol: 0.24 }, { freq: N.Eb5, len: 1.5, vol: 0.24 }, { freq: N.G5, len: 1.5, vol: 0.26 }, { freq: N.C6, len: 2.5, vol: 0.28 },
                    null, null, { freq: N.B5, len: 2.0, vol: 0.26 }, null,
                    { freq: N.Ab5, len: 2.0, vol: 0.25 }, null, { freq: N.G5, len: 2.0, vol: 0.25 }, null,
                    { freq: N.Fs5, len: 2.0, vol: 0.25 }, null, { freq: N.G5, len: 3.0, vol: 0.26 }, null
                ],
                arp: [
                    N.C4, N.Eb4, N.Fs4, N.C5,  N.C4, N.Eb4, N.Fs4, N.C5,
                    N.G4, N.B4, N.D5, N.G5,    N.Eb4, N.G4, N.Bb4, N.Eb5,
                    N.C4, N.Eb4, N.G4, N.C5,   N.Ab3, N.C4, N.Eb4, N.Ab4,
                    N.Fs3, N.A3, N.C4, N.Fs4,  N.G3, N.B3, N.D4, N.G4
                ],
                bass: [
                    N.C3, N.C3, N.C3, N.C3,  N.C3, N.C3, N.Eb3, N.G3,
                    N.C3, N.C3, N.C3, N.C3,  N.Eb3, N.Eb3, N.D3, N.D3,
                    N.C3, N.C3, N.C3, N.C3,  N.Ab2, N.Ab2, N.Ab2, N.Ab2,
                    N.Fs2, N.Fs2, N.Fs2, N.Fs2, N.G2, N.G2, N.G2, N.G2
                ],
                drums: [
                    1, 1, 3, 3,  2, 3, 1, 1,
                    1, 3, 1, 3,  2, 2, 4, 3,
                    1, 1, 3, 3,  2, 3, 1, 1,
                    1, 1, 2, 2,  2, 2, 1, 4
                ]
            };
        }

        return null;
    }
}
SoundSynth;


// ==========================================
// Module: fx/ParticleSystem.js
// ==========================================
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
class ParticleSystem {
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
ParticleSystem;


// ==========================================
// Module: ui/HUD.js
// ==========================================
/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Modern Arcade HUD & DOM UI Controller
 * ============================================================================
 * Features:
 * - Pixel heart health containers with dynamic damage / heal / pulse animations
 * - Rolling score counter with high score tracking
 * - Combo streak multiplier gauge with draining timer bar
 * - Level indicator, collectible coin tracker, and speedrun timer
 * - Boss health bar with phase indicators and enrage animations
 * - In-game Pause & Settings modal with audio sliders, CRT toggle, and controls guide
 * - Ergonomic Mobile Virtual D-Pad & Action Buttons with touch ripple effects
 * - Animated Toast Notification system for achievements, power-ups, and checkpoints
 */
class HUD {
    /**
     * @param {Object} options
     * @param {HTMLElement} [options.container] - Parent container element for the HUD overlay
     * @param {import('../core/Input.js').Input} [options.input] - Reference to Input manager
     * @param {import('../core/Storage.js').StorageManager} [options.storage] - Reference to Storage manager
     */
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.input = options.input || null;
        this.storage = options.storage || null;

        // Callback hooks for game events
        this.callbacks = {
            onResume: null,
            onRestart: null,
            onLevelSelect: null,
            onQuit: null,
            onAudioChange: null,
            onDisplayChange: null
        };

        // State variables
        this.maxHealth = 3;
        this.currentHealth = 3;
        this.lives = 3;
        this.coins = 0;

        // Score rolling animation state
        this.displayScore = 0;
        this.targetScore = 0;
        this.scoreRollSpeed = 15; // points per frame nominal

        // Combo state
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.comboRatio = 0; // 0.0 to 1.0

        // Boss state
        this.isBossActive = false;
        this.bossName = '';
        this.bossCurrentHp = 100;
        this.bossMaxHp = 100;
        this.bossDisplayHp = 100;
        this.bossPhase = 'PHASE 1';

        // Time
        this.elapsedSeconds = 0;

        // UI DOM Elements
        this.dom = {};

        // Build DOM structure
        this._buildDOM();
        this._bindEvents();
        if (this.input) {
            this.bindInput(this.input);
        }
    }

    /**
     * Constructs the HUD layout inside the container.
     */
    _buildDOM() {
        // Main HUD Overlay wrapper
        const hudRoot = document.createElement('div');
        hudRoot.className = 'arcade-hud-root';
        hudRoot.id = 'arcade-hud';

        hudRoot.innerHTML = `
            <!-- Top HUD Bar -->
            <div class="hud-top-bar">
                <!-- Left: Health & Lives -->
                <div class="hud-group hud-health-group">
                    <div class="hud-lives-badge">
                        <span class="hud-icon-dude"></span>
                        <span class="hud-lives-text" id="hud-lives-val">x3</span>
                    </div>
                    <div class="hud-hearts-container" id="hud-hearts"></div>
                </div>

                <!-- Center: Level & Timer -->
                <div class="hud-group hud-stage-group">
                    <div class="hud-stage-title" id="hud-stage-name">STAGE 1</div>
                    <div class="hud-timer-badge">
                        <span class="hud-icon-clock">⏱</span>
                        <span class="hud-timer-text" id="hud-timer-val">00:00.00</span>
                    </div>
                </div>

                <!-- Right: Score & Coins -->
                <div class="hud-group hud-score-group">
                    <div class="hud-coins-badge">
                        <span class="hud-icon-coin">🪙</span>
                        <span class="hud-coins-val" id="hud-coins-val">00</span>
                    </div>
                    <div class="hud-score-box">
                        <div class="hud-score-label">SCORE</div>
                        <div class="hud-score-val" id="hud-score-val">000000</div>
                    </div>
                </div>
            </div>

            <!-- Combo Multiplier Gauge (Appears dynamically) -->
            <div class="hud-combo-container" id="hud-combo-box" style="display: none;">
                <div class="hud-combo-label" id="hud-combo-text">COMBO x2!</div>
                <div class="hud-combo-meter">
                    <div class="hud-combo-fill" id="hud-combo-fill" style="width: 100%;"></div>
                </div>
            </div>

            <!-- Boss Health Bar -->
            <div class="hud-boss-container" id="hud-boss-box" style="display: none;">
                <div class="hud-boss-header">
                    <span class="hud-boss-name" id="hud-boss-name">BOSS</span>
                    <span class="hud-boss-phase" id="hud-boss-phase">PHASE 1</span>
                </div>
                <div class="hud-boss-meter">
                    <div class="hud-boss-damage-lag" id="hud-boss-damage-lag" style="width: 100%;"></div>
                    <div class="hud-boss-fill" id="hud-boss-fill" style="width: 100%;"></div>
                </div>
            </div>

            <!-- Floating Toast Announcement Banner -->
            <div class="hud-toast-banner" id="hud-toast" style="display: none;">
                <div class="hud-toast-title" id="hud-toast-title">CHECKPOINT!</div>
                <div class="hud-toast-sub" id="hud-toast-sub">Progress Saved</div>
            </div>

            <!-- Mobile Virtual Controls Overlay -->
            <div class="virtual-controls-root" id="virtual-controls">
                <!-- Virtual D-Pad (Left) -->
                <div class="vpad-container" id="vpad-container">
                    <button class="vpad-btn vpad-up" data-action="${Action.UP}" aria-label="Up">▲</button>
                    <button class="vpad-btn vpad-left" data-action="${Action.LEFT}" aria-label="Left">◀</button>
                    <button class="vpad-btn vpad-right" data-action="${Action.RIGHT}" aria-label="Right">▶</button>
                    <button class="vpad-btn vpad-down" data-action="${Action.DOWN}" aria-label="Down">▼</button>
                    <div class="vpad-center"></div>
                </div>

                <!-- Pause Shortcut Button -->
                <button class="vbtn-pause" id="vbtn-pause-top" aria-label="Pause">❚❚</button>

                <!-- Action Buttons (Right) -->
                <div class="vbtn-container" id="vbtn-container">
                    <button class="vbtn vbtn-dash" data-action="${Action.ACTION}" aria-label="Action">B</button>
                    <button class="vbtn vbtn-jump" data-action="${Action.JUMP}" aria-label="Jump">A</button>
                </div>
            </div>

            <!-- In-Game Pause & Settings Modal -->
            <div class="hud-modal-backdrop" id="hud-pause-modal" style="display: none;">
                <div class="hud-modal-card">
                    <div class="hud-modal-header">
                        <h2 class="hud-modal-title">GAME PAUSED</h2>
                        <span class="hud-modal-subtitle">TACTICAL BREAK</span>
                    </div>

                    <div class="hud-modal-body">
                        <!-- Navigation Buttons -->
                        <div class="hud-menu-options">
                            <button class="hud-arcade-btn btn-primary" id="hud-btn-resume">RESUME GAME</button>
                            <button class="hud-arcade-btn" id="hud-btn-restart">RESTART LEVEL</button>
                            <button class="hud-arcade-btn" id="hud-btn-levelselect">LEVEL SELECT</button>
                        </div>

                        <!-- Audio & Settings Panel -->
                        <div class="hud-settings-panel">
                            <h3 class="hud-settings-heading">AUDIO & DISPLAY</h3>
                            
                            <div class="hud-setting-row">
                                <label for="slider-master-vol">MASTER VOL</label>
                                <input type="range" id="slider-master-vol" min="0" max="100" value="80" class="hud-slider">
                                <span class="hud-slider-val" id="val-master-vol">80%</span>
                            </div>

                            <div class="hud-setting-row">
                                <label for="slider-sfx-vol">SFX VOL</label>
                                <input type="range" id="slider-sfx-vol" min="0" max="100" value="85" class="hud-slider">
                                <span class="hud-slider-val" id="val-sfx-vol">85%</span>
                            </div>

                            <div class="hud-setting-row">
                                <label for="slider-music-vol">MUSIC VOL</label>
                                <input type="range" id="slider-music-vol" min="0" max="100" value="75" class="hud-slider">
                                <span class="hud-slider-val" id="val-music-vol">75%</span>
                            </div>

                            <div class="hud-setting-toggle-row">
                                <button class="hud-toggle-btn" id="btn-toggle-mute">🔊 MUTE AUDIO: OFF</button>
                                <button class="hud-toggle-btn" id="btn-toggle-crt">📺 CRT FILTER: OFF</button>
                            </div>
                        </div>

                        <!-- Controls Quick Sheet -->
                        <div class="hud-controls-sheet">
                            <div class="hud-controls-col">
                                <div><kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> : Move</div>
                                <div><kbd>SPACE</kbd> or <kbd>W</kbd> : Jump</div>
                            </div>
                            <div class="hud-controls-col">
                                <div><kbd>P</kbd> or <kbd>ESC</kbd> : Pause</div>
                                <div><kbd>O</kbd> : Step Frame</div>
                            </div>
                        </div>

                        <!-- Quit Button -->
                        <button class="hud-arcade-btn btn-danger" id="hud-btn-quit">QUIT TO MAIN MENU</button>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(hudRoot);

        // Cache DOM elements
        this.dom = {
            root: hudRoot,
            topBar: hudRoot.querySelector('.hud-top-bar'),
            hearts: hudRoot.querySelector('#hud-hearts'),
            livesVal: hudRoot.querySelector('#hud-lives-val'),
            stageName: hudRoot.querySelector('#hud-stage-name'),
            timerVal: hudRoot.querySelector('#hud-timer-val'),
            coinsVal: hudRoot.querySelector('#hud-coins-val'),
            scoreVal: hudRoot.querySelector('#hud-score-val'),
            comboBox: hudRoot.querySelector('#hud-combo-box'),
            comboText: hudRoot.querySelector('#hud-combo-text'),
            comboFill: hudRoot.querySelector('#hud-combo-fill'),
            bossBox: hudRoot.querySelector('#hud-boss-box'),
            bossName: hudRoot.querySelector('#hud-boss-name'),
            bossPhase: hudRoot.querySelector('#hud-boss-phase'),
            bossFill: hudRoot.querySelector('#hud-boss-fill'),
            bossLag: hudRoot.querySelector('#hud-boss-damage-lag'),
            toast: hudRoot.querySelector('#hud-toast'),
            toastTitle: hudRoot.querySelector('#hud-toast-title'),
            toastSub: hudRoot.querySelector('#hud-toast-sub'),
            virtualControls: hudRoot.querySelector('#virtual-controls'),
            vbtnPauseTop: hudRoot.querySelector('#vbtn-pause-top'),
            pauseModal: hudRoot.querySelector('#hud-pause-modal'),
            btnResume: hudRoot.querySelector('#hud-btn-resume'),
            btnRestart: hudRoot.querySelector('#hud-btn-restart'),
            btnLevelSelect: hudRoot.querySelector('#hud-btn-levelselect'),
            btnQuit: hudRoot.querySelector('#hud-btn-quit'),
            sliderMaster: hudRoot.querySelector('#slider-master-vol'),
            sliderSfx: hudRoot.querySelector('#slider-sfx-vol'),
            sliderMusic: hudRoot.querySelector('#slider-music-vol'),
            valMaster: hudRoot.querySelector('#val-master-vol'),
            valSfx: hudRoot.querySelector('#val-sfx-vol'),
            valMusic: hudRoot.querySelector('#val-music-vol'),
            btnToggleMute: hudRoot.querySelector('#btn-toggle-mute'),
            btnToggleCrt: hudRoot.querySelector('#btn-toggle-crt')
        };

        // Render initial hearts
        this._renderHearts();
    }

    /**
     * Binds DOM listeners for pause menu buttons, sliders, and audio controls.
     */
    _bindEvents() {
        const { dom } = this;

        // Resume button
        dom.btnResume.addEventListener('click', () => {
            this.hidePauseMenu();
            if (this.callbacks.onResume) this.callbacks.onResume();
        });

        // Restart button
        dom.btnRestart.addEventListener('click', () => {
            this.hidePauseMenu();
            if (this.callbacks.onRestart) this.callbacks.onRestart();
        });

        // Level Select button
        dom.btnLevelSelect.addEventListener('click', () => {
            this.hidePauseMenu();
            if (this.callbacks.onLevelSelect) this.callbacks.onLevelSelect();
        });

        // Quit button
        dom.btnQuit.addEventListener('click', () => {
            this.hidePauseMenu();
            if (this.callbacks.onQuit) this.callbacks.onQuit();
        });

        // Top pause shortcut button (mobile touch)
        dom.vbtnPauseTop.addEventListener('click', () => {
            if (this.input) {
                this.input.setVirtualAction(Action.PAUSE, true);
                setTimeout(() => this.input.setVirtualAction(Action.PAUSE, false), 100);
            }
        });

        // Audio Sliders
        const updateAudio = () => {
            const master = parseInt(dom.sliderMaster.value, 10) / 100;
            const sfx = parseInt(dom.sliderSfx.value, 10) / 100;
            const music = parseInt(dom.sliderMusic.value, 10) / 100;

            dom.valMaster.textContent = `${dom.sliderMaster.value}%`;
            dom.valSfx.textContent = `${dom.sliderSfx.value}%`;
            dom.valMusic.textContent = `${dom.sliderMusic.value}%`;

            if (this.storage) {
                this.storage.saveAudioSettings({ masterVolume: master, sfxVolume: sfx, musicVolume: music });
            }
            if (this.callbacks.onAudioChange) {
                this.callbacks.onAudioChange({ masterVolume: master, sfxVolume: sfx, musicVolume: music });
            }
        };

        dom.sliderMaster.addEventListener('input', updateAudio);
        dom.sliderSfx.addEventListener('input', updateAudio);
        dom.sliderMusic.addEventListener('input', updateAudio);

        // Mute Toggle
        let isMuted = false;
        dom.btnToggleMute.addEventListener('click', () => {
            isMuted = !isMuted;
            dom.btnToggleMute.textContent = isMuted ? '🔇 MUTE AUDIO: ON' : '🔊 MUTE AUDIO: OFF';
            dom.btnToggleMute.classList.toggle('active', isMuted);
            if (this.storage) {
                this.storage.saveAudioSettings({ muted: isMuted });
            }
            if (this.callbacks.onAudioChange) {
                this.callbacks.onAudioChange({ muted: isMuted });
            }
        });

        // CRT Filter Toggle
        let isCrtOn = false;
        dom.btnToggleCrt.addEventListener('click', () => {
            isCrtOn = !isCrtOn;
            dom.btnToggleCrt.textContent = isCrtOn ? '📺 CRT FILTER: ON' : '📺 CRT FILTER: OFF';
            dom.btnToggleCrt.classList.toggle('active', isCrtOn);
            document.body.classList.toggle('crt-filter-active', isCrtOn);
            if (this.storage) {
                this.storage.saveDisplaySettings({ crtFilter: isCrtOn });
            }
            if (this.callbacks.onDisplayChange) {
                this.callbacks.onDisplayChange({ crtFilter: isCrtOn });
            }
        });
    }

    /**
     * Binds Mobile Virtual D-pad and Action buttons to the Input manager.
     * @param {import('../core/Input.js').Input} inputInstance
     */
    bindInput(inputInstance) {
        this.input = inputInstance;
        const root = this.dom.virtualControls;
        if (!root) return;

        const touchButtons = root.querySelectorAll('[data-action]');

        touchButtons.forEach(btn => {
            const action = btn.getAttribute('data-action');

            const handleStart = (e) => {
                e.preventDefault();
                btn.classList.add('pressed');
                this.input.setVirtualAction(action, true);
            };

            const handleEnd = (e) => {
                e.preventDefault();
                btn.classList.remove('pressed');
                this.input.setVirtualAction(action, false);
            };

            btn.addEventListener('touchstart', handleStart, { passive: false });
            btn.addEventListener('touchend', handleEnd, { passive: false });
            btn.addEventListener('touchcancel', handleEnd, { passive: false });

            // Mouse fallback for responsive preview testing
            btn.addEventListener('mousedown', handleStart);
            btn.addEventListener('mouseup', handleEnd);
            btn.addEventListener('mouseleave', handleEnd);
        });
    }

    /**
     * Register game event callbacks.
     * @param {Object} cbs
     */
    bindCallbacks(cbs = {}) {
        this.callbacks = { ...this.callbacks, ...cbs };
    }

    // =========================================================================
    // UPDATE & ANIMATION LOOP
    // =========================================================================

    /**
     * Updates rolling scores, boss bar interpolation, and combo meters.
     * @param {number} du - nominal delta factor (1.0 at 60 FPS)
     * @param {number} dt - delta time in ms
     */
    update(du = 1.0, dt = 16.666) {
        // 1. Rolling Score Counter
        if (this.displayScore !== this.targetScore) {
            const diff = this.targetScore - this.displayScore;
            const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.15 * du));
            
            if (Math.abs(diff) <= step) {
                this.displayScore = this.targetScore;
            } else {
                this.displayScore += Math.sign(diff) * step;
            }
            this.dom.scoreVal.textContent = String(this.displayScore).padStart(6, '0');
        }

        // 2. Boss Health Damage Lag Interpolation
        if (this.isBossActive) {
            if (this.bossDisplayHp > this.bossCurrentHp) {
                this.bossDisplayHp -= (this.bossDisplayHp - this.bossCurrentHp) * (0.05 * du);
                const lagPercent = Math.max(0, (this.bossDisplayHp / this.bossMaxHp) * 100);
                this.dom.bossLag.style.width = `${lagPercent}%`;
            }
        }
    }

    // =========================================================================
    // HEALTH & LIVES
    // =========================================================================

    /**
     * Updates player health heart containers.
     * @param {number} current - Current HP
     * @param {number} [max=3] - Max HP
     * @param {number} [lives=3] - Remaining Lives
     */
    setHealth(current, max = this.maxHealth, lives = this.lives) {
        const wasDamaged = current < this.currentHealth;
        this.currentHealth = Math.max(0, current);
        this.maxHealth = Math.max(1, max);
        this.lives = lives;

        this.dom.livesVal.textContent = `x${this.lives}`;
        this._renderHearts(wasDamaged);
    }

    _renderHearts(wasDamaged = false) {
        const container = this.dom.hearts;
        if (!container) return;

        container.innerHTML = '';
        for (let i = 0; i < this.maxHealth; i++) {
            const heart = document.createElement('div');
            heart.className = 'hud-heart';

            if (i < this.currentHealth) {
                heart.classList.add('heart-full');
            } else {
                heart.classList.add('heart-empty');
                if (wasDamaged && i === this.currentHealth) {
                    heart.classList.add('heart-broken-anim');
                }
            }

            container.appendChild(heart);
        }
    }

    // =========================================================================
    // SCORE & COMBO
    // =========================================================================

    /**
     * Set player score.
     * @param {number} score
     * @param {boolean} [immediate=false]
     */
    setScore(score, immediate = false) {
        this.targetScore = score;
        if (immediate) {
            this.displayScore = score;
            this.dom.scoreVal.textContent = String(this.displayScore).padStart(6, '0');
        }
    }

    /**
     * Updates combo multiplier display and draining gauge.
     * @param {number} count - Current combo hits
     * @param {number} multiplier - Multiplier value (e.g. 2, 3, 4)
     * @param {number} ratio - Gauge fill ratio (0.0 to 1.0)
     */
    setCombo(count, multiplier = 1, ratio = 1.0) {
        this.comboCount = count;
        this.comboMultiplier = multiplier;
        this.comboRatio = Math.max(0, Math.min(1, ratio));

        if (count >= 2 && ratio > 0) {
            this.dom.comboBox.style.display = 'flex';
            this.dom.comboText.textContent = `COMBO x${multiplier}! (${count} HITS)`;
            this.dom.comboFill.style.width = `${this.comboRatio * 100}%`;

            if (multiplier >= 4) {
                this.dom.comboBox.classList.add('combo-super');
            } else {
                this.dom.comboBox.classList.remove('combo-super');
            }
        } else {
            this.dom.comboBox.style.display = 'none';
        }
    }

    // =========================================================================
    // STAGE, TIME & COINS
    // =========================================================================

    /**
     * Set stage name and number.
     * @param {string} stageName
     */
    setLevel(stageName) {
        this.dom.stageName.textContent = stageName.toUpperCase();
    }

    /**
     * Set coins collected.
     * @param {number} count
     */
    setCoins(count) {
        this.coins = count;
        this.dom.coinsVal.textContent = String(count).padStart(2, '0');
    }

    /**
     * Updates elapsed speedrun timer.
     * @param {number} elapsedSec - Elapsed time in seconds
     */
    setTime(elapsedSec) {
        this.elapsedSeconds = elapsedSec;
        const totalMs = Math.floor(elapsedSec * 1000);
        const mins = Math.floor(totalMs / 60000);
        const secs = Math.floor((totalMs % 60000) / 1000);
        const ms = Math.floor((totalMs % 1000) / 10);

        const mmStr = String(mins).padStart(2, '0');
        const ssStr = String(secs).padStart(2, '0');
        const msStr = String(ms).padStart(2, '0');

        this.dom.timerVal.textContent = `${mmStr}:${ssStr}.${msStr}`;
    }

    // =========================================================================
    // BOSS HEALTH BAR
    // =========================================================================

    /**
     * Activates boss health bar.
     * @param {string} name
     * @param {number} currentHp
     * @param {number} maxHp
     * @param {string} [phase='PHASE 1']
     */
    showBoss(name, currentHp, maxHp, phase = 'PHASE 1') {
        this.isBossActive = true;
        this.bossName = name;
        this.bossCurrentHp = currentHp;
        this.bossMaxHp = maxHp;
        this.bossDisplayHp = currentHp;
        this.bossPhase = phase;

        this.dom.bossBox.style.display = 'flex';
        this.dom.bossName.textContent = name.toUpperCase();
        this.dom.bossPhase.textContent = phase.toUpperCase();
        
        const percent = Math.max(0, (currentHp / maxHp) * 100);
        this.dom.bossFill.style.width = `${percent}%`;
        this.dom.bossLag.style.width = `${percent}%`;
    }

    /**
     * Update current boss HP.
     * @param {number} currentHp
     * @param {string} [phase]
     */
    updateBossHp(currentHp, phase) {
        this.bossCurrentHp = Math.max(0, currentHp);
        if (phase) {
            this.bossPhase = phase;
            this.dom.bossPhase.textContent = phase.toUpperCase();
        }

        const percent = Math.max(0, (this.bossCurrentHp / this.bossMaxHp) * 100);
        this.dom.bossFill.style.width = `${percent}%`;
    }

    /**
     * Hide boss health bar.
     */
    hideBoss() {
        this.isBossActive = false;
        this.dom.bossBox.style.display = 'none';
    }

    // =========================================================================
    // TOAST NOTIFICATIONS
    // =========================================================================

    /**
     * Displays an animated toast notification.
     * @param {string} title
     * @param {string} [subtitle='']
     * @param {number} [durationMs=2500]
     */
    showToast(title, subtitle = '', durationMs = 2500) {
        const toast = this.dom.toast;
        this.dom.toastTitle.textContent = title;
        this.dom.toastSub.textContent = subtitle;

        toast.style.display = 'flex';
        toast.classList.remove('toast-hide');
        toast.classList.add('toast-show');

        if (this._toastTimeout) {
            clearTimeout(this._toastTimeout);
        }

        this._toastTimeout = setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');
            setTimeout(() => {
                toast.style.display = 'none';
            }, 400);
        }, durationMs);
    }

    // =========================================================================
    // PAUSE MODAL & SETTINGS
    // =========================================================================

    /**
     * Show Pause & Settings Modal.
     */
    showPauseMenu() {
        this.dom.pauseModal.style.display = 'flex';
    }

    /**
     * Hide Pause & Settings Modal.
     */
    hidePauseMenu() {
        this.dom.pauseModal.style.display = 'none';
    }

    /**
     * Toggle Pause Modal visibility.
     * @returns {boolean} Is modal now open
     */
    togglePauseMenu() {
        const isOpen = this.dom.pauseModal.style.display === 'flex';
        if (isOpen) {
            this.hidePauseMenu();
            return false;
        } else {
            this.showPauseMenu();
            return true;
        }
    }

    setPaused(isPaused) {
        if (isPaused) {
            this.showPauseMenu();
        } else {
            this.hidePauseMenu();
        }
    }

    updateHealth(lives, maxLives = 3) {
        this.setHealth(lives, maxLives, lives);
    }

    updateScore(score, immediate = false) {
        this.setScore(score, immediate);
    }

    updateCombo(count, multiplier = 1, ratio = 1.0) {
        this.setCombo(count, multiplier, ratio);
    }

    updateTimer(elapsedSec) {
        this.setTime(elapsedSec);
    }

    setLevelTitle(title) {
        this.setLevel(title);
    }

    showBossBar(name, maxHp, currentHp = maxHp, phase = 'PHASE 1') {
        this.showBoss(name, currentHp, maxHp, phase);
    }

    hideBossBar() {
        this.hideBoss();
    }

    setTopBarVisible(visible) {
        if (this.dom.topBar) {
            this.dom.topBar.style.display = visible ? 'flex' : 'none';
        }
    }

    /**
     * Clean up DOM elements on teardown.
     */
    destroy() {
        if (this.dom.root && this.dom.root.parentNode) {
            this.dom.root.parentNode.removeChild(this.dom.root);
        }
    }
}


// ==========================================
// Module: entities/Entity.js
// ==========================================
/**
 * Entity.js - Base Entity class for The Game Enhanced Edition
 * Provides core spatial, physical, and rendering lifecycle primitives
 * for all interactive game objects (Player, Baddies, Collectibles, Hazards, etc.)
 */
class Entity {
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
Entity;


// ==========================================
// Module: entities/Collectable.js
// ==========================================
/**
 * Collectable.js - Interactive Item & Powerup System for The Game Enhanced Edition
 * Types:
 * - 'coin' : Golden coins that award score and build combo chains.
 * - 'extraLife' : Glowing heart item granting +1 Life.
 * - 'speed' : Lightning speed booster (+50% speed for 10 seconds).
 * - 'shield' : Prismatic invincibility star/shield (8 seconds of complete immunity).
 * - 'key' : Level progression keys unlocking maze finish gates.
 * - 'gem' : High-value diamond collectibles.
 */
class Collectable extends Entity {
    /**
     * @param {Object} options
     * @param {string} [options.itemType='coin'] - 'coin' | 'extraLife' | 'speed' | 'shield' | 'key' | 'gem'
     * @param {number} [options.x=0]
     * @param {number} [options.y=0]
     * @param {number} [options.scoreValue]
     */
    constructor(options = {}) {
        const itemType = options.itemType ?? options.type ?? (options.isExtraLife ? 'extraLife' : (options.isSpeedBoost ? 'speed' : 'coin'));
        const size = itemType === 'coin' ? 18 : 22;

        super({
            x: options.x ?? options.cx ?? 0,
            y: options.y ?? options.cy ?? 0,
            width: options.width ?? size,
            height: options.height ?? size,
            tag: 'collectable',
            layer: 2
        });

        this.itemType = itemType;
        this.scoreValue = options.scoreValue ?? this.getDefaultScore(itemType);

        // Floating Sine-Wave Bobbing Parameters
        this.baseY = this.y;
        this.bobSpeed = 3.5 + Math.random() * 0.8;
        this.bobAmplitude = itemType === 'coin' ? 4 : 5;
        this.bobPhase = options.phase ?? Math.random() * Math.PI * 2;
        this.animTime = this.bobPhase;

        // Sparkle particle emitter timer
        this.sparkleTimer = Math.random() * 0.5;
        this.sparkleInterval = itemType === 'coin' ? 1.2 : 0.6; // Powerups sparkle more frequently

        this.particles = options.particles ?? null;
        this.audio = options.audio ?? null;
    }

    getDefaultScore(type) {
        switch (type) {
            case 'coin': return 100;
            case 'gem': return 500;
            case 'extraLife': return 500;
            case 'speed': return 250;
            case 'shield': return 300;
            case 'key': return 500;
            default: return 100;
        }
    }

    update(dt) {
        if (!this.alive) return;

        this.animTime += dt;

        // Floating Sine-Wave Bobbing
        this.y = this.baseY + Math.sin(this.animTime * this.bobSpeed) * this.bobAmplitude;

        // Periodic Sparkle Emission
        this.sparkleTimer += dt;
        if (this.sparkleTimer >= this.sparkleInterval) {
            this.sparkleTimer = 0;
            this.emitAmbientSparkle();
        }
    }

    emitAmbientSparkle() {
        if (!this.particles || !this.particles.createAmbientSparkle) return;

        const color = this.getSparkleColor();
        this.particles.createAmbientSparkle(
            this.cx + (Math.random() - 0.5) * this.width,
            this.cy + (Math.random() - 0.5) * this.height,
            color
        );
    }

    getSparkleColor() {
        switch (this.itemType) {
            case 'coin': return '#ffd700';
            case 'gem': return '#00f5d4';
            case 'extraLife': return '#ff0055';
            case 'speed': return '#00b4d8';
            case 'shield': return '#9d4edd';
            case 'key': return '#ffb703';
            default: return '#ffffff';
        }
    }

    draw(ctx) {
        const hw = this.width / 2;
        const hh = this.height / 2;

        ctx.save();

        if (this.sprite && this.sprite.draw) {
            this.sprite.draw(ctx, -hw, -hh, this.width, this.height);
            ctx.restore();
            return;
        }

        // Draw customized procedural vector visuals for each item type
        switch (this.itemType) {
            case 'coin':
                this.drawCoin(ctx, hw, hh);
                break;
            case 'extraLife':
                this.drawExtraLife(ctx, hw, hh);
                break;
            case 'speed':
                this.drawSpeedBoost(ctx, hw, hh);
                break;
            case 'shield':
                this.drawShield(ctx, hw, hh);
                break;
            case 'key':
                this.drawKey(ctx, hw, hh);
                break;
            case 'gem':
                this.drawGem(ctx, hw, hh);
                break;
            default:
                this.drawCoin(ctx, hw, hh);
                break;
        }

        ctx.restore();
    }

    /** Shiny 3D spinning coin */
    drawCoin(ctx, hw, hh) {
        // Perspective rotation scale (-1 to 1)
        const spinScale = Math.cos(this.animTime * 4.5);
        const r = Math.min(hw, hh);

        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;

        ctx.save();
        ctx.scale(spinScale, 1);

        // Outer Gold Ring
        const grad = ctx.createLinearGradient(-r, -r, r, r);
        grad.addColorStop(0, '#fff3b0');
        grad.addColorStop(0.4, '#ffb703');
        grad.addColorStop(1, '#fb8500');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner Coin Inscription Rim
        ctx.fillStyle = '#f77f00';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Star / Star-burst center
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(-2, -r * 0.45, 4, r * 0.9);
        ctx.fillRect(-r * 0.45, -2, r * 0.9, 4);

        ctx.restore();
    }

    /** Pulsing Heart (Extra Life) */
    drawExtraLife(ctx, hw, hh) {
        const pulse = 1 + Math.sin(this.animTime * 6) * 0.12;

        ctx.save();
        ctx.scale(pulse, pulse);

        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;

        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        const topCurveHeight = hh * 0.6;
        ctx.moveTo(0, topCurveHeight);
        // top left curve
        ctx.bezierCurveTo(-hw, -hh * 0.4, -hw * 1.1, -hh, 0, -hh * 0.2);
        // top right curve
        ctx.bezierCurveTo(hw * 1.1, -hh, hw, -hh * 0.4, 0, topCurveHeight);
        ctx.fill();

        // Highlight shine on heart lobe
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-hw * 0.35, -hh * 0.45, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /** Lightning Bolt (Speed Boost) */
    drawSpeedBoost(ctx, hw, hh) {
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 10;

        // Background energy disk
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, hw);
        grad.addColorStop(0, 'rgba(0, 245, 212, 0.4)');
        grad.addColorStop(1, 'rgba(0, 180, 216, 0.1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, hw, 0, Math.PI * 2);
        ctx.fill();

        // Lightning Bolt
        ctx.fillStyle = '#ffea00';
        ctx.strokeStyle = '#ff9100';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(2, -hh + 2);
        ctx.lineTo(-hw + 3, 1);
        ctx.lineTo(0, 1);
        ctx.lineTo(-2, hh - 2);
        ctx.lineTo(hw - 3, -1);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    /** Prismatic Star (Invincibility Shield) */
    drawShield(ctx, hw, hh) {
        const hue = (this.animTime * 200) % 360;
        ctx.shadowColor = `hsl(${hue}, 100%, 65%)`;
        ctx.shadowBlur = 12;

        // Rotating 5-point star
        ctx.save();
        ctx.rotate(this.animTime * 2.5);

        ctx.fillStyle = `hsl(${hue}, 100%, 75%)`;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        const spikes = 5;
        const outerRadius = hw;
        const innerRadius = hw * 0.45;
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / spikes;

        ctx.moveTo(0, -outerRadius);
        for (let i = 0; i < spikes; i++) {
            let x = Math.cos(rot) * outerRadius;
            let y = Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = Math.cos(rot) * innerRadius;
            y = Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(0, -outerRadius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    /** Golden Key */
    drawKey(ctx, hw, hh) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;

        ctx.fillStyle = '#ffb703';
        ctx.strokeStyle = '#fb8500';
        ctx.lineWidth = 1.5;

        // Key head loop
        ctx.beginPath();
        ctx.arc(0, -hh + 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Key head inner cutout
        ctx.fillStyle = '#0a0a23';
        ctx.beginPath();
        ctx.arc(0, -hh + 6, 3, 0, Math.PI * 2);
        ctx.fill();

        // Key shaft
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(-2, -hh + 12, 4, hh + 2);

        // Key teeth
        ctx.fillRect(1, hh - 6, 5, 3);
        ctx.fillRect(1, hh - 1, 4, 3);
    }

    /** Sparkling Gem */
    drawGem(ctx, hw, hh) {
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 10;

        ctx.fillStyle = '#00f5d4';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        // Diamond facets
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, -hh * 0.3);
        ctx.lineTo(0, hh);
        ctx.lineTo(-hw, -hh * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner reflections
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw * 0.5, -hh * 0.3);
        ctx.lineTo(0, 0);
        ctx.lineTo(-hw * 0.5, -hh * 0.3);
        ctx.closePath();
        ctx.fill();
    }
}
Collectable;


// ==========================================
// Module: entities/Baddie.js
// ==========================================
/**
 * Baddie.js - Enemy Entity System for The Game Enhanced Edition
 * Features:
 * - PlatformerPatrollingBaddie: cliff detection, wall bounce, head stomp vulnerability, squish animation.
 * - MazeChasingBaddie: grid track patrol, line-of-sight raycast chase AI, alert states.
 * - Variety archetypes: FlyingBaddie, SpikeBaddie.
 */
class Baddie extends Entity {
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
class PlatformerBaddie extends Baddie {
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
class MazeBaddie extends Baddie {
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
{
    Baddie,
    PlatformerBaddie,
    MazeBaddie
};


// ==========================================
// Module: entities/Boss.js
// ==========================================
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
const BossState = {
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
class BossProjectile extends Entity {
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
class GroundShockwave extends Entity {
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
class MegaBaddieBoss extends Entity {
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

MegaBaddieBoss;


// ==========================================
// Module: entities/Player.js
// ==========================================
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
class Player extends Entity {
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
Player;


// ==========================================
// Module: levels/TitleScreen.js
// ==========================================
/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * TitleScreen.js — Retro Animated Main Menu & Level Select
 * ============================================================================
 * Features:
 * - 3D Sine-wave floating title logo with arcade gradient and shadow
 * - Full interactive menu:
 *   - "START GAME" (Starts fresh run at Level 1)
 *   - "LEVEL SELECT" (Choose Level 1, Level 2, or Level 3 Boss)
 *   - "HOW TO PLAY" (Controls and power-up guide overlay)
 *   - "HIGH SCORES" (Leaderboard view with local storage persistence)
 *   - "CLASSIC 2014 MODE" (Switch to original 2014 edition)
 * - Seamless multi-input navigation: Keyboard (Arrows/WASD), Gamepad D-pad, and Mouse/Touch
 * - Animated background with twinkling stars, floating coins, and running mini sprites
 */
class TitleScreen {
    /**
     * @param {Object} options
     * @param {import('../audio/SoundSynth.js').SoundSynth} [options.audio]
     * @param {import('../fx/ParticleSystem.js').ParticleSystem} [options.particles]
     * @param {import('../core/Storage.js').StorageManager} [options.storage]
     * @param {import('../ui/HUD.js').HUD} [options.hud]
     * @param {Function} [options.onSelectOption] - Callback (optionId, extra) => void
     */
    constructor(options = {}) {
        this.width = 800;
        this.height = 600;

        this.audio = options.audio ?? null;
        this.input = options.input ?? null;
        this.particles = options.particles ?? null;
        this.storage = options.storage ?? null;
        this.hud = options.hud ?? null;
        this.onSelectOption = options.onSelectOption ?? null;

        // Menu Modes: 'MAIN' | 'LEVEL_SELECT' | 'HOW_TO_PLAY' | 'HIGH_SCORES'
        this.menuMode = 'MAIN';

        // Main Menu Options
        this.mainOptions = [
            { id: 'start', label: 'START GAME', desc: 'Begin from Level 1' },
            { id: 'level_select', label: 'LEVEL SELECT', desc: 'Jump to any stage' },
            { id: 'how_to_play', label: 'HOW TO PLAY', desc: 'Controls & mechanics' },
            { id: 'high_scores', label: 'HIGH SCORES', desc: 'View local leaderboard' },
            { id: 'classic', label: 'CLASSIC 2014 MODE', desc: 'Play original 2014 game' }
        ];

        // Level Select Options
        this.levelSelectOptions = [
            { id: 'level1', label: 'LEVEL 1: GREEN HILLS', desc: 'Classic side-scrolling platformer' },
            { id: 'level2', label: 'LEVEL 2: NEON MAZE', desc: 'Top-down arcade speed track' },
            { id: 'level3', label: 'LEVEL 3: MEGA BADDIE', desc: 'Epic boss arena encounter' },
            { id: 'back', label: '◄ BACK TO MENU', desc: 'Return to title options' }
        ];

        this.selectedIndex = 0;
        this.animTime = 0;
        this.sineOffset = 0;

        // Animated Background Stars & Floating Coins
        this.stars = [];
        this._initStars();

        this.floatingCoins = [
            { x: 100, baseY: 420, phase: 0, speed: 2.2 },
            { x: 700, baseY: 420, phase: 1.8, speed: 2.5 },
            { x: 180, baseY: 180, phase: 3.1, speed: 1.8 },
            { x: 620, baseY: 180, phase: 4.5, speed: 2.0 }
        ];

        // Mini runner animation along bottom
        this.miniRunnerX = -40;
        this.miniBaddieX = -100;

        // Play Title Chiptune Music
        this.init();
    }

    init() {
        this.animTime = 0;
        this.sineOffset = 0;
        this.selectedIndex = 0;
        this.menuMode = 'MAIN';
        this._initStars();
        this.audio?.playMusic?.('menu');
        this.hud?.hideBoss?.();
        this.hud?.setTopBarVisible?.(false);
    }

    render(ctx) {
        this.draw(ctx);
    }

    _initStars() {
        this.stars = [];
        for (let i = 0; i < 75; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 1,
                alpha: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 4 + 2
            });
        }
    }

    /** Returns current active list of options based on menuMode */
    get currentOptions() {
        if (this.menuMode === 'LEVEL_SELECT') {
            return this.levelSelectOptions;
        }
        return this.mainOptions;
    }

    // =========================================================================
    // UPDATE & INPUT HANDLING
    // =========================================================================
    update(dt, input) {
        this.animTime += dt;
        this.sineOffset += dt * 3;

        // Mini Runners along bottom edge
        this.miniRunnerX += 130 * dt;
        this.miniBaddieX += 130 * dt;
        if (this.miniRunnerX > this.width + 120) {
            this.miniRunnerX = -60;
            this.miniBaddieX = -120;
        }

        // Handle Input
        const activeInput = input || this.input;
        if (activeInput) {
            this._handleInput(activeInput);
        }
    }

    _handleInput(input) {
        if (this.menuMode === 'HOW_TO_PLAY' || this.menuMode === 'HIGH_SCORES') {
            // Any button returns to main menu
            if (
                input.isPressed(Action.JUMP) ||
                input.isPressed(Action.ACTION) ||
                input.isPressed(Action.PAUSE)
            ) {
                input.eat(Action.JUMP);
                input.eat(Action.ACTION);
                input.eat(Action.PAUSE);
                this.menuMode = 'MAIN';
                this.selectedIndex = 0;
                this.audio?.playJump?.();
            }
            return;
        }

        const options = this.currentOptions;
        const upPressed = input.isPressed(Action.UP);
        const downPressed = input.isPressed(Action.DOWN);

        // Navigate Up
        if (upPressed) {
            input.eat(Action.UP);
            this.selectedIndex = (this.selectedIndex - 1 + options.length) % options.length;
            this.audio?.playJump?.();
        }

        // Navigate Down
        if (downPressed) {
            input.eat(Action.DOWN);
            this.selectedIndex = (this.selectedIndex + 1) % options.length;
            this.audio?.playJump?.();
        }

        // Select Option
        if (
            (input.isPressed(Action.JUMP) && !upPressed) ||
            input.isPressed(Action.ACTION)
        ) {
            input.eat(Action.JUMP);
            input.eat(Action.ACTION);
            this._triggerSelectedOption();
        }
    }

    _triggerSelectedOption() {
        const option = this.currentOptions[this.selectedIndex];
        if (!option) return;

        this.audio?.playPowerup?.();

        if (this.menuMode === 'MAIN') {
            switch (option.id) {
                case 'start':
                    if (this.onSelectOption) this.onSelectOption('start_game');
                    break;
                case 'level_select':
                    this.menuMode = 'LEVEL_SELECT';
                    this.selectedIndex = 0;
                    break;
                case 'how_to_play':
                    this.menuMode = 'HOW_TO_PLAY';
                    break;
                case 'high_scores':
                    this.menuMode = 'HIGH_SCORES';
                    break;
                case 'classic':
                    if (this.onSelectOption) this.onSelectOption('classic_mode');
                    break;
            }
        } else if (this.menuMode === 'LEVEL_SELECT') {
            switch (option.id) {
                case 'level1':
                    if (this.onSelectOption) this.onSelectOption('load_level', 1);
                    break;
                case 'level2':
                    if (this.onSelectOption) this.onSelectOption('load_level', 2);
                    break;
                case 'level3':
                    if (this.onSelectOption) this.onSelectOption('load_level', 3);
                    break;
                case 'back':
                    this.menuMode = 'MAIN';
                    this.selectedIndex = 1; // Return cursor to LEVEL SELECT
                    break;
            }
        }
    }

    /**
     * Mouse / Touch Click handler
     * @param {number} mouseX
     * @param {number} mouseY
     */
    handleClick(mouseX, mouseY) {
        if (this.menuMode === 'HOW_TO_PLAY' || this.menuMode === 'HIGH_SCORES') {
            this.menuMode = 'MAIN';
            this.selectedIndex = 0;
            this.audio?.playJump?.();
            return;
        }

        const options = this.currentOptions;
        const startY = this.menuMode === 'LEVEL_SELECT' ? 290 : 270;
        const itemH = 44;

        for (let i = 0; i < options.length; i++) {
            const itemY = startY + (i * itemH);
            if (mouseX >= 220 && mouseX <= 580 && mouseY >= itemY - 20 && mouseY <= itemY + 18) {
                this.selectedIndex = i;
                this._triggerSelectedOption();
                return;
            }
        }
    }

    // =========================================================================
    // RENDERING
    // =========================================================================
    draw(ctx) {
        // 1. Cosmic Gradient & Twinkling Stars
        this._drawBackground(ctx);

        // 2. Floating Coins FX
        this._drawFloatingCoins(ctx);

        // 3. Mini Runners along bottom floor
        this._drawMiniRunners(ctx);

        // 4. Modal Overlays (How to Play / High Scores) or Standard Title Menu
        if (this.menuMode === 'HOW_TO_PLAY') {
            this._drawHowToPlay(ctx);
        } else if (this.menuMode === 'HIGH_SCORES') {
            this._drawHighScores(ctx);
        } else {
            // Main Logo with 3D Sine Wave
            this._drawFloatingTitle(ctx);

            // Subtitle
            ctx.font = '11px "Press Start 2P", monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00e5ff';
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 8;
            ctx.fillText('— ENHANCED REMASTER EDITION —', this.width / 2, 215);

            // Options List
            this._drawOptions(ctx);
        }

        // 5. Controls Hints Footer
        this._drawFooter(ctx);
    }

    _drawBackground(ctx) {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#06070d');
        bgGrad.addColorStop(0.6, '#0f111e');
        bgGrad.addColorStop(1, '#1b1429');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Stars
        for (const s of this.stars) {
            const alpha = s.alpha + Math.sin(this.animTime * s.twinkleSpeed) * 0.25;
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1.0, alpha))})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Subtle bottom platform strip
        ctx.fillStyle = '#222538';
        ctx.fillRect(0, this.height - 40, this.width, 40);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(0, this.height - 40, this.width, 2);
    }

    _drawFloatingTitle(ctx) {
        ctx.save();
        const floatY = 120 + Math.sin(this.sineOffset) * 14;

        ctx.translate(this.width / 2, floatY);

        // 3D Shadow Layers
        const titleText = 'THE GAME!';
        ctx.font = 'bold 52px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';

        // Deep Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillText(titleText, 0, 12);

        // Retro Orange Extrusion Layers
        for (let i = 8; i > 0; i--) {
            ctx.fillStyle = '#b7410e';
            ctx.fillText(titleText, 0, i);
        }

        // Front Face Gradient
        const faceGrad = ctx.createLinearGradient(0, -35, 0, 5);
        faceGrad.addColorStop(0, '#ffffff');
        faceGrad.addColorStop(0.3, '#ffd60a');
        faceGrad.addColorStop(0.8, '#ff9900');
        faceGrad.addColorStop(1, '#ff3b30');
        ctx.fillStyle = faceGrad;

        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = 18;
        ctx.fillText(titleText, 0, 0);

        ctx.restore();
    }

    _drawOptions(ctx) {
        const options = this.currentOptions;
        const startY = this.menuMode === 'LEVEL_SELECT' ? 280 : 260;
        const itemH = 46;

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const itemY = startY + (i * itemH);
            const isSelected = i === this.selectedIndex;

            ctx.save();

            if (isSelected) {
                // Glowing Selected Capsule Pill
                ctx.fillStyle = 'rgba(255, 153, 0, 0.18)';
                ctx.strokeStyle = '#ff9900';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#ff9900';
                ctx.shadowBlur = 12;

                ctx.beginPath();
                ctx.roundRect(200, itemY - 24, 400, 38, 8);
                ctx.fill();
                ctx.stroke();

                // Left & Right Selection Arrows
                ctx.fillStyle = '#ffd60a';
                ctx.font = '14px "Press Start 2P", monospace, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('▶', 180, itemY);
                ctx.fillText('◀', 620, itemY);

                // Selected Text Color
                ctx.fillStyle = '#ffffff';
            } else {
                // Inactive Item
                ctx.fillStyle = '#8c96b5';
            }

            // Main Label
            ctx.font = 'bold 15px "Press Start 2P", monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(opt.label, this.width / 2, itemY);

            // Subtitle Description on selected item
            if (isSelected && opt.desc) {
                ctx.font = '10px "Outfit", sans-serif';
                ctx.fillStyle = '#ffd60a';
                ctx.shadowBlur = 0;
                ctx.fillText(opt.desc, this.width / 2, itemY + 28);
            }

            ctx.restore();
        }
    }

    _drawFloatingCoins(ctx) {
        for (const coin of this.floatingCoins) {
            ctx.save();
            const y = coin.baseY + Math.sin(this.animTime * coin.speed + coin.phase) * 12;
            ctx.translate(coin.x, y);

            ctx.shadowColor = '#ffd60a';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffd60a';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();

            // Inner Ring
            ctx.strokeStyle = '#ff9900';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();

            // Dollar / Star Mark
            ctx.fillStyle = '#ff9900';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);

            ctx.restore();
        }
    }

    _drawMiniRunners(ctx) {
        const floorY = this.height - 40;

        // Mini Dude
        ctx.save();
        ctx.translate(this.miniRunnerX, floorY - 14);
        ctx.fillStyle = '#00f5d4';
        ctx.fillRect(-8, -14, 16, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -10, 4, 4); // Eye
        ctx.restore();

        // Mini Baddie chasing
        ctx.save();
        ctx.translate(this.miniBaddieX, floorY - 10);
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(2, -6, 4, 4); // Eye
        ctx.restore();
    }

    _drawHowToPlay(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 12, 22, 0.92)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.roundRect(100, 70, 600, 460, 12);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.font = 'bold 20px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd60a';
        ctx.fillText('HOW TO PLAY', this.width / 2, 120);

        // Sections
        ctx.font = '12px "Press Start 2P", monospace, sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('🎮 CONTROLS', this.width / 2, 165);

        ctx.font = '14px "Outfit", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('• Move / Run : Arrow Keys or A / D', this.width / 2, 195);
        ctx.fillText('• Jump / Bounce : Spacebar or W / Up Arrow', this.width / 2, 220);
        ctx.fillText('• Pause / Menu : P or Escape', this.width / 2, 245);

        ctx.font = '12px "Press Start 2P", monospace, sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('⚡ MECHANICS & POWERUPS', this.width / 2, 290);

        ctx.font = '14px "Outfit", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('• Enemy Stomp: Land on enemies from above to squash & bounce!', this.width / 2, 320);
        ctx.fillText('• Speed Boost: Grab lightning powerups for blazing speed.', this.width / 2, 345);
        ctx.fillText('• Invincibility Shield: Gain rainbow invulnerability aura.', this.width / 2, 370);
        ctx.fillText('• Boss Battle: Stun the Mega Baddie to stomp its weak spot!', this.width / 2, 395);

        // Return Prompt
        ctx.font = 'bold 12px "Press Start 2P", monospace, sans-serif';
        ctx.fillStyle = '#ffd60a';
        ctx.fillText('PRESS SPACE OR CLICK TO RETURN', this.width / 2, 480);

        ctx.restore();
    }

    _drawHighScores(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 12, 22, 0.92)';
        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffd60a';
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.roundRect(100, 70, 600, 460, 12);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.font = 'bold 20px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd60a';
        ctx.fillText('HIGH SCORES LEADERBOARD', this.width / 2, 120);

        // Fetch high scores from storage
        const scores = this.storage?.getHighScores?.() || [
            { name: 'DUDE', score: 15000, stage: 'Level 3 Boss', time: '02:45' },
            { name: 'ACE', score: 12000, stage: 'Level 2 Maze', time: '03:10' },
            { name: 'RETRO', score: 8500, stage: 'Level 1 Hills', time: '04:15' }
        ];

        // Header Row
        ctx.font = 'bold 11px "Press Start 2P", monospace, sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.textAlign = 'left';
        ctx.fillText('RANK', 150, 170);
        ctx.fillText('PLAYER', 240, 170);
        ctx.fillText('STAGE', 370, 170);
        ctx.fillText('SCORE', 570, 170);

        // Scores List
        ctx.font = '14px "Outfit", sans-serif';
        for (let i = 0; i < Math.min(6, scores.length); i++) {
            const sc = scores[i];
            const y = 210 + (i * 38);

            ctx.fillStyle = i === 0 ? '#ffd60a' : (i === 1 ? '#00e5ff' : '#ffffff');
            ctx.fillText(`#${i + 1}`, 150, y);
            ctx.fillText(sc.name || 'ANON', 240, y);
            ctx.fillText(sc.stage || 'ALL STAGES', 370, y);
            ctx.fillText(String(sc.score || 0).padStart(6, '0'), 570, y);
        }

        // Return Prompt
        ctx.font = 'bold 12px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd60a';
        ctx.fillText('PRESS SPACE OR CLICK TO RETURN', this.width / 2, 480);

        ctx.restore();
    }

    _drawFooter(ctx) {
        ctx.save();
        ctx.font = '10px "Press Start 2P", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(140, 150, 180, 0.75)';
        ctx.fillText('▲/▼ NAVIGATE   •   SPACE / ENTER TO SELECT', this.width / 2, this.height - 16);
        ctx.restore();
    }
}


// ==========================================
// Module: levels/Level1Platformer.js
// ==========================================
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
class Checkpoint {
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
class GoalFlag {
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
class Level1Platformer {
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
Level1Platformer;


// ==========================================
// Module: levels/Level2Maze.js
// ==========================================
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
class BoosterPad {
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
class FinishGate {
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
class Level2Maze {
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
Level2Maze;


// ==========================================
// Module: levels/Level3Boss.js
// ==========================================
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
class Level3Boss {
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


// ==========================================
// Module: levels/LevelManager.js
// ==========================================
/**
 * LevelManager.js - State Machine & Progression Orchestrator
 * The Game! — Enhanced Edition
 * 
 * Manages transitions between:
 * - TITLE -> LEVEL_1 -> LEVEL_2 -> LEVEL_3_BOSS -> VICTORY -> GAME_OVER
 * - Preserves player stats (Score, Lives, Elapsed Time, Best Times) across levels
 * - Connects Camera, ParticleSystem, SoundSynth, HUD, and StorageManager
 */
const GameState = {
    TITLE: 'TITLE',
    LEVEL_1: 'LEVEL_1',
    LEVEL_2: 'LEVEL_2',
    LEVEL_3_BOSS: 'LEVEL_3_BOSS',
    VICTORY: 'VICTORY',
    GAME_OVER: 'GAME_OVER'
};
class LevelManager {
    /**
     * @param {Object} options
     * @param {HTMLCanvasElement} options.canvas
     * @param {import('../core/Input.js').Input} options.input
     * @param {import('../core/Camera.js').Camera} options.camera
     * @param {import('../audio/SoundSynth.js').SoundSynth} options.audio
     * @param {import('../fx/ParticleSystem.js').ParticleSystem} options.particles
     * @param {import('../ui/HUD.js').HUD} options.hud
     * @param {import('../core/Storage.js').StorageManager} options.storage
     */
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.input = options.input;
        this.camera = options.camera;
        this.audio = options.audio;
        this.particles = options.particles;
        this.hud = options.hud;
        this.storage = options.storage;

        // Current Active State
        this.state = GameState.TITLE;
        this.currentLevel = null;

        // Persistent Player Session Stats
        this.sessionScore = 0;
        this.sessionLives = 3;
        this.sessionTime = 0;

        // Overlay screen timers
        this.animTime = 0;
        this.victoryParticlesTimer = 0;

        // Instantiate Title Screen
        this.titleScreen = new TitleScreen({
            audio: this.audio,
            input: this.input,
            storage: this.storage,
            onSelectOption: (optionId) => this.handleTitleSelection(optionId)
        });

        // Bind HUD event listeners if available
        if (this.hud) {
            this.hud.callbacks.onRestart = () => this.restartCurrentLevel();
            this.hud.callbacks.onQuitToMenu = () => this.goToTitle();
        }
    }

    init() {
        this.goToTitle();
    }

    goToTitle() {
        this.state = GameState.TITLE;
        this.currentLevel = this.titleScreen;
        this.titleScreen.init();
        this.particles?.clear?.();
        this.hud?.hideBossBar?.();
        this.hud?.setTopBarVisible?.(false);
    }

    handleTitleSelection(optionId, extra = 1) {
        this.sessionScore = 0;
        this.sessionLives = 3;
        this.sessionTime = 0;

        switch (optionId) {
            case 'start':
            case 'start_game':
            case 'level1':
                this.loadLevel(GameState.LEVEL_1);
                break;
            case 'level2':
                this.loadLevel(GameState.LEVEL_2);
                break;
            case 'level3':
                this.loadLevel(GameState.LEVEL_3_BOSS);
                break;
            case 'load_level':
                if (extra === 1) this.loadLevel(GameState.LEVEL_1);
                else if (extra === 2) this.loadLevel(GameState.LEVEL_2);
                else if (extra === 3) this.loadLevel(GameState.LEVEL_3_BOSS);
                break;
            case 'classic':
            case 'classic_mode':
                window.location.href = '../classic/THEGAME.html';
                break;
        }
    }

    handleClick(x, y) {
        if (this.currentLevel?.handleClick) {
            this.currentLevel.handleClick(x, y);
        } else if (this.state === GameState.VICTORY || this.state === GameState.GAME_OVER) {
            this.goToTitle();
        }
    }

    loadLevel(state) {
        this.state = state;
        this.particles?.clear?.();
        this.hud?.hideBossBar?.();
        this.hud?.setTopBarVisible?.(true);

        const playerStats = {
            score: this.sessionScore,
            lives: this.sessionLives
        };

        switch (state) {
            case GameState.LEVEL_1:
                this.hud?.setLevelTitle?.('LEVEL 1: PLATFORMER');
                this.currentLevel = new Level1Platformer({
                    audio: this.audio,
                    particles: this.particles,
                    camera: this.camera,
                    hud: this.hud,
                    onComplete: (stats) => {
                        this.sessionScore = stats.score;
                        this.sessionLives = stats.lives;
                        this.loadLevel(GameState.LEVEL_2);
                    },
                    onGameOver: (finalScore) => this.triggerGameOver(finalScore)
                });
                if (this.currentLevel.player) {
                    this.currentLevel.player.score = this.sessionScore;
                    this.currentLevel.player.lives = this.sessionLives;
                }
                break;

            case GameState.LEVEL_2:
                this.hud?.setLevelTitle?.('LEVEL 2: MAZE RUNNER');
                this.currentLevel = new Level2Maze({
                    audio: this.audio,
                    particles: this.particles,
                    camera: this.camera,
                    hud: this.hud,
                    onComplete: (stats) => {
                        this.sessionScore = stats.score;
                        this.sessionLives = stats.lives;
                        this.loadLevel(GameState.LEVEL_3_BOSS);
                    },
                    onGameOver: (finalScore) => this.triggerGameOver(finalScore)
                });
                if (this.currentLevel.player) {
                    this.currentLevel.player.score = this.sessionScore;
                    this.currentLevel.player.lives = this.sessionLives;
                }
                break;

            case GameState.LEVEL_3_BOSS:
                this.hud?.setLevelTitle?.('LEVEL 3: MEGA BADDIE BOSS');
                this.currentLevel = new Level3Boss({
                    audio: this.audio,
                    particles: this.particles,
                    camera: this.camera,
                    hud: this.hud,
                    onComplete: (stats) => {
                        this.sessionScore = stats.score;
                        this.sessionLives = stats.lives;
                        this.triggerVictory();
                    },
                    onGameOver: (finalScore) => this.triggerGameOver(finalScore)
                });
                if (this.currentLevel.player) {
                    this.currentLevel.player.score = this.sessionScore;
                    this.currentLevel.player.lives = this.sessionLives;
                }
                break;
        }
    }

    triggerVictory() {
        this.state = GameState.VICTORY;
        this.audio?.playMusic?.('menu');
        this.hud?.hideBossBar?.();
        this.hud?.showToast('CONGRATULATIONS! YOU BEAT THE GAME!', 'achievement');
        this.storage?.saveHighScore?.(this.sessionScore);
    }

    triggerGameOver(finalScore) {
        this.state = GameState.GAME_OVER;
        this.sessionScore = finalScore ?? this.sessionScore;
        this.audio?.playDie?.();
        this.audio?.stopMusic?.();
        this.hud?.hideBossBar?.();
        this.storage?.saveHighScore?.(this.sessionScore);
    }

    restartCurrentLevel() {
        if (this.state === GameState.LEVEL_1 || this.state === GameState.LEVEL_2 || this.state === GameState.LEVEL_3_BOSS) {
            this.loadLevel(this.state);
        } else {
            this.goToTitle();
        }
    }

    update(du, dtMs) {
        const dt = dtMs / 1000;
        this.animTime += dt;

        // Global key actions (Restart / Skip)
        if (this.input?.eat?.(Action.RESTART)) {
            this.restartCurrentLevel();
            return;
        }

        if (this.input?.eat?.(Action.SKIP_LEVEL)) {
            if (this.state === GameState.LEVEL_1) this.loadLevel(GameState.LEVEL_2);
            else if (this.state === GameState.LEVEL_2) this.loadLevel(GameState.LEVEL_3_BOSS);
            else if (this.state === GameState.LEVEL_3_BOSS) this.triggerVictory();
            return;
        }

        // Update active state
        if (this.state === GameState.TITLE) {
            this.titleScreen.update(dt, this.input);
        } else if (this.state === GameState.VICTORY) {
            this.updateVictory(dt);
        } else if (this.state === GameState.GAME_OVER) {
            this.updateGameOver(dt);
        } else if (this.currentLevel) {
            this.sessionTime += dt;
            this.currentLevel.update(dt, this.input);

            // Update Camera lerp (Level1/Level2 set targetX/targetY via follow())
            if (this.camera) {
                this.camera.update(du);
            }

            // Update live HUD stats
            if (this.hud && this.currentLevel.player) {
                const p = this.currentLevel.player;
                this.hud.updateHealth(p.lives);
                this.hud.updateScore(p.score);
                this.hud.updateCombo(p.comboCount, p.comboMultiplier, p.comboTimer / p.comboDuration);
                this.hud.updateTimer(this.sessionTime);
            }
        }

        // Update global particles
        if (this.particles) {
            this.particles.update(dt);
        }
    }

    updateVictory(dt) {
        this.victoryParticlesTimer -= dt;
        if (this.victoryParticlesTimer <= 0) {
            this.victoryParticlesTimer = 0.4;
            const rx = 100 + Math.random() * (this.canvas.width - 200);
            const ry = 80 + Math.random() * 250;
            this.particles?.emitFireworks?.(rx, ry, 25);
        }

        if (this.input?.eat?.(Action.JUMP) || this.input?.eat?.(Action.ACTION) || this.input?.eat?.(Action.PAUSE)) {
            this.goToTitle();
        }
    }

    updateGameOver(dt) {
        if (this.input?.eat?.(Action.JUMP) || this.input?.eat?.(Action.ACTION) || this.input?.eat?.(Action.PAUSE)) {
            this.goToTitle();
        }
    }

    render(ctx) {
        ctx.save();

        if (this.state === GameState.TITLE) {
            this.titleScreen.render(ctx);
        } else if (this.state === GameState.VICTORY) {
            this.renderVictory(ctx);
        } else if (this.state === GameState.GAME_OVER) {
            this.renderGameOver(ctx);
        } else if (this.currentLevel) {
            // Apply Camera Transform
            if (this.camera) {
                this.camera.begin(ctx);
            }

            // Render Level World
            this.currentLevel.render(ctx, this.camera);

            // Render Particles in world space
            if (this.particles) {
                this.particles.render(ctx, this.camera);
            }

            // Restore Camera Transform
            if (this.camera) {
                this.camera.end(ctx);
            }
        }

        ctx.restore();
    }

    renderVictory(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Dark festive background
        ctx.fillStyle = '#0a0d1a';
        ctx.fillRect(0, 0, w, h);

        // Render fireworks particles in screen space
        if (this.particles) {
            this.particles.render(ctx, null);
        }

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '28px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 20;
        ctx.fillText('★ VICTORY! ★', w / 2, h * 0.3);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#06d6a0';
        ctx.shadowColor = '#06d6a0';
        ctx.shadowBlur = 10;
        ctx.fillText('YOU CONQUERED ALL 3 STAGES & DEFEATED MEGA BADDIE!', w / 2, h * 0.4);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`FINAL SCORE: ${this.sessionScore.toLocaleString()} PTS`, w / 2, h * 0.52);

        const mins = Math.floor(this.sessionTime / 60);
        const secs = Math.floor(this.sessionTime % 60);
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#8c96b5';
        ctx.fillText(`COMPLETION TIME: ${mins}:${secs < 10 ? '0' : ''}${secs}`, w / 2, h * 0.6);

        ctx.fillStyle = '#ff9900';
        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = 15;
        ctx.font = '13px "Press Start 2P", monospace';
        ctx.fillText('► PRESS SPACE OR CLICK TO RETURN TO TITLE ◄', w / 2, h * 0.78);

        ctx.restore();
    }

    renderGameOver(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        ctx.fillStyle = 'rgba(15, 5, 10, 0.95)';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '32px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff3b30';
        ctx.shadowColor = '#ff3b30';
        ctx.shadowBlur = 25;
        ctx.fillText('GAME OVER', w / 2, h * 0.35);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd166';
        ctx.shadowBlur = 10;
        ctx.fillText(`SCORE: ${this.sessionScore.toLocaleString()} PTS`, w / 2, h * 0.5);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('► PRESS SPACE TO TRY AGAIN ◄', w / 2, h * 0.68);

        ctx.restore();
    }
}


// ==========================================
// Module: main.js
// ==========================================
/**
 * main.js - Master Game Bootstrapper & Lifecycle Controller
 * The Game! — Enhanced Edition
 */








window.addEventListener('DOMContentLoaded', () => {
    // 1. Canvas & Viewport Setup
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element #gameCanvas not found!');
        return;
    }

    const ctx = canvas.getContext('2d');

    // 2. Initialize Subsystems
    const storage = new StorageManager();
    const input = new Input({ targetElement: window });
    const audio = new SoundSynth();
    const particles = new ParticleSystem();
    const camera = new Camera({
        viewportWidth: canvas.width,
        viewportHeight: canvas.height,
        lerpFactor: 0.08
    });

    // 3. Initialize HUD and DOM Controls
    const hudContainer = document.getElementById('hudContainer') || document.body;
    const hud = new HUD({
        container: hudContainer,
        input: input,
        storage: storage
    });

    // Connect Audio to HUD Settings
    if (audio) {
        hud.callbacks.onVolumeChange = (vol) => audio.setVolume(vol / 100);
        hud.callbacks.onMusicVolumeChange = (vol) => audio.setMusicVolume(vol / 100);
        hud.callbacks.onMuteToggle = (isMuted) => audio.setMuted(isMuted);
    }

    // 4. Initialize Level Manager
    const levelManager = new LevelManager({
        canvas: canvas,
        input: input,
        camera: camera,
        audio: audio,
        particles: particles,
        hud: hud,
        storage: storage
    });

    // 5. Initialize Core Engine
    const engine = new Engine({
        canvas: canvas,
        update: (du, dt) => {
            input.update();

            // Check pause toggle
            if (input.eat(Action.PAUSE)) {
                engine.togglePause();
                hud.setPaused(engine.isPaused);
            }

            // Check mute toggle
            if (input.eat(Action.MUTE)) {
                const muted = audio.toggleMute();
                hud.showToast(muted ? 'AUDIO MUTED' : 'AUDIO UNMUTED', 'audio');
            }

            // Check fullscreen toggle
            if (input.eat(Action.FULLSCREEN)) {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            }

            levelManager.update(du, dt);
        },
        render: (ctx) => {
            // Clear canvas buffer
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Render active level and game state
            levelManager.render(ctx);
        },
        onPauseChange: (isPaused) => {
            hud.setPaused(isPaused);
        }
    });

    // 6. Canvas Mouse / Touch Click Support
    canvas.addEventListener('pointerdown', (e) => {
        // Resume Web Audio on first gesture
        audio?.resume?.();

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        levelManager.handleClick(x, y);
    });

    // 7. Start the Game!
    levelManager.init();
    engine.start();

    console.log('✨ The Game! Enhanced Edition initialized successfully.');
});


})();
