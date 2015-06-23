// ==============
// DUDE TWO STUFF
// ==============

// A generic contructor which accepts an arbitrary descriptor object
function DudeTwo(descr) {

    // Common inherited setup logic from Entity
    this.setup(descr);

    this.cx = this.cellWidth/2;
    this.cy = this.cellHeight*16.5;

    this.rememberResets();
    
    // Default sprite, if not otherwise specified
    this.sprite = this.sprite || g_sprites.dudeTwo;

    this.cellNum = 4;
    this.frame = this._imageMap[this.cellNum];

    this.score = entityManager.score;
    this.lives = entityManager.lives;
};

DudeTwo.prototype = new Entity();

DudeTwo.prototype.rememberResets = function () {
    // Remember my reset positions
    this.reset_cx = this.cx;
    this.reset_cy = this.cy;
};

// Initial, inheritable, default values
DudeTwo.prototype.velX = 0;
DudeTwo.prototype.velY = 0;

DudeTwo.prototype._walkLeft = false;
DudeTwo.prototype._walkUp = false;
DudeTwo.prototype._walkRight = false;
DudeTwo.prototype._walkDown = false;
DudeTwo.prototype._canFinish = false;

DudeTwo.prototype._finishLine = g_canvas.width;

DudeTwo.prototype._nextFrame = 0;

DudeTwo.prototype.cellWidth = 24;
DudeTwo.prototype.cellHeight = 24;
DudeTwo.prototype.numCels = 11;
DudeTwo.prototype.numCols = 3;
DudeTwo.prototype.cellNum = 0;

DudeTwo.prototype.flipCounter = 0;
DudeTwo.prototype.flipThresh = 500 / SECS_TO_NOMINALS;

DudeTwo.prototype.extraSpeedTimer = 0;

DudeTwo.prototype.liveX = 0;
DudeTwo.prototype.liveY = 0;

DudeTwo.prototype.scoreX = g_canvas.width-24;
DudeTwo.prototype.scoreY =  g_canvas_halfHeight+76;

DudeTwo.prototype._imageMap = [
    // Up
    {x: 0, y: 0},
    {x: 24, y: 0},
    {x: 48, y: 0},
    // Right
    {x: 0, y: 24},
    {x: 24, y: 24}, 
    {x: 48, y: 24},
    // Down
    {x: 0, y: 48},
    {x: 24, y: 48}, 
    {x: 48, y: 48},
    // Left
    {x: 0, y: 72},
    {x: 24, y: 72}, 
    {x: 48, y: 72},
];

DudeTwo.prototype.update = function (du) {
    spatialManager.unregister(this);

    if (this._isDeadNow)
        return entityManager.KILL_ME_NOW;

    if (this.score >= 237)
        this._canFinish = true; 

    // Handle collision with the Dude.
    var hitEntity = this.findHitEntity();
    if (hitEntity) {
        var canTakeHit = hitEntity.collideWithDude;
        if (canTakeHit && !this._isDying) {
            canTakeHit.call(hitEntity);
            
            if (hitEntity.isBaddie) this.argueDeath();
            if (hitEntity.isCoin) this.score++;
            if (hitEntity.isExtraLife) this.lives++;
            if (hitEntity.isExtraSpeed) this.increaseSpeed();
        }
    }

    if (this.extraSpeedTimer > 0) {
        this.extraSpeedTimer -= du;
    }
    else {
        this.extraSpeedTimer = 0;
        this.velX = 3;
        this.velY = 3;
    }

    this.moveDude(du);
    
    // Quick get out!
    if (this._canFinish)
        this._finishLine = g_canvas.width-this.cellWidth;

    this.progressGame();    

    spatialManager.register(this);
};

DudeTwo.prototype.argueDeath = function () {
    if (this.lives > 1) {
        this.lives--;
        this.reset();
    }
    else {
        this.killMeNow();
        location.reload();
    }
};

DudeTwo.prototype.killMeNow = function () {
    this._isDeadNow = true;
};

DudeTwo.prototype.increaseSpeed = function () {
    this.velX *= 2;
    this.velY *= 2;

    this.extraSpeedTimer = 8000 / SECS_TO_NOMINALS;
};

