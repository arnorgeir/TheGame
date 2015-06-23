// ================
// BADDIE TWO STUFF
// ================

// A generic contructor which accepts an arbitrary descriptor object
function BaddieTwo(descr) {

    // Common inherited setup logic from Entity
    this.setup(descr);

    this.rememberResets();
    
    // Default sprite, if not otherwise specified
    this.sprite = this.sprite || g_sprites.baddieTwo;

    this.frame = this._imageMapBaddie[this.cellNum];
};

BaddieTwo.prototype = new Entity();

BaddieTwo.prototype.rememberResets = function () {
    // Remember my reset positions
    this.reset_cx = this.cx;
    this.reset_cy = this.cy;
};

// Initial, inheritable, default values
BaddieTwo.prototype.velX = 0;
BaddieTwo.prototype.velY = 0;

BaddieTwo.prototype._walkLeft = false;
BaddieTwo.prototype._walkUp = false;
BaddieTwo.prototype._walkRight = false;
BaddieTwo.prototype._walkDown = false;

BaddieTwo.prototype._nextFrame = 0;

BaddieTwo.prototype.cellWidth = 24;
BaddieTwo.prototype.cellHeight = 24;
BaddieTwo.prototype.numCels = 2;
BaddieTwo.prototype.cellNum = 0;

BaddieTwo.prototype.isBaddie = true;
BaddieTwo.prototype._doThrust = false;
BaddieTwo.prototype._isDying = false;

BaddieTwo.prototype.flipCounter = 0;
BaddieTwo.prototype.flipThresh = 500 / SECS_TO_NOMINALS;

BaddieTwo.prototype._imageMapBaddie = [
    {x: 0, y: 0},       // 0
    {x: 24, y: 0}      // 1
];

BaddieTwo.prototype.update = function (du) {
    spatialManager.unregister(this);

    if (this._isDeadNow)
        return entityManager.KILL_ME_NOW;

    this.findNextFrame();
    this.moveToNextFrame();

    // Follow the player if he comes to close.
    var target = this.findPlayer();
    if (target && target.isDude && !this._isDying) {
        this.followPlayer(du, target);
    }

    this.flipCounter += du;
    if (this.flipCounter >= this.flipThresh) {
        this.animate();
        this.flipCounter = 0;   
    }

    spatialManager.register(this);
};

// Artificial anxiety brought on by decision making!
// In other words, random walk :P
BaddieTwo.prototype.findNextFrame = function () {
    var availableDirections = [];

    for (var i = 0; i < entityManager._level[0].walkTileLoc.length; i++) {
        if (this.cx === entityManager._level[0].walkTileLoc[i].cx &&
            this.cy === entityManager._level[0].walkTileLoc[i].cy && this._nextFrame === 0) {

            if (entityManager._level[0].walkTileLoc[i].walkLeft) {
                availableDirections.push("left")
            }
            if (entityManager._level[0].walkTileLoc[i].walkUp) {
                availableDirections.push("up")
            }
            if (entityManager._level[0].walkTileLoc[i].walkRight) {
                availableDirections.push("right")           
            }
            if (entityManager._level[0].walkTileLoc[i].walkDown) {
                availableDirections.push("down")
            }
        }
    }

    var randIndex = Math.round(util.randRange(0, availableDirections.length-1));

    if (availableDirections[randIndex] === "left") {
        this._walkLeft = true;
        this._nextFrame = this.cx - this.cellWidth;
    }
    if (availableDirections[randIndex] === "up") {
        this._walkUp = true;   
        this._nextFrame = this.cy - this.cellHeight;
    }
    if (availableDirections[randIndex] === "right") {
        this._walkRight = true;   
        this._nextFrame = this.cx + this.cellWidth;
    }
    if (availableDirections[randIndex] === "down") {
        this._walkDown = true;   
        this._nextFrame = this.cy + this.cellHeight;
    }
};

BaddieTwo.prototype.moveToNextFrame = function () {
    this.velX = 3;
    this.velY = 3;

    switch (true) {
        case (this._walkLeft):
            if (this.cx > this._nextFrame) {
                this.cx -= this.velX;
            }
            else {
                this._nextFrame = 0;
                this._walkLeft = false;
            }
        break;
        case (this._walkUp):
            if (this.cy > this._nextFrame) {
                this.cy -= this.velY;
            }
            else {
                this._nextFrame = 0;
                this._walkUp = false;
            }
        break;  
        case (this._walkRight):
            if (this.cx < this._nextFrame) {
                this.cx += this.velX;
            }
            else {
                this._nextFrame = 0;
                this._walkRight = false;
            }
        break;
        case (this._walkDown):
            if (this.cy < this._nextFrame) {
                this.cy += this.velY;
            }
            else {
                this._nextFrame = 0;
                this._walkDown = false;
            }
        break;
    }
};

BaddieTwo.prototype.followPlayer = function (du, target) {
    if (!this._isDying) {
        if (this.cx < target.cx)
            this.velX = 0.5 * du;
        else
            this.velX = 0.5 * -du;
    }
    else
        this.velX = 0;
};

BaddieTwo.prototype.animate = function () {
    this.frame = this._imageMapBaddie[this.cellNum];

    this.cellNum++;

    if (this.cellNum === this._imageMapBaddie.length)
        this.cellNum = 0;
};

BaddieTwo.prototype.collideWithDude = function () {
    // Nothing to see here, move along!
    return;
};

BaddieTwo.prototype.killMeNow = function () {
    this._isDeadNow = true;
};

BaddieTwo.prototype.getRadius = function () {
    return this.cellWidth * 0.4;
};

BaddieTwo.prototype.getVision = function () {
    return this.cellWidth * 2.5;
}

BaddieTwo.prototype.reset = function () {
    this.setPos(this.reset_cx, this.reset_cy);
};

BaddieTwo.prototype.render = function (ctx) {
    this.sprite.drawFrameAt(
    	ctx,
    	this.cx - this.cellWidth/2,
    	this.cy - this.cellHeight/2,
    	this.cellWidth,
    	this.cellHeight,
    	this.frame);

    // draw line from baddie to dude
    if (g_renderSpatialDebug) {
        ctx.strokeStyle = "red";
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(entityManager._dude[0].cx, entityManager._dude[0].cy)
        ctx.stroke();
    }
};
