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

import { Action } from '../core/Input.js';

export class TitleScreen {
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