DudeTwo.prototype.moveDude = function (du) {
	var nextX = this.cx + this.velX;

    switch (true) {
        case (keys[37]):    // Left
            if (this.flipCounter >= this.flipThresh) {
                if (this.cellNum === this.numCels || this.cellNum <= this.numCels-this.numCols)
                    this.cellNum = 10;
                else
                    this.cellNum++;

                this.frame = this._imageMap[this.cellNum];
                this.flipCounter = 0;
            }

            // Wrap up in a try-catch to avoid problems when shifting over from levelOne to levelTwo.
            // Revisit this problem for a cleaner fix!
            try {
                for (var i = 0; i < entityManager._level[0].walkTileLoc.length; i++) {
                    if (this.cx === entityManager._level[0].walkTileLoc[i].cx &&
                        (this.cy === entityManager._level[0].walkTileLoc[i].cy) &&
                        entityManager._level[0].walkTileLoc[i].walkLeft &&
                        this._nextFrame === 0) {
                        this._walkLeft = true;
                        this._nextFrame = this.cx - this.cellWidth;
                    }
                }    
            }
            catch (err) {
                return;
            }
        break;
        case (keys[38]):    // Up
            if (this.flipCounter >= this.flipThresh) {
                if (this.cellNum >= this.numCols-1)
                    this.cellNum = 1;
                else
                    this.cellNum++;

                this.frame = this._imageMap[this.cellNum];
                this.flipCounter = 0;
            }

            // Wrap up in a try-catch to avoid problems when shifting over from levelOne to levelTwo.
            // Revisit this problem for a cleaner fix!
            try {
                for (var i = 0; i < entityManager._level[0].walkTileLoc.length; i++) {
                    if (this.cx === entityManager._level[0].walkTileLoc[i].cx &&
                        (this.cy === entityManager._level[0].walkTileLoc[i].cy) &&
                        entityManager._level[0].walkTileLoc[i].walkUp &&
                        this._nextFrame === 0) {
                        this._walkUp = true;
                        this._nextFrame = this.cy - this.cellHeight;
                    }
                }    
            }
            catch (err) {
                return;
            }
        break;
        case (keys[39]):    // Right
            if (this.flipCounter >= this.flipThresh) {
                if (this.cellNum >= 5 || this.cellNum < 4)
                    this.cellNum = 4;
                else
                    this.cellNum++;

                this.frame = this._imageMap[this.cellNum];
                this.flipCounter = 0;
            }

            // Wrap up in a try-catch to avoid problems when shifting over from levelOne to levelTwo.
            // Revisit this problem for a cleaner fix!
            try {
                for (var i = 0; i < entityManager._level[0].walkTileLoc.length; i++) {
                    if (this.cx === entityManager._level[0].walkTileLoc[i].cx &&
                        (this.cy === entityManager._level[0].walkTileLoc[i].cy) &&
                        entityManager._level[0].walkTileLoc[i].walkRight &&
                        this._nextFrame === 0) {
                        this._walkRight = true;
                        this._nextFrame = this.cx + this.cellWidth;   
                    }
                }    
            }
            catch (err) {
                return;
            }
        break;
        case (keys[40]):    // Down
            if (this.flipCounter >= this.flipThresh) {
                if (this.cellNum >= 8 || this.cellNum < 7)
                    this.cellNum = 7;
                else
                    this.cellNum++;

                this.frame = this._imageMap[this.cellNum];
                this.flipCounter = 0;
            }

            try {
                for (var i = 0; i < entityManager._level[0].walkTileLoc.length; i++) {
                    if (this.cx === entityManager._level[0].walkTileLoc[i].cx &&
                        (this.cy === entityManager._level[0].walkTileLoc[i].cy) &&
                        entityManager._level[0].walkTileLoc[i].walkDown &&
                        this._nextFrame === 0) {
                        this._walkDown = true;
                        this._nextFrame = this.cy + this.cellHeight;
                    }
                }    
            }
            catch (err) {
                return;
            }
        break;
        default:
            if (this.cellNum < this.numCols)
                this.cellNum = 0;
            else if (this.numCols < this.cellNum && this.cellNum <= (this.numCols*2)-1)
                this.cellNum = 3;
            else if (this.numCols*2 < this.cellNum && this.cellNum <= (this.numCols*3)-1)
                this.cellNum = 6;
            else if (this.numCols*3 < this.cellNum && this.cellNum <= (this.numCols*4)-1)
                this.cellNum = 9;

            this.frame = this._imageMap[this.cellNum];
        break; 
    }

    this.flipCounter += du;

    this.moveToNextFrame();
};

