// ==================
// COLLECTABLES STUFF
// ==================

"use strict";

// A generic contructor which accepts an arbitrary descriptor object
function Collectables(descr) {

    // Common inherited setup logic from Entity
    this.setup(descr);

    // Remember some initial values.
    this.rememberResets();
      
    // Default sprite and scale, if not otherwise specified
    this.sprite = this.sprite || g_sprites.coin;
    
    this.scale  = this.scale  || 1;
};

Collectables.prototype = new Entity();

Collectables.prototype.rememberResets = function () {
    this.reset_cx = this.cx;
    this.reset_cy = this.cy;

    this.reset_scale = this.scale;
};

Collectables.prototype.cellWidth = 24;
Collectables.prototype.cellHeight = 24;

Collectables.prototype.update = function (du) {
    // Unregister and check for death
    spatialManager.unregister(this);

    if (this._isDeadNow)
        return entityManager.KILL_ME_NOW;

    if (this.level === 1)
        this._floatingCoins(du);

    // (Re-)Register
    spatialManager.register(this);
};

Collectables.prototype._floatingCoins = function (du) {
    this.cy = (this.cellHeight/3) * Math.sin( start ) + this.reset_cy;
        start += 0.001;
};

Collectables.prototype.killMeNow = function () {
    this._isDeadNow = true;
};

Collectables.prototype.getRadius = function () {
    if (this.level === 1)
        return (this.sprite.width / 2) * 0.9;
    else
        return (this.sprite.width / 2) * 0.5;
};

Collectables.prototype.collideWithDude = function () {
    this.killMeNow();
};

Collectables.prototype.render = function (ctx) {
    this.sprite.drawCentredAt(ctx, this.cx, this.cy, this.rotation);
};
