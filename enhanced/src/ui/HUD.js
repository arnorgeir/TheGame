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

import { Action } from '../core/Input.js';

export class HUD {
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