DudeTwo.prototype.moveToNextFrame = function () {
    var nextRightX = this.cx+this.velX;
    var nextLeftX = this.cx-this.velX;
    var nextDownY = this.cy+this.velY;
    var nextUpY = this.cy-this.velY;

    switch (true) {
        case (this._walkLeft):
            if (this.cx > this._nextFrame && nextLeftX >= this._nextFrame) {
                this.cx -= this.velX;
            }
            else {
                this.cx -= (this.cx-this._nextFrame);
                this._nextFrame = 0;
                this._walkLeft = false;
            }
        break;
        case (this._walkUp):
            if (this.cy > this._nextFrame && nextUpY >= this._nextFrame) {
                this.cy -= this.velY;
            }
            else {
                this.cy -= (this.cy-this._nextFrame);
                this._nextFrame = 0;
                this._walkUp = false;
            }
        break;  
        case (this._walkRight):
            if (this.cx < this._nextFrame && nextRightX <= this._nextFrame) {
                this.cx += this.velX;
            }
            else {
                this.cx += (this._nextFrame-this.cx);
                this._nextFrame = 0;
                this._walkRight = false;
            }
        break;
        case (this._walkDown):
            if (this.cy < this._nextFrame && nextDownY <= this._nextFrame) {
                this.cy += this.velY;
            }
            else {
                this.cy += (this._nextFrame-this.cy);
                this._nextFrame = 0;
                this._walkDown = false;
            }
        break;
    }
};

DudeTwo.prototype.progressGame = function () {
    if (this.cx > this._finishLine)
        entityManager.flush();
};

DudeTwo.prototype.getRadius = function () {
    return this.cellWidth * 0.25;
};

DudeTwo.prototype.reset = function () {
    this._nextFrame = 0;
    this._walkLeft = false;
    this._walkUp = false;
    this._walkRight = false;
    this._walkDown = false;

    this.setPos(this.reset_cx, this.reset_cy);
};

DudeTwo.prototype.render = function (ctx) {
    // Draw the dude.
    this.sprite.drawFrameAt(
    	ctx,
    	this.cx - this.cellWidth/2,
    	this.cy - this.cellHeight/2,
    	this.cellWidth,
    	this.cellHeight,
    	this.frame);

    // Draw the lives.
    for (var i = 0; i < this.lives; i++) {
        this.sprite.drawFrameAt(
            ctx,
            this.liveX+24*i,
            this.liveY,
            this.cellWidth,
            this.cellHeight,
            this.frame);
    }

    // Draw the score.
    ctx.font = "48px Bold Calibri";
    var oldStyle = ctx.fillStyle;
    ctx.fillStyle = "rgba(252, 136, 0, 1)";
    ctx.textAlign = "right";
    ctx.fillText(this.score, this.scoreX, this.scoreY);
    ctx.strokeText(this.score, this.scoreX, this.scoreY);
    ctx.fillStyle = oldStyle;

    // Draw the speed timer.
    util.strokeRect(
        ctx,  
        24, 
        g_canvas.height-12,
        8000/SECS_TO_NOMINALS*2,
        5,
        "black");

    util.drawLine(
        ctx, 
        24, 
        g_canvas.height-12, 
        24+this.extraSpeedTimer*2, 
        g_canvas.height-12, 
        "rgb(25,25,112)",
        "rgb(65,105,225)");

    // Spatial debugs
    if (g_renderSpatialDebug) {
        ctx.beginPath();
        ctx.strokeStyle = "white";
        ctx.moveTo(this.cx, this.cy - this.cellHeight/2);
        ctx.lineTo(this.cx, this.cy + this.cellHeight/2);
        ctx.moveTo(this.cx - this.cellWidth/2, this.cy);
        ctx.lineTo(this.cx + this.cellWidth/2, this.cy);
        ctx.stroke();
    }
};
