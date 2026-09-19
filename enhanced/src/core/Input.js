/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Universal Input Manager
 * ============================================================================
 * Supports Keyboard (Arrows + WASD), HTML5 Gamepad API, and Virtual Mobile Touch.
 * Provides both continuous state (isDown) and edge-triggered consumption (eat / isPressed).
 */

export const Action = {
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

export class Input {
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
export const input = new Input();
