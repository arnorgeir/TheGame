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

import { Entity } from './Entity.js';

export class Collectable extends Entity {
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

export default Collectable;
